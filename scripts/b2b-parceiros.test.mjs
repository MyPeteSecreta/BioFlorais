/*
 * Rodada 6 / L3: página /parceiros — código de captação por vendedor (?v=), vendedor da casa, cadastro
 * rápido do lojista, noindex e preço B2B normal.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const partners = await import("../src/lib/b2b/partners.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const [V1, V2, V3, CASA] = [U(1), U(2), U(3), U(4)];
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now());
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, email text, type text, status text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, email text, phone text, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_client_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid, active boolean DEFAULT true, unlinked_at timestamp);
    INSERT INTO b2b_responsibles VALUES
      ('${V1}', 'Ana RCA', 'ana@x.com', 'rca', 'active'), ('${V2}', 'Beto RCA', 'beto@x.com', 'rca', 'active'),
      ('${V3}', 'Inativo', 'i@x.com', 'rca', 'inactive'), ('${CASA}', 'Angel Blanc – Comercial', 'casa@x.com', 'clt', 'active');
  `);
  await pg.exec(read("sql/b2b/35b_parceiros.sql"));
}

test("35a/35b: aditivo e idempotente; todo vendedor existente recebe código único de 6 letras/números sem e-mail", async () => {
  await fresh();
  const sql = read("sql/b2b/35b_parceiros.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  const before = await run(`SELECT id, referral_code FROM b2b_responsibles ORDER BY id`);
  await pg.exec(sql);
  const after = await run(`SELECT id, referral_code FROM b2b_responsibles ORDER BY id`);
  assert.deepEqual(after, before, "idempotente: não troca códigos já gerados");
  const codes = after.map((row) => row.referral_code);
  assert.ok(codes.every((code) => /^[A-HJKMNP-Z2-9]{6}$/.test(code)));
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(!codes.some((code) => /ana|beto|casa/i.test(code)));
  const info = (await run(read("sql/b2b/35a_parceiros_preflight_one_shot.sql")))[0].preflight_parceiros;
  assert.equal(info.colunas_existem, true);
  assert.equal(info.vendedores_ativos, 3);
});

test("código: acha vendedor ativo sem diferenciar maiúsculas; inativo/inválido não; sem ?v= cai na casa; sem casa, ninguém", async () => {
  await fresh();
  const [{ referral_code: ana }] = await run(`SELECT referral_code FROM b2b_responsibles WHERE id = $1`, [V1]);

  assert.equal((await partners.findSellerByCode(run, ana.toLowerCase())).id, V1);
  assert.equal(await partners.findSellerByCode(run, "naoexiste"), null);
  assert.equal(await partners.findSellerByCode(run, "x"), null);
  const [{ referral_code: inativo }] = await run(`SELECT referral_code FROM b2b_responsibles WHERE id = $1`, [V3]);
  assert.equal(await partners.findSellerByCode(run, inativo), null);

  assert.deepEqual(await partners.resolvePartnerSeller(run, ana), { seller: await partners.findSellerByCode(run, ana), via: "code" });
  assert.equal((await partners.resolvePartnerSeller(run, undefined)).via, "none", "sem casa configurada");

  assert.deepEqual(await partners.setHouseSeller(run, V3), { ok: false, error: "O vendedor da casa precisa estar ativo." });
  assert.deepEqual(await partners.setHouseSeller(run, CASA), { ok: true });
  const noCode = await partners.resolvePartnerSeller(run, undefined);
  assert.equal(noCode.via, "house");
  assert.equal(noCode.seller.id, CASA);
  const badCode = await partners.resolvePartnerSeller(run, "ZZZZZZ");
  assert.equal(badCode.seller.id, CASA, "código inexistente também cai na casa");
  assert.equal((await partners.resolvePartnerSeller(run, ana)).seller.id, V1, "?v= vence a casa");

  await partners.setHouseSeller(run, null);
  assert.equal((await partners.resolvePartnerSeller(run, undefined)).via, "none");
});

test("admin: editar código valida formato e repetido; gerar código para quem não tem", async () => {
  await fresh();
  assert.equal((await partners.setReferralCode(run, V1, "ab")).status, 400);
  assert.equal((await partners.setReferralCode(run, V1, "com espaco")).status, 400);
  assert.deepEqual(await partners.setReferralCode(run, V1, "ana2026"), { ok: true, code: "ANA2026" });
  assert.equal((await partners.setReferralCode(run, V2, "ANA2026")).status, 409);
  assert.equal((await partners.findSellerByCode(run, "ana2026")).id, V1);

  await run(`INSERT INTO b2b_responsibles VALUES ('${U(9)}', 'Novo', 'n@x.com', 'rca', 'active')`);
  const code = await partners.ensureReferralCode(run, U(9));
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(await partners.ensureReferralCode(run, U(9)), code, "estável");
});

test("cadastro do lojista: valida CNPJ/CPF, cria cliente ligado ao vendedor com a origem e não duplica", async () => {
  await fresh();
  const ok = { name: "Pet Shop Rex", document: "11.222.333/0001-81", phone: "(21) 99999-1111", email: "REX@loja.com", city: "Niterói", state: "rj" };
  const parsed = partners.parseLead(ok);
  assert.equal(parsed.ok, true);
  assert.deepEqual([parsed.value.document, parsed.value.email, parsed.value.state], ["11222333000181", "rex@loja.com", "RJ"]);
  assert.equal(partners.parseLead({ ...ok, document: "529.982.247-25" }).ok, true, "CPF válido");
  for (const bad of [{ document: "11.222.333/0001-82" }, { document: "123" }, { name: "" }, { phone: "123" }, { email: "x" }, { city: "" }, { state: "R" }]) {
    assert.equal(partners.parseLead({ ...ok, ...bad }).ok, false, JSON.stringify(bad));
  }

  const lead = parsed.value;
  assert.equal(await partners.findExistingLead(run, V1, lead), null);
  const created = await partners.createLeadClient(run, V1, lead, { referralCode: "ANA123", via: "code" });
  const [row] = await run(`SELECT display_name, document, city, state, lead_source, lead_referral_code FROM b2b_clients WHERE id = $1`, [created.id]);
  assert.deepEqual(row, { display_name: "Pet Shop Rex", document: "11222333000181", city: "Niterói", state: "RJ", lead_source: "parceiros", lead_referral_code: "ANA123" });
  assert.equal((await run(`SELECT responsible_id FROM b2b_client_relationships WHERE client_id = $1`, [created.id]))[0].responsible_id, V1);

  // mesmo lojista de novo (e-mail ou documento): reaproveita; em outro vendedor é cliente separado
  assert.equal((await partners.findExistingLead(run, V1, lead)).id, created.id);
  assert.equal((await partners.findExistingLead(run, V1, { ...lead, email: "outro@x.com" })).id, created.id);
  assert.equal(await partners.findExistingLead(run, V2, lead), null);

  // pela casa: sem código de origem
  const house = await partners.createLeadClient(run, CASA, { ...lead, document: "52998224725", email: "c@x.com" }, { referralCode: "CASA00", via: "house" });
  assert.equal((await run(`SELECT lead_referral_code FROM b2b_clients WHERE id = $1`, [house.id]))[0].lead_referral_code, null);
});

test("página e rotas: noindex, preço B2B normal, isca anti-robô, sem vendedor só apresentação, painel e admin ligados", () => {
  const page = read("src/app/parceiros/page.tsx");
  assert.ok(page.includes("robots: { index: false, follow: false"));
  // Rodada 7: /parceiros é a LOJA (redireciona para a vitrine); sem formulário nem API de cadastro
  assert.ok(page.includes("ensureStorefrontPath") && page.includes("redirect(withForwardedParams(storePath, query))") && page.includes("Falar com um representante"));
  assert.ok(!page.includes("PartnerSignupForm") && !page.includes("seller.email"));
  assert.ok(read("src/app/b2b/painel/page.tsx").includes("<ReferralLinkPanel"));
  const panel = read("src/components/b2b/ReferralLinkPanel.tsx");
  assert.ok(panel.includes("Link geral para divulgar") && panel.includes("Copiar") && panel.includes("WhatsApp") && panel.includes("QR Code"));
  const admin = read("src/app/api/admin/b2b/responsibles/[id]/route.ts");
  assert.ok(["set_referral_code", "ensure_referral_code", "set_house"].every((action) => admin.includes(`case "${action}"`)));
  const tab = read("src/components/admin/b2b/ResponsiblesTab.tsx");
  assert.ok(tab.includes("Definir como vendedor da casa") && tab.includes("Editar código") && tab.includes("QR Code"));
  assert.ok(read("src/components/layout/HideOnB2B.tsx").includes('"/parceiros"'));
});
