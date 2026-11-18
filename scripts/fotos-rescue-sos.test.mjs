/*
 * Fotos dos produtos "S.O.S." (18/11): o nome não bate com a pasta "rescue-sos" e o slug só era reduzido nos cosméticos
 * humanos, então o Sabonete S.O.S. do Home Care e os 7 S.O.S. Pet ficavam sem foto. Nenhum outro produto muda de foto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { getProductGallery } = await import("../src/lib/catalog/product-images.server.ts");
const { bioProducts } = await import("../src/lib/catalog/bio-products.ts");

const bySlug = (slug) => bioProducts.find((p) => p.slug === slug);

test("Sabonete S.O.S. do Home Care e os S.O.S. Pet ganham a foto da própria pasta rescue-sos", () => {
  assert.deepEqual(getProductGallery(bySlug("home-care-sabonete-liquido-rescue-sos")), ["/products/home-care/sabonete-liquido/rescue-sos/Rescue.jpg"]);
  assert.deepEqual(getProductGallery(bySlug("cosmeticos-sabonete-liquido-rescue-sos")), ["/products/cosmeticos-humanos/sabonete-liquido/rescue-sos/rescue-sos.png"]);

  for (const slug of [
    "cosmeticos-pet-shampoo-rescue-sos",
    "cosmeticos-pet-condicionador-rescue-sos",
    "cosmeticos-pet-shampoo-rescue-sos-5l",
    "cosmeticos-pet-perfume-spray-rescue-sos-500ml",
    "cosmeticos-pet-floral-de-ambiente-rescue-sos",
  ]) {
    const gallery = getProductGallery(bySlug(slug));
    assert.ok(gallery.length > 0 && gallery[0].includes("/rescue-sos/"), slug);
  }
});

test("a página do produto usa a mesma redução do slug", () => {
  const page = readFileSync(new URL("../src/app/produto/[slug]/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('.replace(/^cosmeticos-pet-(shampoo|condicionador|perfume-spray|floral-de-ambiente)-/, "")'));
  assert.ok(page.includes('.replace(/^home-care-sabonete-liquido-/, "")') && page.includes('.replace(/-(5l|500ml)$/, "")'));
});
