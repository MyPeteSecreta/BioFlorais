/*
 * Fotos do Pet (21/11): a busca da pasta varria cosmeticos-pet inteira e pegava a primeira pasta com o nome da situação
 * (condicionador vem antes de shampoo), então shampoos (8 + 8 de 5 L), perfumes spray (10) e florais de ambiente (5) mostravam
 * a foto do CONDICIONADOR. Agora a pasta da categoria (shampoo, perfume-spray, floral-de-ambiente...) manda, como nos humanos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { getProductGallery } = await import("../src/lib/catalog/product-images.server.ts");
const { bioProducts } = await import("../src/lib/catalog/bio-products.ts");

const norm = (v) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

test("cosméticos Pet e humanos usam a foto da pasta da PRÓPRIA categoria", () => {
  let checked = 0;
  for (const p of bioProducts.filter((item) => item.lineSlug === "cosmeticos-pet" || item.lineSlug === "cosmeticos")) {
    const first = getProductGallery(p)[0];
    if (!first) continue;
    if (/\/products\/cosmeticos-(pet|humanos)\/[^/]+\//.test(first) && !/creme|sabonete/.test(first)) {
      assert.ok(first.includes(`/${norm(p.category)}/`), `${p.slug} → ${first}`);
      checked += 1;
    }
  }
  assert.ok(checked > 50, `só ${checked} conferidos`);
});

test("o shampoo Pet não mostra o condicionador", () => {
  const shampoo = bioProducts.find((p) => p.slug === "cosmeticos-pet-shampoo-agressividade");
  const cond = bioProducts.find((p) => p.slug === "cosmeticos-pet-condicionador-agressividade");
  assert.ok(getProductGallery(shampoo)[0].includes("/shampoo/agressividade/"));
  assert.ok(getProductGallery(cond)[0].includes("/condicionador/agressividade/"));
});
