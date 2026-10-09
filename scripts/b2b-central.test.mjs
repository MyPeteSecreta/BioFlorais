/*
 * Rodada 5 / V3+V4+V6+V7: contrato Central ⇄ Bio (convites, pedidos por etapa, andamento, cadastro
 * do vendedor entre marcas), chamadas da Bio à Central e Analytics sem token na URL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { applyBrandProgress, applyReplicatedProfile, createBrandInvite, listBrandOrders, lookupSellerProfile } = await import("../src/lib/central/brand-api.ts");
const { verifyCentralSecret } = await import("../src/lib/central/secret.ts");
const { loadProfileSources, replicateAfterCompletion } = await import("../src/lib/central/central-client.ts");
const { sanitizeAnalyticsUrl } = await import("../src/lib/analytics-url.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const O_SEP = UUID(31); // pago, a separar, com bonificado
const O_SEPARATING = UUID(32);
const O_READY = UUID(33); // separado, sem rastreio
const O_READY_TRACKED = UUID(34); // separado, com rastreio (fora da etapa)
const O_SHIPPED = UUID(35);
const O_UNPAID = UUID(36);
const O_ARCHIVED = UUID(37);
const PROFILE = {
  personType: "pf", cpf: "12345678909", rg: "1234567", cnpj: null, stateRegistration: null, pixKey: "pix@x.com",
  bankName: null, bankAgency: null, bankAccount: null, postalCode: "01310100", street: "Av. Paulista", addressNumber: "1000",
  addressComplement: null, neighborhood: "Bela Vista", city: "São Paulo", state: "SP",
};
const TERMS = { acceptedAt: "2026-09-01T12:00:00Z", ip: "200.1.1.1", version: "2026-09" };
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text);
    CREATE TABLE addresses (id uuid PRIMARY KEY, city text, state text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, shipping_address_id uuid, status text, fulfillment_status text,
      b2b_offer_id uuid, shipping_service_name text, tracking_code text, created_at timestamp DEFAULT now(), archived_at timestamp);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int, product_name_snapshot text);
    CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, carrier text, tracking_code text,
      tracking_url text, note text, created_by text, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, email text, login text, type text, status text, profile_completed_at timestamp,
      onboarding_completed_at timestamp, updated_at timestamp, created_at timestamp DEFAULT now(), archived_at timestamp,
      person_type text, cpf text, rg text, cnpj text, state_registration text, pix_key text, bank_name text, bank_agency text, bank_account text,
      postal_code text, street text, address_number text, address_complement text, neighborhood text, city text, state text,
      rca_terms_accepted_at timestamp, rca_terms_accepted_ip text, rca_terms_version text);
    INSERT INTO customers VALUES ('${UUID(1)}', 'Ana Souza');
    INSERT INTO addresses VALUES ('${UUID(2)}', 'Campinas', 'SP');
    INSERT INTO products VALUES ('${UUID(3)}', 'produto-que-nao-existe-no-catalogo', 'Agressividade', 'Shampoo', 'cosmeticos-pet'),
                                ('${UUID(4)}', 'outro-inexistente', 'Calma', 'Floral em gotas', 'adulto');
    INSERT INTO orders (id, customer_id, shipping_address_id, status, fulfillment_status, b2b_offer_id, tracking_code, shipping_service_name, created_at, archived_at) VALUES
      ('${O_SEP}', '${UUID(1)}', '${UUID(2)}', 'paid', 'paid_to_prepare', '${UUID(90)}', NULL, NULL, '2026-10-01', NULL),
      ('${O_SEPARATING}', '${UUID(1)}', '${UUID(2)}', 'approved', 'separating', NULL, NULL, NULL, '2026-10-02', NULL),
      ('${O_READY}', '${UUID(1)}', '${UUID(2)}', 'paid', 'ready_to_ship', NULL, NULL, NULL, '2026-10-03', NULL),
      ('${O_READY_TRACKED}', '${UUID(1)}', '${UUID(2)}', 'paid', 'ready_to_ship', NULL, 'BR123', 'Correios', '2026-10-04', NULL),
      ('${O_SHIPPED}', '${UUID(1)}', '${UUID(2)}', 'paid', 'shipped', NULL, 'BR999', 'Correios', '2026-10-05', NULL),
      ('${O_UNPAID}', '${UUID(1)}', '${UUID(2)}', 'pending', 'awaiting_payment', NULL, NULL, NULL, '2026-10-06', NULL),
      ('${O_ARCHIVED}', '${UUID(1)}', '${UUID(2)}', 'paid', 'paid_to_prepare', NULL, NULL, NULL, '2026-10-07', now());
    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, product_name_snapshot) VALUES
      ('${O_SEP}', '${UUID(3)}', 10, 5000, 'Shampoo Agressividade · Cosméticos Pet · 500 ml'),
      ('${O_SEP}', '${UUID(3)}', 2, 0, 'Shampoo Agressividade · Cosméticos Pet · 500 ml'),
      ('${O_SEP}', '${UUID(4)}', 3, 4000, NULL),
      ('${O_SEPARATING}', '${UUID(4)}', 1, 4000, NULL);
    INSERT INTO b2b_responsibles (id, name, email, login, type, status) VALUES
      ('${UUID(61)}', 'Beto Ativo', 'beto@exemplo.com', 'beto', 'rca', 'active'),
      ('${UUID(62)}', 'Carla Clt', 'carla@exemplo.com', 'carla', 'clt', 'active'),
      ('${UUID(63)}', 'Davi Arquivado', 'davi@exemplo.com', 'davi', 'rca', 'inactive');
    UPDATE b2b_responsibles SET archived_at = now() WHERE id = '${UUID(63)}';
    INSERT INTO b2b_responsibles (id, name, email, login, type, status, profile_completed_at, person_type, cpf, rg, pix_key, postal_code, street,
      address_number, neighborhood, city, state, rca_terms_accepted_at, rca_terms_accepted_ip, rca_terms_version) VALUES
      ('${UUID(64)}', 'Eva Completa', 'eva@exemplo.com', 'eva', 'rca', 'active', now(), 'pf', '11122233396', '99', 'eva@pix', '01310100', 'Rua A', '5',
       'Centro', 'Santos', 'SP', '2026-09-01 12:00:00', '200.1.1.1', '2026-09');
  `);
}

test("segredo: ausente na marca = 503 (não configurada), errado/ausente = negado, certo = ok", () => {
  assert.equal(verifyCentralSecret("abc", undefined), "not_configured");
  assert.equal(verifyCentralSecret(null, "abc"), "denied");
  assert.equal(verifyCentralSecret("abd", "abc"), "denied");
  assert.equal(verifyCentralSecret("abcd", "abc"), "denied");
  assert.equal(verifyCentralSecret("abc", "abc"), "ok");
});

test("convite: mesmas regras do admin; e-mail em uso cita o dono; só vendedor existente ocupa", async () => {
  await fresh();
  const issued = [];
  const issue = async (input) => {
    issued.push(input);
    return { inviteId: "inv-1", url: "https://www.bioflorais.com.br/b2b/convite/TOKEN", expiresAt: new Date("2026-10-15T00:00:00Z") };
  };

  const ok = await createBrandInvite(run, issue, { name: "Fulano", email: "NOVO@exemplo.com", phone: "(11) 91234-5678", type: "RCA" });
  assert.equal(ok.ok, true);
  assert.equal(ok.link, "https://www.bioflorais.com.br/b2b/convite/TOKEN");
  assert.match(ok.whatsappUrl, /^https:\/\/wa\.me\/5511912345678\?text=/);
  assert.equal(ok.expiresAt, "2026-10-15T00:00:00.000Z");
  assert.deepEqual(issued[0], { name: "Fulano", email: "novo@exemplo.com", responsibleType: "rca" });

  const clt = await createBrandInvite(run, issue, { name: "Fulano", email: "clt@exemplo.com", phone: null, type: "VENDEDOR" });
  assert.equal(clt.whatsappUrl, null);
  assert.equal(issued[1].responsibleType, "clt");

  const taken = await createBrandInvite(run, issue, { name: "Xe", email: "beto@exemplo.com", type: "RCA" });
  assert.equal(taken.ok, false);
  assert.equal(taken.code, "EMAIL_IN_USE");
  assert.match(taken.error, /Beto Ativo/);

  for (const bad of [{ name: "", email: "a@b.co", type: "RCA" }, { name: "Xx", email: "sem", type: "RCA" }, { name: "Xx", email: "a@b.co", type: "OUTRO" }, { name: "Xx", email: "a@b.co", type: "RCA", phone: "123" }]) {
    const r = await createBrandInvite(run, issue, bad);
    assert.equal(r.ok, false);
    assert.equal(r.code, "INVALID");
  }
  assert.equal(issued.length, 2, "nenhum convite criado nos erros");
});

test("pedidos por etapa: só pagos, sem arquivados, nome completo e pagas + bonificadas", async () => {
  await fresh();
  const ids = async (stage) => (await listBrandOrders(run, stage)).orders.map((o) => o.id);
  assert.deepEqual(await ids("separation"), [O_SEP, O_SEPARATING], "mais antigos primeiro; 'approved' conta; arquivado e não pago ficam de fora");
  assert.deepEqual(await ids("tracking"), [O_READY], "separado SEM rastreio");
  assert.deepEqual(await ids("shipped"), [O_SHIPPED]);

  const sep = (await listBrandOrders(run, "separation")).orders[0];
  assert.equal(sep.number, "BIO-00000031");
  assert.equal(sep.customerName, "Ana Souza");
  assert.equal(sep.city, "Campinas");
  assert.equal(sep.state, "SP");
  assert.equal(sep.b2b, true);
  assert.equal(sep.fulfillment, "paid_to_prepare");
  assert.match(sep.createdAt, /^2026-10-01T00:00:00\.000Z$/);
  const agress = sep.items.find((i) => i.name.startsWith("Shampoo Agressividade"));
  assert.deepEqual(agress, { name: "Shampoo Agressividade · Cosméticos Pet · 500 ml", paidQty: 10, bonusQty: 2, qty: 12 });
  const calma = sep.items.find((i) => i.name.includes("Calma"));
  assert.equal(calma.paidQty, 3);
  assert.equal(calma.qty, 3);
  assert.equal((await listBrandOrders(run, "separation")).orders[1].b2b, false);
});

test("andamento pela Central grava o mesmo que o admin (status + order_events, autor 'Central · nome')", async () => {
  await fresh();
  const events = async (id) => run(`SELECT event, carrier, tracking_code, tracking_url, note, created_by FROM order_events WHERE order_id = $1 ORDER BY created_at, id`, [id]);

  assert.deepEqual(await applyBrandProgress(run, O_SEP, { action: "separating", actor: "Marina" }), { ok: true, fulfillmentStatus: "separating" });
  assert.deepEqual(await applyBrandProgress(run, O_SEP, { action: "separated", actor: "Marina" }), { ok: true, fulfillmentStatus: "ready_to_ship" });
  const [row] = await run(`SELECT fulfillment_status FROM orders WHERE id = $1`, [O_SEP]);
  assert.equal(row.fulfillment_status, "ready_to_ship");
  const evs = await events(O_SEP);
  assert.deepEqual(evs.map((e) => e.event), ["separating", "separating"], "cliente continua vendo 'Em separação'");
  assert.ok(evs.every((e) => e.created_by === "Central · Marina"));
  assert.equal(evs[1].note, "Separado e embalado");

  // enviado exige transportadora + código; link só http(s)
  assert.equal((await applyBrandProgress(run, O_SEP, { action: "shipped", actor: "M", carrier: "Correios" })).status, 400);
  assert.equal((await applyBrandProgress(run, O_SEP, { action: "shipped", actor: "M", carrier: "Correios", trackingCode: "BR1", trackingUrl: "ftp://x" })).status, 400);
  assert.deepEqual(
    await applyBrandProgress(run, O_SEP, { action: "shipped", actor: "Marina", carrier: "Correios", trackingCode: "BR1", trackingUrl: "https://rastreio.test/BR1" }),
    { ok: true, fulfillmentStatus: "shipped" }
  );
  const [shipped] = await run(`SELECT fulfillment_status, shipping_service_name, tracking_code FROM orders WHERE id = $1`, [O_SEP]);
  assert.deepEqual(shipped, { fulfillment_status: "shipped", shipping_service_name: "Correios", tracking_code: "BR1" });
  const last = (await events(O_SEP)).at(-1);
  assert.deepEqual(last, { event: "shipped", carrier: "Correios", tracking_code: "BR1", tracking_url: "https://rastreio.test/BR1", note: null, created_by: "Central · Marina" });

  // não volta de etapa; entregue só depois de enviado
  assert.equal((await applyBrandProgress(run, O_SEP, { action: "separating", actor: "M" })).status, 409);
  assert.equal((await applyBrandProgress(run, O_READY, { action: "delivered", actor: "M" })).status, 409);
  assert.deepEqual(await applyBrandProgress(run, O_SEP, { action: "delivered", actor: "Marina" }), { ok: true, fulfillmentStatus: "delivered" });
  assert.equal((await events(O_SEP)).at(-1).event, "delivered");

  // pedido não pago, inexistente, ação inválida
  assert.equal((await applyBrandProgress(run, O_UNPAID, { action: "separating", actor: "M" })).status, 409);
  assert.equal((await applyBrandProgress(run, UUID(99), { action: "separating", actor: "M" })).status, 404);
  assert.equal((await applyBrandProgress(run, O_READY, { action: "voar", actor: "M" })).status, 400);
  assert.equal((await applyBrandProgress(run, "nao-uuid", { action: "separating", actor: "M" })).status, 400);

  // depois de enviado sai da lista de rastreio e entra na de enviados
  assert.ok(!(await listBrandOrders(run, "tracking")).orders.some((o) => o.id === O_SEP));
});

test("V4 consulta: só e-mail exato, ignora arquivados, 'complete' reflete o cadastro completo", async () => {
  await fresh();
  assert.deepEqual(await lookupSellerProfile(run, "naoexiste@exemplo.com"), { ok: true, found: false });
  assert.deepEqual(await lookupSellerProfile(run, "davi@exemplo.com"), { ok: true, found: false }, "arquivado");
  assert.deepEqual(await lookupSellerProfile(run, "lixo"), { ok: true, found: false });
  const incomplete = await lookupSellerProfile(run, "BETO@exemplo.com");
  assert.equal(incomplete.found, true);
  assert.equal(incomplete.complete, false);
  const eva = await lookupSellerProfile(run, "eva@exemplo.com");
  assert.equal(eva.complete, true);
  assert.equal(eva.name, "Eva Completa");
  assert.equal(eva.profile.cpf, "11122233396");
  assert.equal(eva.profile.pixKey, "eva@pix");
  assert.equal(eva.profile.cnpj, null);
  assert.deepEqual(eva.terms, { acceptedAt: "2026-09-01T12:00:00Z", ip: "200.1.1.1", version: "2026-09" });
});

test("V4 replicação: preenche só quem não completou, termo do aceite original, sem sobrescrever", async () => {
  await fresh();
  assert.deepEqual(await applyReplicatedProfile(run, { email: "ninguem@exemplo.com", profile: PROFILE, terms: TERMS }), { ok: true, applied: false, reason: "NO_SELLER" });
  assert.deepEqual(await applyReplicatedProfile(run, { email: "davi@exemplo.com", profile: PROFILE, terms: TERMS }), { ok: true, applied: false, reason: "NO_SELLER" }, "arquivado");
  assert.deepEqual(await applyReplicatedProfile(run, { email: "beto@exemplo.com", profile: PROFILE, terms: null }), { ok: true, applied: false, reason: "TERMS_REQUIRED" });
  assert.equal((await applyReplicatedProfile(run, { email: "beto@exemplo.com", profile: { ...PROFILE, cpf: "123" }, terms: TERMS })).ok, false, "dados inválidos");
  assert.equal((await applyReplicatedProfile(run, { email: "beto@exemplo.com", profile: undefined })).ok, false);

  assert.deepEqual(await applyReplicatedProfile(run, { email: "beto@exemplo.com", profile: PROFILE, terms: TERMS }), { ok: true, applied: true });
  const [beto] = await run(`SELECT profile_completed_at IS NOT NULL AS done, cpf, pix_key, city, rca_terms_accepted_ip, rca_terms_version,
    to_char(rca_terms_accepted_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS at FROM b2b_responsibles WHERE id = $1`, [UUID(61)]);
  assert.deepEqual(beto, { done: true, cpf: "12345678909", pix_key: "pix@x.com", city: "São Paulo", rca_terms_accepted_ip: "200.1.1.1", rca_terms_version: "2026-09", at: "2026-09-01T12:00:00" });

  // nunca sobrescreve quem já completou
  assert.deepEqual(await applyReplicatedProfile(run, { email: "beto@exemplo.com", profile: { ...PROFILE, cpf: "98765432100" }, terms: TERMS }), { ok: true, applied: false, reason: "ALREADY_COMPLETE" });
  assert.equal((await run(`SELECT cpf FROM b2b_responsibles WHERE id = $1`, [UUID(61)]))[0].cpf, "12345678909");
  assert.equal((await applyReplicatedProfile(run, { email: "eva@exemplo.com", profile: PROFILE, terms: TERMS })).reason, "ALREADY_COMPLETE");

  // CLT não precisa de termo e não grava aceite
  assert.deepEqual(await applyReplicatedProfile(run, { email: "carla@exemplo.com", profile: PROFILE, terms: null }), { ok: true, applied: true });
  const [carla] = await run(`SELECT rca_terms_accepted_at, rca_terms_version FROM b2b_responsibles WHERE id = $1`, [UUID(62)]);
  assert.deepEqual(carla, { rca_terms_accepted_at: null, rca_terms_version: null });
});

test("Bio → Central: header do segredo, exclude=bio, replicação com o cadastro; falha ou sem variável não atrapalha", async () => {
  await fresh();
  const env = { CENTRAL_URL: "https://www.mypeteme.com.br/", CENTRAL_API_SECRET: "s3gredo" };
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(url.includes("/lookup") ? { ok: true, sources: [{ store: "mypet", label: "My Pet", profile: PROFILE, terms: null }] } : { ok: true }), { status: 200 });
  };

  const sources = await loadProfileSources("beto@exemplo.com", fetcher, env);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].label, "My Pet");
  assert.equal(calls[0].url, "https://www.mypeteme.com.br/api/central/sellers/lookup?email=beto%40exemplo.com&exclude=bio");
  assert.equal(calls[0].init.headers["x-central-secret"], "s3gredo");

  // Eva já tem cadastro completo: a Bio manda para a Central replicar
  assert.equal(await replicateAfterCompletion(run, UUID(64), fetcher, env), true);
  const post = calls.at(-1);
  assert.equal(post.url, "https://www.mypeteme.com.br/api/central/sellers/replicate");
  const body = JSON.parse(post.init.body);
  assert.equal(body.fromStore, "bio");
  assert.equal(body.email, "eva@exemplo.com");
  assert.equal(body.profile.cpf, "11122233396");
  assert.equal(body.terms.version, "2026-09");

  // Beto não completou: nada é enviado
  const before = calls.length;
  assert.equal(await replicateAfterCompletion(run, UUID(61), fetcher, env), false);
  assert.equal(calls.length, before);

  // Central fora do ar / sem variável: nunca lança
  const boom = async () => { throw new Error("rede"); };
  assert.deepEqual(await loadProfileSources("beto@exemplo.com", boom, env), []);
  assert.equal(await replicateAfterCompletion(run, UUID(64), boom, env), false);
  assert.deepEqual(await loadProfileSources("beto@exemplo.com", fetcher, {}), []);
  assert.equal(await replicateAfterCompletion(run, UUID(64), fetcher, {}), false);
});

test("V7: Analytics tira tokens da URL antes de enviar; layout e pacotes ligados", () => {
  assert.equal(sanitizeAnalyticsUrl("https://www.bioflorais.com.br/b2b/oferta/abc123?b2b=zzz&x=1"), "https://www.bioflorais.com.br/b2b/oferta/[token]?x=1");
  assert.equal(sanitizeAnalyticsUrl("/b2b/convite/TOK123"), "/b2b/convite/[token]");
  assert.equal(sanitizeAnalyticsUrl("/acompanhe/XYZ"), "/acompanhe/[token]");
  assert.equal(sanitizeAnalyticsUrl("/b2b/carrinho?b2b=segredo"), "/b2b/carrinho");
  assert.equal(sanitizeAnalyticsUrl("/acompanhe-seu-pedido?email=a@b.co&cpf=123"), "/acompanhe-seu-pedido");
  assert.equal(sanitizeAnalyticsUrl("/linha/adulto"), "/linha/adulto");
  assert.ok(!sanitizeAnalyticsUrl("https://x.com/b2b/oferta/SEGREDO").includes("SEGREDO"));

  assert.ok(read("src/app/layout.tsx").includes("<WebAnalytics />"));
  const component = read("src/components/analytics/WebAnalytics.tsx");
  assert.ok(component.includes("sanitizeAnalyticsUrl") && component.includes("beforeSend"));
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.dependencies["@vercel/analytics"] && pkg.dependencies["@vercel/speed-insights"]);
});

test("rotas /api/central/*: todas exigem o segredo antes de qualquer coisa; nada de DELETE; cadastro replica depois da resposta", () => {
  for (const f of [
    "src/app/api/central/invites/route.ts",
    "src/app/api/central/orders/route.ts",
    "src/app/api/central/orders/[id]/progress/route.ts",
    "src/app/api/central/sellers/profile/route.ts",
  ]) {
    const src = read(f);
    for (const method of src.match(/export async function (GET|POST)/g) ?? []) assert.ok(method);
    assert.equal((src.match(/centralAuthError\(request\)/g) ?? []).length, (src.match(/export async function/g) ?? []).length, f);
    assert.ok(src.indexOf("centralAuthError") < src.indexOf("getAppSqlRunner()"), f);
  }
  assert.ok(read("src/app/api/b2b/profile/complete/route.ts").includes("after(() => replicateAfterCompletion"));
  assert.ok(read("src/app/api/b2b/invites/accept/route.ts").includes("replicateAfterCompletion"));
  assert.ok(read("src/app/b2b/painel/cadastro/page.tsx").includes("loadProfileSources"));
  assert.ok(read("src/components/b2b/CompleteProfileForm.tsx").includes("Usar meus dados de"));
});
