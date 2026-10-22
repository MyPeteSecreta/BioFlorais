/*
 * Rodada 17 — origem da venda em todo pedido (B2C e B2B): captura first-touch (utm_* + domínio do referrer, 30 dias,
 * sem dado pessoal), gravação no pedido (colunas aditivas do SQL 45b, tolerando a ausência), origem no admin e CSV.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const at = await import("../src/lib/attribution.ts");
const server = await import("../src/lib/attribution-server.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const ORDER = "10000000-0000-4000-8000-000000000001";

function fakeEnv({ search = "", referrer = "", hostname = "www.bioflorais.com.br", secure = true, cookie = "" } = {}) {
  const writes = [];
  const doc = {
    set cookie(value) {
      writes.push(value);
      cookie = value.split(";")[0];
    },
    get cookie() {
      return cookie;
    },
  };
  return { env: { search, referrer, hostname, doc, secure }, writes };
}

test("captura: utm_* e domínio do referrer; cookie próprio Lax/Secure/30 dias; sem dado pessoal", () => {
  const { env, writes } = fakeEnv({ search: "?utm_source=instagram&utm_medium=organic&utm_campaign=2110_rotina&oppref=abc", referrer: "https://l.instagram.com/?u=https%3A%2F%2Fx&fbclid=ZZ" });
  assert.equal(at.captureAttribution(env), "set");
  assert.equal(writes.length, 1);
  assert.match(writes[0], /^bio_origem=/);
  assert.match(writes[0], /Max-Age=2592000; Path=\/; SameSite=Lax; Secure$/);
  const saved = at.readAttributionCookie(writes[0].split(";")[0]);
  assert.deepEqual(saved, { utm_source: "instagram", utm_medium: "organic", utm_campaign: "2110_rotina", referrer_domain: "l.instagram.com" });
  // nada além dos 4 campos (oppref, fbclid, caminho do referrer e query ficam de fora)
  assert.ok(!/oppref|fbclid|abc|ZZ|%2F/.test(decodeURIComponent(writes[0].split(";")[0].replace("bio_origem=", ""))));
});

test("referrer: só o domínio (sem www, sem caminho/query); site próprio e esquemas inválidos viram null", () => {
  assert.equal(at.referrerDomain("https://www.google.com/search?q=floral&x=1"), "google.com");
  assert.equal(at.referrerDomain("https://chatgpt.com/c/abc"), "chatgpt.com");
  assert.equal(at.referrerDomain("https://www.bioflorais.com.br/linha/adulto", "bioflorais.com.br"), null, "navegação interna");
  assert.equal(at.referrerDomain("android-app://com.instagram.android"), null);
  assert.equal(at.referrerDomain("não é url"), null);
  assert.equal(at.referrerDomain(""), null);
});

test("first-touch: a primeira visita com informação fixa a origem; visita seguinte não troca; direta não trava", () => {
  const { env, writes } = fakeEnv({ search: "", referrer: "" });
  assert.equal(at.captureAttribution(env), "none", "visita direta não grava nada");
  assert.equal(writes.length, 0);

  env.search = "?utm_source=google&utm_medium=cpc&utm_campaign=busca";
  assert.equal(at.captureAttribution(env), "set", "primeira visita com informação fixa");
  const first = env.doc.cookie;

  env.search = "?utm_source=facebook&utm_medium=social";
  env.referrer = "https://instagram.com/";
  assert.equal(at.captureAttribution(env), "kept", "não sobrescreve");
  assert.equal(env.doc.cookie, first);
  assert.equal(at.readAttributionCookie(env.doc.cookie).utm_source, "google");
});

test("só referrer externo (sem utm) também é origem; campos são sanitizados e limitados", () => {
  const { env } = fakeEnv({ referrer: "https://www.google.com/" });
  assert.equal(at.captureAttribution(env), "set");
  assert.deepEqual(at.readAttributionCookie(env.doc.cookie), { utm_source: null, utm_medium: null, utm_campaign: null, referrer_domain: "google.com" });

  assert.equal(at.cleanField('  <script>"x"</script>\n'), "scriptx/script");
  assert.equal(at.cleanField("a".repeat(300)).length, 100);
  assert.equal(at.cleanField("   "), null);
  assert.equal(at.readAttributionCookie("bio_origem=%7Bquebrado", false), null);
  assert.equal(at.readAttributionCookie(`x=1; bio_origem=${encodeURIComponent(JSON.stringify({ s: "g", m: null, c: null, r: null }))}; y=2`).utm_source, "g");
  assert.equal(at.readAttributionCookie("a=1; b=2"), null);
});

test("origem formatada para o admin: instagram / organic / 2110_rotina; sem nada = Direto", () => {
  assert.equal(at.formatOrigin({ utm_source: "instagram", utm_medium: "organic", utm_campaign: "2110_rotina", referrer_domain: "instagram.com" }), "instagram / organic / 2110_rotina");
  assert.equal(at.formatOrigin({ utm_source: null, utm_medium: null, utm_campaign: null, referrer_domain: "google.com" }), "google.com / — / —");
  assert.equal(at.formatOrigin(null), "Direto");
  assert.equal(at.formatOrigin(at.EMPTY_ATTRIBUTION), "Direto");
});

test("servidor: grava a origem no pedido (só se vazio), tolera a ausência das colunas; admin lê de volta", async () => {
  // sem as colunas (SQL 45b não aplicado): nada quebra
  const old = new PGlite();
  await old.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), status text, payment_method text, total_cents int); INSERT INTO orders (id, status) VALUES ('${ORDER}', 'pending');`);
  const runOld = async (text, params = []) => (await old.query(text, params)).rows;
  const attr = { utm_source: "instagram", utm_medium: "organic", utm_campaign: "2110_rotina", referrer_domain: "instagram.com" };
  assert.equal(await server.attachAttribution(runOld, ORDER, attr), false);
  assert.equal(await server.loadOrderAttribution(runOld, ORDER), null);

  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), status text, payment_method text, total_cents int, archived_at timestamp);
    INSERT INTO orders (id, status, payment_method, total_cents) VALUES ('${ORDER}', 'paid', 'pix', 25870),
      ('10000000-0000-4000-8000-000000000002', 'pending', 'pix', 9990);`);
  await pg.exec(read("sql/b2b/45b_origem_venda.sql"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  assert.equal(await server.attachAttribution(run, ORDER, attr), true);
  assert.equal(await server.attachAttribution(run, ORDER, { ...attr, utm_source: "outro" }), false, "não sobrescreve");
  assert.equal(await server.attachAttribution(run, "10000000-0000-4000-8000-000000000002", null), false, "sem cookie = direto");
  assert.deepEqual(await server.loadOrderAttribution(run, ORDER), attr);
  assert.equal(await server.loadOrderAttribution(run, "10000000-0000-4000-8000-000000000002"), null);

  // CSV: cabeçalho, origem formatada, "direto", BOM e proteção contra fórmula
  const csv = await server.buildOrdersOriginCsv(run, { notArchivedSql: " AND o.archived_at IS NULL" });
  const lines = csv.replace("﻿", "").trim().split("\r\n");
  assert.equal(lines[0], '"pedido","data","status","pagamento","total_reais","utm_source","utm_medium","utm_campaign","referrer_domain","origem"');
  assert.ok(lines.some((line) => line.includes(ORDER) && line.includes('"258.70"') && line.includes('"instagram / organic / 2110_rotina"')));
  assert.ok(lines.some((line) => line.includes("10000000-0000-4000-8000-000000000002") && line.endsWith('"direto"')));
  assert.equal(server.csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(server.csvCell('a"b'), '"a""b"');

  // CSV também funciona sem as colunas de origem
  const csvOld = await server.buildOrdersOriginCsv(runOld);
  assert.ok(csvOld.includes(ORDER) && csvOld.includes('"direto"'));
});

test("45a/45b: aditivo, idempotente, linha final ok; conferência antes/depois e pelo slug adulto-%", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text);
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid);
    INSERT INTO orders VALUES ('${ORDER}', 'paid');
    INSERT INTO products VALUES ('20000000-0000-4000-8000-000000000001', 'adulto-floral-em-gotas-sono'), ('20000000-0000-4000-8000-000000000002', 'pet-floral-em-gotas-medo');
    INSERT INTO order_items (order_id, product_id) VALUES ('${ORDER}', '20000000-0000-4000-8000-000000000001');`);
  const conf = read("sql/b2b/45a_origem_venda_conferencia_one_shot.sql");
  const before = (await pg.query(conf)).rows[0].conferencia_origem_venda;
  assert.equal(before.colunas_origem_existentes, 0);
  assert.equal(before.produtos_slug_adulto, 1);
  assert.equal(before.pedidos_com_item_adulto, 1);
  assert.equal(before.pedidos_adulto_com_origem, 0);

  const sql = read("sql/b2b/45b_origem_venda.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.equal((await pg.exec(sql)).at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);
  await pg.exec(`UPDATE orders SET utm_source = 'instagram', referrer_domain = 'instagram.com' WHERE id = '${ORDER}'`);
  const after = (await pg.query(conf)).rows[0].conferencia_origem_venda;
  assert.equal(after.colunas_origem_existentes, 4);
  assert.equal(after.colunas_origem_existentes, after.colunas_origem_esperadas);
  assert.equal(after.pedidos_com_origem, 1);
  assert.equal(after.pedidos_adulto_com_origem, 1);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(conf.replace(/--.*$/gm, "")), "conferência é somente leitura");
});

test("ligações: captura no layout, gravação nos dois pedidos, origem e exportação no admin, política e banner", () => {
  assert.ok(read("src/app/layout.tsx").includes("<AttributionCapture />"));
  assert.ok(read("src/app/layout.tsx").includes("<CookieBanner />") && read("src/app/layout.tsx").includes("<OppRefCapture />"));
  const capture = read("src/components/consent/AttributionCapture.tsx");
  assert.ok(capture.includes("isPixelPath(pathname)"), "nunca no admin nem na área do vendedor");
  assert.ok(!/history\.|replaceState|pushState|location\.(replace|assign|href\s*=)/.test(capture + read("src/lib/attribution.ts")), "não mexe na URL");
  assert.ok(!/hasMarketingConsent|readConsent|consentChoiceOf/.test(capture + read("src/lib/attribution.ts")), "não depende do aceite de marketing");

  const b2c = read("src/app/api/orders/create/route.ts");
  assert.ok(b2c.includes("attachAttribution(getAppSqlRunner(), order.id, attributionFromRequest("));
  const b2b = read("src/app/api/b2b/orders/create/route.ts");
  const launchedBlock = b2b.slice(b2b.indexOf("if (!launched && !asQuote) {"));
  assert.ok(launchedBlock.slice(0, 900).includes("attachAttribution("), "B2B: só o pedido do próprio lojista");

  const detail = read("src/app/admin/(protected)/pedidos/[id]/page.tsx");
  assert.ok(detail.includes("Origem: {origin}") && detail.includes("loadOrderAttribution"));
  const list = read("src/app/admin/(protected)/pedidos/page.tsx");
  assert.ok(list.includes("/api/admin/orders/export"));
  const route = read("src/app/api/admin/orders/export/route.ts");
  assert.ok(route.includes("isAdminRequest(request)") && route.includes("text/csv"));

  for (const file of ["src/app/cookies/page.tsx", "src/app/privacidade/page.tsx"]) {
    const page = read(file).replace(/\s+/g, " ");
    assert.ok(page.includes("<code>bio_origem</code>") && page.includes("não dependem do consentimento de marketing"), file);
    assert.ok(page.includes("não é compartilhado com terceiros"), file);
  }
  assert.ok(!read("src/components/consent/CookieBanner.tsx").includes("Sem cookies"), "Análise não diz mais 'Sem cookies'");
});
