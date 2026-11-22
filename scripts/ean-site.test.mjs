/*
 * EAN/NCM novos no site da Bio (22/11/2026): lista do código (src/lib/catalog/ean.ts) = SQL (sql/bio-b2b/ean_ncm_site.sql) = conferência;
 * dígito verificador; sem repetição NA MESMA LINHA (o Sabonete Líquido de 315 ml repete entre Cosméticos e Home Care de propósito);
 * feeds com o EAN novo e sem GTIN repetido; Aromatizador 240 ml; SQL só aditivo; e o SQL roda de verdade no PGlite (antes/depois).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import { bioProducts } from "../src/lib/catalog/bio-products.ts";
import { PRODUCT_EAN, eanFor, isValidGtin13 } from "../src/lib/catalog/ean.ts";
import { FEED_GTIN, buildFeedItem, renderGoogleFeedXml } from "../src/lib/feeds/products.ts";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const SQL = read("sql/bio-b2b/ean_ncm_site.sql");
const CHECK = read("sql/bio-b2b/ean_ncm_site_conferencia.sql");
const bySlug = new Map(bioProducts.map((p) => [p.slug, p]));
const entries = Object.entries(PRODUCT_EAN);

test("dígito verificador: todos os EAN são válidos; códigos errados são recusados; Kolin K e Viagens aplicados", () => {
  assert.equal(entries.length, 78);
  assert.ok(entries.every(([, e]) => isValidGtin13(e.ean)));
  assert.ok(entries.every(([, e]) => /^\d{4}\.\d{2}\.\d{2}$/.test(e.ncm)));
  assert.equal(new Set(entries.map(([, e]) => e.ean)).size, 70);
  assert.equal(isValidGtin13("7898552630554"), false);
  assert.equal(isValidGtin13("789855263055"), false);
  assert.equal(isValidGtin13(null), false);
  assert.equal(eanFor("baby-flormed-kolin-k"), "7898552630553");
  assert.equal(eanFor("pet-floral-em-gotas-viagens"), "7898552633905");
  assert.equal(eanFor("cosmeticos-creme-corpo-hidratante"), "7898552633585"); // PROVISÓRIO
  assert.equal(eanFor("cosmeticos-creme-corpo-rescue-sos"), "7898552633608"); // PROVISÓRIO
  assert.equal(eanFor("cosmeticos-pet-shampoo-rescue-sos"), "7898552630782");
  assert.equal(eanFor("nao-existe"), null);
});

test("todo slug da lista existe no catálogo; o SQL e a conferência têm exatamente os mesmos slugs, EAN e NCM do código", () => {
  for (const [slug, { ean, ncm }] of entries) {
    assert.ok(bySlug.has(slug), `slug ${slug} não existe no catálogo`);
    assert.ok(SQL.includes(`('${slug}', '${ean}', '${ncm}')`), `SQL sem ${slug}`);
    assert.ok(CHECK.includes(`('${slug}', '${ean}', '${ncm}')`), `conferência sem ${slug}`);
  }

  assert.equal((SQL.match(/^  \('[a-z0-9-]+', '\d{13}', '\d{4}\.\d{2}\.\d{2}'\)/gm) ?? []).length, 78);
  assert.equal((CHECK.match(/^  \('[a-z0-9-]+', '\d{13}', '\d{4}\.\d{2}\.\d{2}'\)/gm) ?? []).length, 78);
});

test("EAN repetido só entre as duas linhas do Sabonete Líquido (Cosméticos × Home Care); nunca dentro da mesma linha", () => {
  const groups = new Map();

  for (const [slug, { ean }] of entries) {
    const p = bySlug.get(slug);
    const key = `${p.lineSlug}|${ean}`;

    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  assert.ok([...groups.values()].every((n) => n === 1), "dois produtos da mesma linha com o mesmo EAN");

  const byEan = new Map();

  for (const [slug, { ean }] of entries) byEan.set(ean, [...(byEan.get(ean) ?? []), bySlug.get(slug)]);

  for (const [ean, list] of byEan) {
    if (list.length === 1) continue;

    assert.equal(list.length, 2, ean);
    assert.ok(list.every((p) => p.category === "Sabonete Líquido"), `${ean} repetido fora do sabonete`);
    assert.deepEqual(list.map((p) => p.lineSlug).sort(), ["cosmeticos", "home-care"], ean);
    assert.equal(list[0].name, list[1].name, ean);
  }
});

test("Aromatizador Spray = 240 ml (não existe 50 g); Creme Mãos continua 50g", () => {
  const aro = bioProducts.filter((p) => p.category === "Aromatizador Spray");

  assert.equal(aro.length, 5);
  assert.ok(aro.every((p) => p.content === "240 ml"));
  assert.ok(bioProducts.filter((p) => p.category === "Creme Mãos").every((p) => p.content === "50g"));
  assert.ok(SQL.includes("SET \"weight_grams\" = 300"));
  assert.ok(aro.every((p) => SQL.includes(`'${p.slug}'`)));
});

test("SQL: só aditivo, em transação, com guarda de contagem e 'ok' no fim; sem DROP, DELETE, TRUNCATE nem mexer em preço/nome/slug", () => {
  const sql = SQL.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");

  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "ean"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "ncm"/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS "bio_products_line_ean_unique" ON "products" \(coalesce\("line_slug", ''\), "ean"\)/);
  assert.match(sql, /ok_count <> 78/);
  assert.match(sql, /SELECT 'ok' AS resultado;/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /SET\s+"?(price_cents|name|slug|active|image_url)"?\s*=/i);
  assert.ok(/^[\x00-\x7F]*$/.test(SQL) && /^[\x00-\x7F]*$/.test(CHECK), "arquivos em ASCII");
});

test("o código não depende da coluna: o schema do Drizzle NÃO ganhou ean/ncm (push antes do SQL não quebra nada)", () => {
  assert.doesNotMatch(read("src/lib/db/schema.ts"), /\bean\b|"ncm"|ncm:/);
});

test("feeds: o EAN novo vale sobre a planilha antiga, sem GTIN repetido no feed do Google, Home Care fora do feed", () => {
  assert.equal(FEED_GTIN["cosmeticos-sabonete-liquido-refrescante"], "7898919558629"); // antes 7898919558179
  assert.equal(FEED_GTIN["cosmeticos-sabonete-liquido-relaxante"], "7898919558636"); // antes 7898919558193
  assert.equal(FEED_GTIN["cosmeticos-pet-shampoo-rescue-sos"], "7898552630782");
  assert.equal(FEED_GTIN["baby-flormed-kolin-k"], "7898552630553");

  const img = () => "/p.jpg";
  const items = bioProducts.map((p) => buildFeedItem(p, "https://www.bioflorais.com.br", img, Date.parse("2026-12-10T12:00:00-03:00"))).filter(Boolean);
  const gtins = items.map((i) => i.gtin).filter(Boolean);

  assert.equal(new Set(gtins).size, gtins.length, "GTIN repetido no feed");
  assert.ok(items.every((i) => !/home-care/.test(i.link)), "Home Care não vai ao feed");
  assert.ok(gtins.every(isValidGtin13));

  const kolin = items.find((i) => i.link.endsWith("/baby-flormed-kolin-k"));

  assert.ok(kolin);
  assert.match(renderGoogleFeedXml([kolin], "https://x"), /<g:gtin>7898552630553<\/g:gtin>\n\s+<g:identifier_exists>yes<\/g:identifier_exists>/);
});

test("PGlite: o SQL roda (antes sem colunas, depois com 78 EAN e 5 aromatizadores em 300 g), é idempotente e a conferência bate", async () => {
  const pg = new PGlite();

  await pg.exec(`CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, name text NOT NULL, line_slug text, category text,
    price_cents integer NOT NULL, weight_grams integer, length_cm integer, width_cm integer, height_cm integer,
    active boolean NOT NULL DEFAULT true, image_url text, created_at timestamp DEFAULT now())`);

  for (const p of bioProducts) {
    const weight = p.category === "Aromatizador Spray" ? 50 : 100;

    await pg.query("INSERT INTO products (slug, name, line_slug, category, price_cents, weight_grams) VALUES ($1,$2,$3,$4,$5,$6)", [p.slug, p.name, p.lineSlug, p.category, p.priceCents ?? 1000, weight]);
  }

  const check = async () => JSON.parse((await pg.query(CHECK)).rows[0].conferencia);
  const before = await check();

  assert.equal(before.colunas_ean_ncm, false);
  assert.equal(before.produtos_encontrados, 78);
  assert.equal(before.com_o_ean_certo, 0);
  assert.equal(before.aromatizador_com_300g, 0);

  const run = async () => (await pg.exec(SQL)).at(-1).rows[0].resultado;

  assert.equal(await run(), "ok");

  const after = await check();

  assert.equal(after.colunas_ean_ncm, true);
  assert.equal(after.com_o_ean_certo, 78);
  assert.equal(after.aromatizador_com_300g, 5);
  assert.deepEqual(after.slugs_nao_encontrados, []);
  assert.deepEqual(after.ean_diferente_do_esperado, []);
  assert.deepEqual(after.ean_repetido_na_mesma_linha, []);

  assert.equal(await run(), "ok", "idempotente");

  // nada mais mudou
  const outros = await pg.query("SELECT count(*)::int AS n FROM products WHERE weight_grams = 100");

  assert.equal(outros.rows[0].n, bioProducts.length - 5);

  // a guarda desfaz tudo se um slug não existir
  await pg.query("DELETE FROM products WHERE slug = 'baby-flormed-kolin-k'");
  await pg.query("UPDATE products SET ean = NULL, ncm = NULL");
  await assert.rejects(() => pg.exec(SQL), /esperava 78/);
  await pg.exec("ROLLBACK"); // no Neon a sessão termina e a transação aberta é desfeita sozinha

  const gravado = await pg.query("SELECT count(*)::int AS n FROM products WHERE ean IS NOT NULL");

  assert.equal(gravado.rows[0].n, 0, "nada gravado quando a guarda falha");
});
