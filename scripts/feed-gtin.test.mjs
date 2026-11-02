/*
 * GTIN no feed do Google Merchant (/feeds/google.xml): vem da planilha de EAN (aba Casados), um por slug, com dígito verificador válido,
 * só em slugs que existem no catálogo; quem tem GTIN sai com g:gtin + identifier_exists=yes, quem não tem segue com identifier_exists=no.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { bioProducts } from "../src/lib/catalog/bio-products.ts";
import { GTIN_BY_SLUG } from "../src/lib/feeds/gtin-data.ts";
import { buildFeedItem, renderGoogleFeedXml, renderMetaFeedCsv } from "../src/lib/feeds/products.ts";

const checkDigitOk = (ean) => /^\d{13}$/.test(ean) && (10 - ([...ean.slice(0, 12)].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10)) % 10 === Number(ean[12]);
const items = bioProducts.map((product) => buildFeedItem(product, "https://www.bioflorais.com.br", () => "/img.jpg")).filter(Boolean);

test("GTIN: 126 slugs, todos EAN-13 com dígito verificador válido, sem repetir e só de produtos do catálogo", () => {
  const entries = Object.entries(GTIN_BY_SLUG);
  const slugs = new Set(bioProducts.map((product) => product.slug));

  assert.equal(entries.length, 126);
  assert.ok(entries.every(([, ean]) => checkDigitOk(ean)));
  assert.equal(new Set(entries.map(([, ean]) => ean)).size, entries.length, "nenhum EAN em dois produtos");
  assert.ok(entries.every(([slug]) => slugs.has(slug)), "todo slug existe no catálogo");
  assert.ok(entries.every(([, ean]) => ean.startsWith("789")), "prefixo do Brasil");
});

test("de fora: 'conferir' na planilha e The Cat e Colty (outra marca); duplicados por tamanho foram para o produto do volume certo", () => {
  for (const slug of ["adulto-floral-em-gotas-reequilibrio-dos-chakras", "cosmeticos-pet-finalizador-silicone-finalizador"]) assert.equal(GTIN_BY_SLUG[slug], undefined, slug);
  assert.ok(!Object.values(GTIN_BY_SLUG).includes("7898552633103"), "The Cat e Colty fica de fora");

  assert.equal(GTIN_BY_SLUG["cosmeticos-pet-shampoo-filhotes"], "7898552630768"); // 500 ml
  assert.equal(GTIN_BY_SLUG["cosmeticos-pet-shampoo-filhotes-5l"], "7898552631079"); // 5 L
  assert.equal(GTIN_BY_SLUG["cosmeticos-pet-perfume-spray-filhotes"], "7898552630911"); // 120 ml
  assert.equal(GTIN_BY_SLUG["cosmeticos-pet-perfume-spray-filhotes-500ml"], "7898552631222");
  assert.equal(GTIN_BY_SLUG["cosmeticos-sabonete-liquido-hidratante"], "7898919558605"); // Bio Florais
  assert.equal(GTIN_BY_SLUG["home-care-sabonete-liquido-hidratante"], "7898919558155"); // It's Blossom
  assert.equal(GTIN_BY_SLUG["adulto-floral-em-gotas-sensacao-de-ansiedade"], "7898919557318", "linha da planilha com slug errado foi achada pelo nome");
});

test("feed do Google: g:gtin + identifier_exists=yes em quem tem GTIN; identifier_exists=no nos demais; Meta CSV com a coluna gtin", () => {
  const withGtin = items.filter((item) => item.gtin);
  const without = items.filter((item) => !item.gtin);

  assert.ok(withGtin.length > 80, `muitos itens do feed têm GTIN (${withGtin.length} de ${items.length})`);
  assert.ok(without.length > 0);
  // o GTIN é por slug (o id do feed pode ser a versão curta do slug)
  assert.ok(withGtin.every((item) => GTIN_BY_SLUG[item.link.split("/produto/")[1]] === item.gtin));

  const xml = renderGoogleFeedXml(items, "https://www.bioflorais.com.br");
  assert.equal((xml.match(/<g:gtin>/g) ?? []).length, withGtin.length);
  assert.equal((xml.match(/<g:identifier_exists>yes<\/g:identifier_exists>/g) ?? []).length, withGtin.length);
  assert.equal((xml.match(/<g:identifier_exists>no<\/g:identifier_exists>/g) ?? []).length, without.length);
  assert.ok(xml.includes("<g:gtin>7898552630768</g:gtin>\n      <g:identifier_exists>yes</g:identifier_exists>"), "gtin e identifier_exists lado a lado");

  const csv = renderMetaFeedCsv(items);
  assert.ok(csv.includes("7898552630768"));
});
