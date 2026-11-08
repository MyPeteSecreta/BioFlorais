/*
 * Ordem dos produtos nas páginas de linha (07/11): Adulto e Pet seguem bioCommercialOrder (mais vendido); Baby começa
 * pelo Sono e o resto segue a ordem do catálogo; as demais linhas, a ordem do catálogo. B2B (mostruário) intocado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bioCommercialOrder, getProductsByLine } from "../src/lib/catalog/bio-products.ts";
import { rankedLineSlugs } from "../src/lib/b2b/displays.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// a mesma conta da página /linha/[slug] (ordenação estável: quem não está na lista mantém a ordem do catálogo)
const ordered = (slug) => {
  const order = bioCommercialOrder[slug]?.slugs ?? [];
  const rank = new Map(order.map((productSlug, index) => [productSlug, index]));
  return [...getProductsByLine(slug)].sort((a, b) => (rank.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.slug) ?? Number.MAX_SAFE_INTEGER)).map((p) => p.slug);
};

test("Baby: Sono primeiro; os demais na ordem do catálogo", () => {
  assert.deepEqual(bioCommercialOrder.baby.slugs, ["baby-floral-em-gotas-sono"]);
  const catalog = getProductsByLine("baby").map((p) => p.slug);
  const result = ordered("baby");
  assert.equal(result[0], "baby-floral-em-gotas-sono");
  assert.deepEqual(result.slice(1), catalog.filter((slug) => slug !== "baby-floral-em-gotas-sono"));

  const page = read("src/app/linha/[slug]/page.tsx");
  assert.ok(/if \(lineSlug === "baby"\) \{\s*return bioCommercialOrder\.baby\.slugs;\s*\}/.test(page), "a página usa a ordem da Baby");
});

test("B2B intocado: o mostruário continua com Baby na ordem do catálogo", () => {
  assert.deepEqual(rankedLineSlugs("baby"), getProductsByLine("baby").filter((p) => !/snack/i.test(p.category)).map((p) => p.slug));
});

test("home e barra de linhas do celular: Baby antes de Infantil e Kids (Luis, 07/11)", () => {
  const home = read("src/app/page.tsx");
  const rowTwo = home.slice(home.indexOf("const rowTwo = ["), home.indexOf("const rowThree"));
  assert.ok(rowTwo.indexOf('name: "Baby"') < rowTwo.indexOf('name: "Infantil"') && rowTwo.indexOf('name: "Infantil"') < rowTwo.indexOf('name: "Kids"'), "2ª fileira (computador)");

  const mobile = home.slice(home.indexOf("{/* 2ª LINHA (celular)"), home.indexOf("rowTwo.map"));
  assert.ok(mobile.indexOf('name="Baby"') > 0 && mobile.indexOf('name="Baby"') < mobile.indexOf('name="Infantil"') && mobile.indexOf('name="Infantil"') < mobile.indexOf('name="Kids"'), "2ª linha (celular)");

  const bar = read("src/components/layout/MobileLineBar.tsx");
  assert.ok(bar.indexOf('"name": "Baby"') < bar.indexOf('"name": "Infantil"') && bar.indexOf('"name": "Infantil"') < bar.indexOf('"name": "Kids"'), "barra de linhas");
});
