/*
 * Página de produto (B2C, celular): preço no Pix, kit "leve N e ganhe frete grátis", selos de confiança sem promessa de saúde,
 * "como usar" curto, barra fixa "Adicionar à sacola" e UM evento "sacola" por clique (mede a decisão, não a quantidade).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { freeShippingKit, pixPrice, shortHowToUse, trustBadges } from "../src/lib/product-conversion.ts";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

test("Pix: o valor e a economia do desconto real do checkout (4%), nunca o percentual", () => {
  assert.deepEqual(pixPrice(3590), { priceCents: 3446, savingCents: 144 });
  assert.equal(pixPrice(null), null);
  assert.equal(pixPrice(0), null);
});

test("kit para frete grátis: menor quantidade que chega a R$ 100; some quando uma unidade já chega ou exige mais de 6", () => {
  assert.deepEqual(freeShippingKit(3590), { qty: 3, totalCents: 10770, eachCents: 3590 });
  assert.deepEqual(freeShippingKit(2990), { qty: 4, totalCents: 11960, eachCents: 2990 });
  assert.equal(freeShippingKit(10000), null);
  assert.equal(freeShippingKit(15000), null);
  assert.equal(freeShippingKit(1200), null, "8 unidades: não vale sugerir");
  assert.equal(freeShippingKit(null), null);
});

test("selos: sem álcool e flores brasileiras só nos florais em gotas das linhas que já usam a frase; nunca promessa de saúde", () => {
  const floral = trustBadges({ lineSlug: "adulto", category: "Floral em gotas" }).map((b) => b.label);
  assert.deepEqual(floral, ["100% sem álcool", "Flores brasileiras", "Pagamento seguro", "Troca e devolução"]);

  const cosmetic = trustBadges({ lineSlug: "cosmeticos", category: "Shampoo" }).map((b) => b.label);
  assert.ok(!cosmetic.includes("100% sem álcool") && cosmetic.includes("Bio Florais desde 1997"));
  assert.ok(!trustBadges({ lineSlug: "dose-unica", category: "Floral dose única" }).some((b) => b.key === "sem-alcool"));

  for (const badge of [...trustBadges({ lineSlug: "pet", category: "Floral em gotas" }), ...cosmetic]) assert.ok(!/trata|cura|alivia|remédio|medic/i.test(badge.label));
});

test("'como usar' curto: primeira frase, até ~120 caracteres", () => {
  assert.equal(shortHowToUse("Tomar 4 gotas três vezes ao dia. O uso pode ser sub-lingual ou diluído em água."), "Tomar 4 gotas três vezes ao dia.");
  assert.equal(shortHowToUse(""), null);
  assert.equal(shortHowToUse(undefined), null);
  assert.ok(shortHowToUse("a".repeat(30) + " " + "palavra ".repeat(30)).endsWith("…"));
});

test("telas: preço e Pix acima da dobra, barra fixa, kit, frete por CEP, zoom, eventos e rodapé sem barras concorrentes", () => {
  const page = read("src/app/produto/[slug]/page.tsx");
  assert.ok(page.includes('data-testid="preco-pix"') && page.includes("a menos") && page.includes("grid-cols-[minmax(0,1fr)]"));
  assert.ok(page.includes("trustBadges(") && page.includes("shortHowToUse(") && page.includes('id="como-usar"'));

  const actions = read("src/components/product/ProductPurchaseActions.tsx");
  assert.ok(actions.includes("barra-compra-fixa") && actions.includes("fixed inset-x-0 bottom-0") && actions.includes("lg:hidden"));
  assert.ok(actions.includes("kit-frete-gratis") && actions.includes("ProductShippingEstimate") && actions.includes("addProduct(product, count)"));

  const cart = read("src/components/cart/CartProvider.tsx");
  assert.ok(cart.includes("quantity: number = 1") && cart.includes('void trackEvent("sacola")'));
  assert.equal((cart.match(/void trackEvent\("sacola"\)/g) ?? []).length, 2, "um evento por clique (produto e combo)");

  assert.ok(read("src/components/product/ProductShippingEstimate.tsx").includes("/api/shipping/quote"));
  assert.ok(read("src/components/product/ProductGallery.tsx").includes("foto-zoom") && read("src/components/product/ProductGallery.tsx").includes("Toque para ampliar"));
  assert.ok(read("src/components/layout/HideOnB2B.tsx").includes("hideOnProductMobile") && read("src/app/layout.tsx").includes("<HideOnB2B hideOnProductMobile>"));
});
