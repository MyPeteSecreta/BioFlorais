/*
 * 23/11 — rastreamento: origem completa no pedido (utm_content, utm_term, gclid, fbclid; SQL 59b, tolerando a ausência) e a tela
 * "Vendas por origem" (só números, sem dado pessoal; B2B e orçamentos fora).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const at = await import("../src/lib/attribution.ts");
const server = await import("../src/lib/attribution-server.ts");
const report = await import("../src/lib/sales-by-origin.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BASE = `CREATE TABLE orders (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), status text, payment_method text, total_cents int,
  archived_at timestamp, b2b_offer_id uuid, b2b_client_id uuid, origin text);`;

const full = {
  utm_source: "meta", utm_medium: "paid", utm_campaign: "bf_vendas", referrer_domain: "l.facebook.com",
  utm_content: "ad_998877", utm_term: "floral", gclid: "GCLID_ABC12345", fbclid: "FBCLID_XYZ9876",
};

test("SQL 59b: aditivo, idempotente, em transação; 59a só leitura", async () => {
  const b = read("sql/b2b/59b_origem_extra.sql");
  assert.ok(b.includes("BEGIN;") && b.includes("COMMIT;") && b.includes("SELECT 'ok'"));
  assert.ok(!/DROP|DELETE|TRUNCATE|UPDATE\s/i.test(b.replace(/--.*$/gm, "")), "só ADD COLUMN IF NOT EXISTS");
  assert.equal((b.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length, 8);
  assert.ok(!/ALTER|INSERT|UPDATE|DELETE/i.test(read("sql/b2b/59a_origem_extra_conferencia_one_shot.sql").replace(/--.*$/gm, "")), "conferência só lê");

  const pg = new PGlite();
  await pg.exec(BASE);
  await pg.exec(b);
  await pg.exec(b); // idempotente
  const cols = (await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('utm_content','utm_term','gclid','fbclid')`)).rows;
  assert.equal(cols.length, 4);
});

test("origem completa: grava no pedido, lê de volta, CSV com content/term; sem as colunas novas cai na origem básica", async () => {
  const pg = new PGlite();
  await pg.exec(BASE + read("sql/b2b/45b_origem_venda.sql"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  await pg.exec(`INSERT INTO orders (id, status, total_cents) VALUES ('${id(1)}', 'pending', 1000)`);

  // 45b só: as colunas novas não existem → grava só a básica, sem quebrar
  assert.equal(await server.attachAttribution(run, id(1), full), true);
  assert.deepEqual(await server.loadOrderAttribution(run, id(1)), { utm_source: "meta", utm_medium: "paid", utm_campaign: "bf_vendas", referrer_domain: "l.facebook.com" });

  await pg.exec(read("sql/b2b/59b_origem_extra.sql"));
  await pg.exec(`INSERT INTO orders (id, status, total_cents) VALUES ('${id(2)}', 'paid', 5000)`);
  assert.equal(await server.attachAttribution(run, id(2), full), true);
  assert.equal(await server.attachAttribution(run, id(2), { ...full, utm_source: "outro" }), false, "não sobrescreve");
  assert.deepEqual(await server.loadOrderAttribution(run, id(2)), full);

  const csv = await server.buildOrdersOriginCsv(run, {});
  const header = csv.replace("﻿", "").split("\r\n")[0];
  assert.ok(header.includes('"utm_content","utm_term"'));
  assert.ok(csv.includes('"ad_998877"') && csv.includes('"floral"'));
  assert.ok(!csv.includes("GCLID_ABC12345") && !csv.includes("FBCLID_XYZ9876"), "o CSV não leva identificador de clique");
});

test("Vendas por origem: B2C e B2B separados; pagos × não pagos por canal/campanha/anúncio; orçamento, vendedor e mostruário de fora; sem dado pessoal", async () => {
  const pg = new PGlite();
  await pg.exec(BASE + read("sql/b2b/59b_origem_extra.sql"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  const ins = (n, status, total, extra = "") =>
    pg.exec(`INSERT INTO orders (id, status, total_cents, created_at${extra ? ", " + extra.split("|")[0] : ""}) VALUES ('${id(n)}', '${status}', ${total}, '2026-11-20T12:00:00Z'${extra ? ", " + extra.split("|")[1] : ""})`);

  await ins(10, "paid", 10000, "utm_source, utm_medium, utm_campaign, utm_content|'meta', 'paid', 'bf', 'ad_1'");
  await ins(11, "approved", 5000, "utm_source, utm_medium, utm_campaign, utm_content|'meta', 'paid', 'bf', 'ad_1'");
  await ins(12, "pending", 7000, "utm_source, utm_medium, utm_campaign, utm_content|'meta', 'paid', 'bf', 'ad_1'");
  await ins(13, "paid", 3000, "utm_source, utm_medium, utm_campaign, utm_content|'meta', 'paid', 'bf', 'ad_2'");
  await ins(14, "paid", 2000, "referrer_domain|'google.com'");
  await ins(15, "paid", 900);
  await ins(16, "quote", 99999);
  await ins(17, "paid", 88888, `b2b_offer_id, utm_source, utm_medium, utm_campaign, utm_content|'${id(99)}', 'meta', 'paid', 'b2b_bf', 'ad_b2b'`);
  await ins(18, "pending", 4000, "utm_source|'google'");
  await ins(19, "paid", 55555, "origin|'mostruario'");
  await ins(20, "paid", 44444, `b2b_client_id, origin|'${id(98)}', 'vendedor'`);
  await ins(21, "pending", 12000, `b2b_client_id, utm_source|'${id(98)}', 'google'`);

  const out = await report.loadSalesByOrigin(run, { from: "2026-11-01", to: "2026-11-30", notArchivedSql: " AND o.archived_at IS NULL" });
  const row = (seg, canal, anuncio) => out[seg].rows.find((r) => r.canal === canal && r.anuncio === anuncio);

  // B2C
  assert.deepEqual([row("b2c", "meta", "ad_1").pedidos, row("b2c", "meta", "ad_1").pagos, row("b2c", "meta", "ad_1").naoPagos, row("b2c", "meta", "ad_1").valorPagoCents, row("b2c", "meta", "ad_1").valorNaoPagoCents], [3, 2, 1, 15000, 7000]);
  assert.equal(row("b2c", "meta", "ad_2").valorPagoCents, 3000);
  assert.equal(row("b2c", "google.com", "—").pagos, 1, "sem utm: o domínio do referrer é o canal");
  assert.equal(row("b2c", "direto", "—").valorPagoCents, 900);
  assert.equal(row("b2c", "google", "—").naoPagos, 1);
  assert.deepEqual([out.b2c.totals.pedidos, out.b2c.totals.valorPagoCents], [7, 15000 + 3000 + 2000 + 900]);
  // B2B (lojista, feito pelo site) separado
  assert.deepEqual([row("b2b", "meta", "ad_b2b").pagos, row("b2b", "meta", "ad_b2b").valorPagoCents], [1, 88888]);
  assert.deepEqual([row("b2b", "google", "—").naoPagos, row("b2b", "google", "—").valorNaoPagoCents], [1, 12000]);
  assert.deepEqual([out.b2b.totals.pedidos, out.b2b.totals.valorPagoCents], [2, 88888]);
  // fora: orçamento, mostruário e lançado pelo vendedor
  const all = JSON.stringify(out);
  assert.ok(!/99999|55555|44444/.test(all), "orçamento, mostruário e pedido do vendedor ficam de fora");
  assert.ok(!all.match(/@|cpf|email|phone/i), "sem dado pessoal");

  assert.equal((await report.loadSalesByOrigin(run, { from: "2026-12-01", to: "2026-12-05" })).b2c.rows.length, 0);
  assert.deepEqual(report.resolvePeriod("x", "y", new Date("2026-11-30T12:00:00Z")), { from: "2026-11-01", to: "2026-11-30" });
});

test("Vendas por origem: sem as colunas novas ou sem nenhuma coluna de origem, a tela ainda funciona", async () => {
  const basic = new PGlite();
  await basic.exec(BASE + read("sql/b2b/45b_origem_venda.sql") + `INSERT INTO orders (id, status, total_cents, created_at, utm_source) VALUES ('${id(30)}', 'paid', 1000, '2026-11-20T12:00:00Z', 'meta');`);
  const r1 = await report.loadSalesByOrigin(async (t, p = []) => (await basic.query(t, p)).rows, { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual([r1.b2c.rows[0].canal, r1.b2c.rows[0].anuncio], ["meta", "—"]);

  const bare = new PGlite();
  await bare.exec(BASE + `INSERT INTO orders (id, status, total_cents, created_at) VALUES ('${id(31)}', 'paid', 1000, '2026-11-20T12:00:00Z');`);
  const r2 = await report.loadSalesByOrigin(async (t, p = []) => (await bare.query(t, p)).rows, { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual([r2.b2c.rows[0].canal, r2.b2c.totals.valorPagoCents], ["direto", 1000]);
});

test("fiação: tela no admin com link, protegida pelo layout; checkout/CAPI/medição intactos", () => {
  assert.ok(read("src/app/admin/(protected)/layout.tsx").includes('href="/admin/vendas-por-origem"'));
  const page = read("src/app/admin/(protected)/vendas-por-origem/page.tsx");
  assert.ok(page.includes("loadSalesByOrigin") && !/customer|email|phone|cpf/i.test(page.replace(/\/\*[\s\S]*?\*\//g, "")), "tela sem dado pessoal");
  assert.ok(read("src/lib/purchase-event-server.ts").includes('segment: order.is_b2b ? "b2b" : "b2c"'), "Purchase do navegador leva o segmento (B2B conta)");
  assert.ok(read("src/app/api/b2b/orders/create/route.ts").includes("captureMetaCapi(request.headers, body.marketingConsent)"), "pedido B2B guarda o aceite para a CAPI");
  assert.ok(read("src/lib/meta-capi.ts").includes("already_sent"));
  assert.ok(at.cleanClickId("abc") === null && at.cleanClickId("ABCDEFGH_1-2.3") === "ABCDEFGH_1-2.3");
});
