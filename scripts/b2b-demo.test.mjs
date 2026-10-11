/*
 * MODO DEMONSTRAÇÃO (Bio): entrada só por link de campanha, vendedor temporário isolado, compras bloqueadas
 * no servidor, dados demo fora de admin/comissões/dados de teste, limite por IP e limpeza só do expirado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = "segredo-de-teste-demo";

const demo = await import("../src/lib/b2b/demo.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const REAL = U(1);
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, type text, status text, name text, email text UNIQUE,
      company_approved_at timestamptz, onboarding_completed_at timestamptz, profile_completed_at timestamptz, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, active boolean DEFAULT true, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_client_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid, active boolean DEFAULT true, unlinked_at timestamp);
    CREATE TABLE b2b_offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid, status text DEFAULT 'draft');
    CREATE TABLE b2b_offer_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid);
    CREATE TABLE b2b_offer_promotions (offer_id uuid, promotion_id uuid);
    CREATE TABLE b2b_offer_commercial_groups (offer_id uuid, commercial_group_id uuid);
    CREATE TABLE b2b_offer_line_views (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid);
    CREATE TABLE b2b_commission_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), responsible_id uuid, client_id uuid);
    CREATE TABLE b2b_offer_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), responsible_id uuid);
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), b2b_offer_id uuid, b2b_client_id uuid);
    INSERT INTO b2b_responsibles (id, type, status, name, email) VALUES ('${REAL}', 'rca', 'active', 'Vendedor Real', 'real@x.com');
  `);
  await pg.exec(read("sql/b2b/36b_modo_demonstracao.sql"));
}

test("36a/36b: aditivo e idempotente; nada existente muda", async () => {
  await fresh();
  const sql = read("sql/b2b/36b_modo_demonstracao.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  assert.deepEqual((await run(`SELECT is_demo FROM b2b_responsibles WHERE id = $1`, [REAL]))[0], { is_demo: false });
  const info = (await run(read("sql/b2b/36a_modo_demonstracao_preflight_one_shot.sql")))[0].preflight_modo_demonstracao;
  assert.equal(info.colunas_existem, true);
  assert.equal(info.tabelas_existem, true);
});

test("link de campanha: só o hash fica no banco; inválido, revogado, vencido e esgotado são recusados", async () => {
  await fresh();
  const created = await demo.createDemoLink(run, { campaign: "Hafidme e-mail 1", days: 30, maxAccesses: 2, createdBy: "Admin" });
  const [stored] = await run(`SELECT token_hash FROM b2b_demo_links WHERE id = $1`, [created.id]);
  assert.notEqual(stored.token_hash, created.token);
  assert.ok(!JSON.stringify(await run(`SELECT * FROM b2b_demo_links`)).includes(created.token));

  assert.deepEqual(await demo.resolveDemoLink(run, created.token), { ok: true, linkId: created.id });
  assert.deepEqual(await demo.resolveDemoLink(run, "token-errado"), { ok: false, reason: "invalid" });
  assert.deepEqual(await demo.resolveDemoLink(run, ""), { ok: false, reason: "invalid" });

  await demo.createDemoSeller(run, created.id);
  await demo.createDemoSeller(run, created.id);
  assert.deepEqual(await demo.resolveDemoLink(run, created.token), { ok: false, reason: "exhausted" });

  const expired = await demo.createDemoLink(run, { campaign: "Velha", days: 1, maxAccesses: null, createdBy: "Admin", now: new Date(Date.now() - 3 * 86_400_000) });
  assert.deepEqual(await demo.resolveDemoLink(run, expired.token), { ok: false, reason: "expired" });

  const open = await demo.createDemoLink(run, { campaign: "Aberta", days: 30, maxAccesses: null, createdBy: "Admin" });
  assert.equal(await demo.revokeDemoLink(run, open.id), true);
  assert.deepEqual(await demo.resolveDemoLink(run, open.token), { ok: false, reason: "revoked" });

  assert.equal(demo.parseDemoLinkInput({ campaign: "x" }).ok, false);
  assert.equal(demo.parseDemoLinkInput({ campaign: "Campanha", days: 400 }).ok, false);
  assert.deepEqual(demo.parseDemoLinkInput({ campaign: "Campanha" }), { ok: true, campaign: "Campanha", days: 30, maxAccesses: null });
  const rows = await demo.listDemoLinks(run);
  assert.equal(rows.find((row) => row.id === created.id).accesses, 2);
});

test("cada visitante tem o PRÓPRIO demo: não vê o do outro nem o real; o real não vê o demo", async () => {
  await fresh();
  const a = await demo.createDemoSeller(run, null);
  const b = await demo.createDemoSeller(run, null);
  assert.notEqual(a.responsibleId, b.responsibleId);

  const clientsOf = async (id) =>
    run(`SELECT c.display_name FROM b2b_clients c JOIN b2b_client_relationships r ON r.client_id = c.id WHERE r.responsible_id = $1`, [id]);
  await run(`INSERT INTO b2b_clients (id, display_name) VALUES ('${U(70)}', 'Cliente do A')`);
  await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${U(70)}', $1)`, [a.responsibleId]);

  assert.deepEqual((await clientsOf(a.responsibleId)).map((c) => c.display_name).sort(), ["Cliente do A", "Loja Exemplo"]);
  assert.deepEqual((await clientsOf(b.responsibleId)).map((c) => c.display_name), ["Loja Exemplo"]);
  assert.equal((await clientsOf(REAL)).length, 0);

  assert.equal((await demo.loadDemoState(run, a.responsibleId)).isDemo, true);
  assert.equal((await demo.loadDemoState(run, REAL)).isDemo, false);
  assert.deepEqual(await demo.loadDemoState(run, U(999)), { isDemo: false, expired: false, expiresAt: null });

  // filtro usado pelas telas do admin/comissões/dados de teste/parceiros
  const visible = await run(`SELECT id FROM b2b_responsibles r WHERE ${demo.NOT_DEMO_SQL("r")}`);
  assert.deepEqual(visible.map((row) => row.id), [REAL]);

  const [seller] = await run(`SELECT name, type, email, is_demo FROM b2b_responsibles WHERE id = $1`, [a.responsibleId]);
  assert.deepEqual([seller.name, seller.type, seller.is_demo], ["Demonstração", "clt", true]);
  assert.match(seller.email, /^demo\+.+@invalid$/);
});

test("compra recusada para oferta de demonstração (oferta demo x oferta real)", async () => {
  await fresh();
  const seller = await demo.createDemoSeller(run, null);
  await run(`INSERT INTO b2b_offers (id, client_id, responsible_id) VALUES ('${U(80)}', '${U(70)}', $1), ('${U(81)}', '${U(70)}', '${REAL}')`, [seller.responsibleId]);

  assert.equal(await demo.offerIsDemo(run, U(80)), true);
  assert.equal(await demo.offerIsDemo(run, U(81)), false);
  assert.equal(demo.DEMO_PURCHASE_DISABLED_MESSAGE, "Demonstração: compras desativadas.");
});

test("limite de 10 criações por IP por hora (por IP; passa depois de 1 h)", async () => {
  await fresh();
  const now = new Date("2026-10-11T12:00:00Z");

  for (let i = 0; i < 10; i += 1) assert.equal((await demo.registerDemoCreation(run, "ip-a", null, now)).allowed, true);

  assert.equal((await demo.registerDemoCreation(run, "ip-a", null, now)).allowed, false);
  assert.equal((await demo.registerDemoCreation(run, "ip-b", null, now)).allowed, true);
  assert.equal((await demo.registerDemoCreation(run, "ip-a", null, new Date(now.getTime() + 61 * 60_000))).allowed, true);
  assert.notEqual(demo.hashIp("200.1.1.1"), "200.1.1.1");
});

test("cookie do demo: assinado, expira e não aceita adulteração", () => {
  const exp = new Date(Date.now() + 3_600_000);
  const cookie = demo.createDemoCookie(U(5), exp);
  assert.deepEqual(demo.readDemoCookie(cookie), { responsibleId: U(5) });
  assert.equal(demo.readDemoCookie(cookie, new Date(exp.getTime() + 1)), null);
  assert.equal(demo.readDemoCookie(`${cookie.split(".")[0]}.assinatura`), null);
  assert.equal(demo.readDemoCookie(undefined), null);
  assert.equal(demo.readDemoCookie("lixo"), null);
});

test("limpeza: só demo EXPIRADO e o que é dele; real, demo válido, demo com pedido e cliente compartilhado ficam", async () => {
  await fresh();
  const now = new Date("2026-10-12T12:00:00Z");
  const old = new Date("2026-10-10T10:00:00Z");
  const expired = await demo.createDemoSeller(run, null, old);
  const valid = await demo.createDemoSeller(run, null, new Date("2026-10-12T08:00:00Z"));
  const withOrder = await demo.createDemoSeller(run, null, old);

  // o expirado montou oferta, link, promoção, grupo, visualização, regra e modelo; compartilhou um cliente com o real
  await run(`INSERT INTO b2b_offers (id, client_id, responsible_id) VALUES ('${U(90)}', '${U(70)}', $1)`, [expired.responsibleId]);
  await run(`INSERT INTO b2b_offer_links (offer_id) VALUES ('${U(90)}')`);
  await run(`INSERT INTO b2b_offer_promotions VALUES ('${U(90)}', '${U(91)}')`);
  await run(`INSERT INTO b2b_offer_commercial_groups VALUES ('${U(90)}', '${U(92)}')`);
  await run(`INSERT INTO b2b_offer_line_views (offer_id) VALUES ('${U(90)}')`);
  await run(`INSERT INTO b2b_commission_rules (responsible_id) VALUES ($1)`, [expired.responsibleId]);
  await run(`INSERT INTO b2b_offer_templates (responsible_id) VALUES ($1)`, [expired.responsibleId]);
  await run(`INSERT INTO b2b_clients (id, display_name) VALUES ('${U(71)}', 'Cliente compartilhado')`);
  await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${U(71)}', $1), ('${U(71)}', '${REAL}')`, [expired.responsibleId]);

  // demo com pedido ligado é preservado
  await run(`INSERT INTO b2b_offers (id, client_id, responsible_id) VALUES ('${U(95)}', '${U(70)}', $1)`, [withOrder.responsibleId]);
  await run(`INSERT INTO orders (b2b_offer_id) VALUES ('${U(95)}')`);

  // vendedor REAL com data de demo vencida mas is_demo = false nunca entra
  await run(`UPDATE b2b_responsibles SET demo_expires_at = $2 WHERE id = $1`, [REAL, old.toISOString()]);
  await run(`INSERT INTO b2b_offers (id, client_id, responsible_id) VALUES ('${U(96)}', '${U(71)}', '${REAL}')`);

  const result = await demo.cleanupExpiredDemo(run, now);
  assert.equal(result.sellers, 1);
  assert.equal(result.offers, 1);
  assert.equal(result.clients, 1, "só a Loja Exemplo dele; o compartilhado fica");

  const sellers = (await run(`SELECT id FROM b2b_responsibles ORDER BY id`)).map((row) => row.id);
  assert.ok(!sellers.includes(expired.responsibleId));
  assert.ok(sellers.includes(valid.responsibleId) && sellers.includes(withOrder.responsibleId) && sellers.includes(REAL));
  assert.equal((await run(`SELECT count(*)::int AS n FROM b2b_clients WHERE id = '${U(71)}'`))[0].n, 1);
  assert.equal((await run(`SELECT count(*)::int AS n FROM b2b_offers WHERE id = '${U(96)}'`))[0].n, 1);
  for (const table of ["b2b_offer_links", "b2b_offer_promotions", "b2b_offer_commercial_groups", "b2b_offer_line_views", "b2b_commission_rules", "b2b_offer_templates"]) {
    assert.equal((await run(`SELECT count(*)::int AS n FROM ${table}`))[0].n, 0, table);
  }
  // segunda rodada não apaga mais nada
  assert.deepEqual(await demo.cleanupExpiredDemo(run, now), { sellers: 0, clients: 0, offers: 0 });
});

test("fios: bloqueios no servidor, exclusões, faixa, QR com aviso, cron e rotas protegidas", () => {
  assert.ok(read("src/app/api/b2b/orders/create/route.ts").includes("context.isDemo") && read("src/app/api/b2b/orders/create/route.ts").includes("status: 403"));
  const ctx = read("src/lib/b2b/public-offer-context.ts");
  assert.ok(ctx.includes("isDemo,") && ctx.includes("resolution.context.isDemo") && ctx.includes("link_revoked_or_expired"));
  assert.ok(read("src/lib/b2b/quote.ts").includes("context.isDemo"), "cupom na cotação");
  assert.ok(read("src/lib/b2b/require-responsible.ts").includes("demo.isDemo && demo.expired"));
  assert.ok(read("src/lib/b2b/current-responsible.ts").includes("/b2b/demo-expirada"));

  for (const f of ["src/app/api/admin/b2b/responsibles/route.ts", "src/app/api/admin/b2b/tracking/route.ts", "src/lib/b2b/commissions.ts", "src/lib/b2b/test-data.ts", "src/lib/b2b/partners.ts"]) {
    assert.ok(/NOT_DEMO_SQL|is_demo/.test(read(f)), f);
  }
  assert.ok(read("src/app/b2b/painel/layout.tsx").includes("<DemoBanner") && read("src/app/b2b/painel/layout.tsx").includes("<DemoWelcome"));
  assert.ok(read("src/app/b2b/layout.tsx").includes("<DemoTokenBanner"));
  assert.ok(read("src/components/b2b/DemoBanner.tsx").includes("Quero ser representante"));
  const share = read("src/components/b2b/LinkSharePanel.tsx");
  assert.ok(share.includes("Abrir como cliente") && share.includes("link FICTÍCIO") && share.includes("demo={demo}"));
  assert.ok(read("src/components/b2b/QrCodeModal.tsx").includes("DEMONSTRAÇÃO"));

  assert.ok(read("src/app/api/admin/b2b/demo-links/route.ts").indexOf("isAdminRequest") > 0);
  assert.ok(read("src/app/api/cron/cleanup-b2b-demo/route.ts").includes("CRON_SECRET"));
  assert.ok(read("vercel.json").includes("/api/cron/cleanup-b2b-demo"));
  assert.ok(read("src/app/b2b/demo/[token]/route.ts").includes("registerDemoCreation"));
  assert.ok(read("src/components/admin/b2b/ResponsiblesTab.tsx").includes("<DemoLinksPanel"));
});
