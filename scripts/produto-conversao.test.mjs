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

test("kit para frete grátis: menor quantidade que chega a R$ 70; some quando uma unidade já chega ou exige mais de 6", () => {
  assert.deepEqual(freeShippingKit(3590), { qty: 2, totalCents: 7180, eachCents: 3590 });
  assert.deepEqual(freeShippingKit(2990), { qty: 3, totalCents: 8970, eachCents: 2990 });
  assert.equal(freeShippingKit(7000), null);
  assert.equal(freeShippingKit(15000), null);
  assert.equal(freeShippingKit(1000), null, "7 unidades: não vale sugerir");
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
  // preço e Pix vêm do CampaignPrice (Esquenta/Black), com o mesmo data-testid e o "a menos"
  const campaignPrice = read("src/components/campaign/CampaignPrice.tsx");
  assert.ok(page.includes("<CampaignPrice") && page.includes("withPix") && campaignPrice.includes('data-testid="preco-pix"') && campaignPrice.includes("a menos") && page.includes("grid-cols-[minmax(0,1fr)]"));
  assert.ok(page.includes("trustBadges(") && page.includes("shortHowToUse(") && page.includes('id="como-usar"'));

  const actions = read("src/components/product/ProductPurchaseActions.tsx");
  assert.ok(actions.includes("barra-compra-fixa") && actions.includes("fixed inset-x-0 bottom-0") && actions.includes("lg:hidden"));
  assert.ok(actions.includes("kit-frete-gratis") && actions.includes("ProductShippingEstimate") && actions.includes("addProduct(product, count)"));

  const cart = read("src/components/cart/CartProvider.tsx");
  assert.ok(cart.includes("quantity: number = 1") && cart.includes('void trackEvent("sacola")'));
  assert.ok(cart.includes('void trackEvent(source === "sugestao" ? "sugestao_adicionada" : "sacola")'), "um evento por clique no produto (sugestão do carrinho conta à parte)");

  assert.ok(read("src/components/product/ProductShippingEstimate.tsx").includes("/api/shipping/quote"));
  assert.ok(read("src/components/product/ProductGallery.tsx").includes("foto-zoom") && read("src/components/product/ProductGallery.tsx").includes("Toque para ampliar"));
  assert.ok(read("src/components/layout/HideOnB2B.tsx").includes("hideOnProductMobile") && read("src/app/layout.tsx").includes("<HideOnB2B hideOnProductMobile>"));
});

test("frete grátis (R$ 70) pelo preço PRATICADO (Luis, 22/11): Esquenta e Black; dois florais a R$ 64,62 NÃO têm frete grátis; \"Leve N\" sai do preço praticado", async () => {
  const { freeShippingKitDisplay } = await import("../src/lib/product-conversion.ts");
  const { computeB2CShipping, freeShippingBaseCents } = await import("../src/lib/checkout/shipping-b2c.ts");
  const { campaignUnitPriceCents, CAMPAIGN_PHASES } = await import("../src/lib/campaign/esquenta-black.ts");
  const { readFileSync } = await import("node:fs");

  const esquenta = CAMPAIGN_PHASES.find((phase) => phase.key === "esquenta");
  const black = CAMPAIGN_PHASES.find((phase) => phase.key === "black");
  const slug = "adulto-floral-em-gotas-sono";
  const frete = (subtotalCents) => computeB2CShipping({ optionCostCents: 2200, cheapestCostCents: 2200, subtotalCents, uf: "SP" });

  // Esquenta: 35,90 -> 32,31. Dois = 64,62: NÃO chega a 70. Três = 96,93: chega.
  const e = campaignUnitPriceCents(3590, esquenta, slug);
  assert.equal(e, 3231);
  assert.equal(freeShippingBaseCents(2 * 3590, 2 * 3590 - 2 * e), 6462);
  assert.equal(frete(freeShippingBaseCents(2 * 3590, 2 * 3590 - 2 * e)).free, false, "2 florais com desconto por 64,62: sem frete grátis");
  assert.equal(frete(freeShippingBaseCents(3 * 3590, 3 * 3590 - 3 * e)).free, true);
  assert.deepEqual(freeShippingKitDisplay(3590, e), { qty: 3, eachCents: 3231, totalCents: 9693 });

  // Black: 35,90 -> 26,93 (25%). Três = 80,79 chega; dois = 53,86 não.
  const b = campaignUnitPriceCents(3590, black, slug);
  assert.equal(b, 2693);
  assert.equal(frete(freeShippingBaseCents(2 * 3590, 2 * 3590 - 2 * b)).free, false);
  assert.equal(frete(freeShippingBaseCents(3 * 3590, 3 * 3590 - 3 * b)).free, true);
  assert.deepEqual(freeShippingKitDisplay(3590, b), { qty: 3, eachCents: 2693, totalCents: 8079 });

  // O total do combo mostrado SEMPRE chega a R$ 70 (não promete o que o checkout não dá)
  for (const list of [2290, 2990, 3590, 3990, 4290, 5990]) {
    for (const phase of [null, esquenta, black]) {
      const sale = phase ? campaignUnitPriceCents(list, phase, slug) : list;
      const kit = freeShippingKitDisplay(list, sale);

      if (!kit) continue;

      assert.ok(kit.totalCents >= 7000 && (kit.qty - 1) * kit.eachCents < 7000, `${list}/${phase?.key}: menor quantidade que chega a 70 pelo preço praticado`);
      assert.equal(frete(freeShippingBaseCents(kit.qty * list, kit.qty * list - kit.totalCents)).free, true);
    }
  }

  // Sem campanha: o preço do site (2 x 35,90 = 71,80 dá frete grátis, como sempre)
  assert.deepEqual(freeShippingKitDisplay(3590, 3590), { qty: 2, eachCents: 3590, totalCents: 7180 });
  assert.deepEqual(freeShippingKitDisplay(3590, null), { qty: 2, eachCents: 3590, totalCents: 7180 });
  assert.equal(freeShippingKitDisplay(7000, 7000), null, "uma unidade já chega: sem combo");
  assert.deepEqual(freeShippingKitDisplay(8000, 6000), { qty: 2, eachCents: 6000, totalCents: 12000 }, "preço praticado abaixo de 70: precisa de 2");
  assert.equal(freeShippingKitDisplay(null, null), null);
  assert.equal(frete(3590).free, false);

  // Servidor, sacola e checkout usam a MESMA base; nenhum percentual na tela do combo.
  const order = readFileSync(new URL("../src/app/api/orders/create/route.ts", import.meta.url), "utf8");
  const cart = readFileSync(new URL("../src/app/carrinho/page.tsx", import.meta.url), "utf8");
  const checkout = readFileSync(new URL("../src/app/checkout/page.tsx", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/components/product/ProductPurchaseActions.tsx", import.meta.url), "utf8");

  assert.ok(order.includes("subtotalCents: campaign && campaignOfferResult ? campaignOfferResult.grossSubtotalCents : subtotalCents,"));
  assert.ok(cart.includes("freeShippingBaseOf(quote.grossSubtotalCents, quote.promotionDiscountCents ?? 0)"));
  assert.ok(checkout.includes("freeShippingBaseOf(quote.grossSubtotalCents, quote.promotionDiscountCents ?? 0)"));
  assert.ok(/subtotalCents: shippingBaseCents,\s+optionCostCents/.test(checkout) && checkout.includes("shippingBaseCents >= freeShippingThresholdCents"));
  assert.ok(tela.includes("freeShippingKitDisplay(priceCents, salePriceCents)") && !tela.includes("soma dos preços do site"));
  assert.ok(!/campaign??.percent|phase??.percent|ds*%s*(off|de desconto)/i.test(tela.replace(/10% de desconto/g, "")));
});
