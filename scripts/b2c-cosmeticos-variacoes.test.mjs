/*
 * B2C URGENTE: produto da linha COSMÉTICOS (humano) — Shampoo/Condicionador — não mostrava preço: o produto
 * é "par" (o preço do cabeçalho some) e só a linha Cosméticos Pet tinha a tabela de variações. Agora há
 * as variações Shampoo / Condicionador / Combo com preço e "Escolher".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { bioProducts } = await import("../src/lib/catalog/bio-products.ts");
const { cartItemDisplay } = await import("../src/lib/cart-display.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("catálogo: toda variação de Cosméticos, Cosméticos Pet e Home Care tem preço (o problema era a tela, não o dado)", () => {
  const lines = ["cosmeticos", "cosmeticos-pet", "home-care"];
  const rows = bioProducts.filter((product) => lines.includes(product.lineSlug));
  assert.ok(rows.length > 100);
  assert.deepEqual(rows.filter((product) => !(product.priceCents > 0)).map((product) => product.slug), []);
});

test("tela: Cosméticos (Shampoo/Condicionador) ganha as variações com preço, Escolher e Combo; Pet segue com a matriz própria", () => {
  const page = read("src/app/produto/[slug]/page.tsx");
  assert.ok(page.includes("const hasHumanPairMatrix") && page.includes('product.lineSlug === "cosmeticos"'));
  assert.ok(page.indexOf("hasHumanPairMatrix ? (") < page.indexOf("hasPet5lMatrix ? ("), "ramo novo antes da matriz pet");
  assert.ok(page.includes("variacoes-cosmeticos") && page.includes('mode="combo"'));
  // mostra só o que existe: sem "Indisponível" para shampoo sem condicionador
  const block = page.slice(page.indexOf("variacoes-cosmeticos"), page.indexOf(": hasPet5lMatrix ? ("));
  assert.ok(block.includes(".filter((row) => row.item)"), "só as linhas que existem entram (o ramo Indisponível é inalcançável)");
});

test("cada Shampoo/Condicionador de Cosméticos resolve variações a partir do catálogo, com nome completo na sacola", () => {
  const humans = bioProducts.filter((product) => product.lineSlug === "cosmeticos" && ["Shampoo", "Condicionador"].includes(product.category));
  assert.ok(humans.length >= 20);

  for (const product of humans) {
    const sameName = bioProducts.filter(
      (candidate) => candidate.lineSlug === "cosmeticos" && candidate.name === product.name && ["Shampoo", "Condicionador"].includes(candidate.category)
    );
    assert.ok(sameName.some((candidate) => candidate.category === product.category && candidate.priceCents > 0), product.slug);
  }

  const shampoo = bioProducts.find((product) => product.slug === "cosmeticos-shampoo-uso-diario");
  assert.equal(cartItemDisplay({ slug: shampoo.slug, name: shampoo.name }).name, "Shampoo Uso Diário · Cosméticos · 300 ml");
  const conditioner = bioProducts.find((product) => product.slug === "cosmeticos-condicionador-uso-diario");
  assert.equal(cartItemDisplay({ slug: conditioner.slug, name: conditioner.name }).name, "Condicionador Uso Diário · Cosméticos · 300 ml");
});
