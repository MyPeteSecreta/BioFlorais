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

test("Leve 2 e ganhe frete grátis com preço da campanha (22/11): a quantidade e a regra são as do checkout (soma pelo preço do SITE >= R$ 70)", async () => {
  const { freeShippingKitDisplay } = await import("../src/lib/product-conversion.ts");
  const { computeB2CShipping } = await import("../src/lib/checkout/shipping-b2c.ts");
  const { campaignUnitPriceCents, CAMPAIGN_PHASES } = await import("../src/lib/campaign/esquenta-black.ts");
  const { readFileSync } = await import("node:fs");

  const esquenta = CAMPAIGN_PHASES.find((phase) => phase.key === "esquenta");
  const black = CAMPAIGN_PHASES.find((phase) => phase.key === "black");

  for (const [phase, unit] of [[esquenta, 3231], [black, 2693]]) {
    assert.equal(campaignUnitPriceCents(3590, phase, "adulto-floral-em-gotas-sono"), unit);

    const kit = freeShippingKitDisplay(3590, unit);

    assert.equal(kit.qty, 2, "a quantidade vem do preço do site (igual ao checkout)");
    assert.equal(kit.totalCents, 2 * unit, "o total é o que o cliente paga");
    assert.equal(kit.siteTotalCents, 7180);
    assert.equal(kit.onSale, true);
    assert.ok(kit.totalCents < 7000 && kit.siteTotalCents >= 7000, "o caso do Luis: 64,62 < 70, mas a base do frete é 71,80");

    // O checkout (servidor) olha o subtotal do SITE: com 2 unidades o frete da modalidade econômica é grátis.
    const frete = computeB2CShipping({ optionCostCents: 2200, cheapestCostCents: 2200, subtotalCents: kit.siteTotalCents, uf: "SP" });

    assert.equal(frete.free, true);
    assert.equal(frete.customerCents, 0);

    // 1 unidade (site 35,90) NÃO dá frete grátis.
    assert.equal(computeB2CShipping({ optionCostCents: 2200, cheapestCostCents: 2200, subtotalCents: 3590, uf: "SP" }).free, false);
  }

  // Sem campanha: o mesmo valor do site, sem "onSale".
  assert.deepEqual(freeShippingKitDisplay(3590, 3590), { qty: 2, eachCents: 3590, totalCents: 7180, siteTotalCents: 7180, onSale: false });
  assert.deepEqual(freeShippingKitDisplay(3590, null), { qty: 2, eachCents: 3590, totalCents: 7180, siteTotalCents: 7180, onSale: false });
  assert.equal(freeShippingKitDisplay(7000, 6000), null, "uma unidade já chega: sem combo");
  assert.equal(freeShippingKitDisplay(null, null), null);

  // A tela usa a função nova, explica a base e nunca mostra percentual.
  const tela = readFileSync(new URL("../src/components/product/ProductPurchaseActions.tsx", import.meta.url), "utf8");

  assert.ok(tela.includes("freeShippingKitDisplay(priceCents, salePriceCents)"));
  assert.ok(tela.includes("O frete grátis vale pela soma dos preços do site"));
  assert.ok(!/campaign\??\.percent|phase\??\.percent|\d\s*%\s*(off|de desconto)/i.test(tela.replace(/10% de desconto/g, "")));
});
