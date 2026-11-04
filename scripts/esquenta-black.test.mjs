/*
 * Esquenta Black (10% de 04/11 a 26/11) e Black Friday (25% de 27/11 a 30/11) no B2C da Bio: datas em São Paulo, preço sobre o
 * preço do site, cupom não soma (vale o maior), Pix sobre o valor com desconto, frete pela base do preço do site, sacola/servidor/
 * checkout com a mesma conta, sale_price nos feeds e B2B intocado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  CAMPAIGN_PHASES,
  activeCampaign,
  campaignUnitPriceCents,
  couponBeatsCampaign,
  decideCampaign,
  feedCampaignPhase,
  isCampaignPath,
  saleEffectiveDate,
} from "../src/lib/campaign/esquenta-black.ts";
import { buildFeedItem, renderGoogleFeedXml, renderMetaFeedCsv, META_CSV_COLUMNS } from "../src/lib/feeds/products.ts";
import { bioProducts } from "../src/lib/catalog/bio-products.ts";
import { pixDiscountCents } from "../src/lib/checkout/benefits.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const at = (iso) => Date.parse(iso);
const esquenta = CAMPAIGN_PHASES.find((phase) => phase.key === "esquenta");
const black = CAMPAIGN_PHASES.find((phase) => phase.key === "black");

test("datas em São Paulo: Esquenta de 04/11 00:00 a 26/11 23:59; Black de 27/11 00:00 a 30/11 23:59; fora disso, nada", () => {
  assert.equal(activeCampaign(at("2026-11-03T23:59:59-03:00")), null);
  assert.equal(activeCampaign(at("2026-11-04T00:00:00-03:00"))?.key, "esquenta");
  assert.equal(activeCampaign(at("2026-11-04T02:59:59Z")), null, "03/11 23:59 em SP");
  assert.equal(activeCampaign(at("2026-11-26T23:59:59-03:00"))?.key, "esquenta");
  assert.equal(activeCampaign(at("2026-11-27T00:00:00-03:00"))?.key, "black");
  assert.equal(activeCampaign(at("2026-11-30T23:59:59-03:00"))?.key, "black");
  assert.equal(activeCampaign(at("2026-12-01T00:00:00-03:00")), null);

  assert.equal(esquenta.percent, 10);
  assert.equal(black.percent, 25);
  assert.equal(esquenta.priceLabel, "Preço Esquenta Black");
  assert.equal(black.priceLabel, "Preço Black");
  assert.equal(esquenta.strip, "Esquenta Black: 10% em tudo até 26/11");
});

test("preço: percentual sobre o preço do site, ao centavo; Pix (4%) sobre o valor já com desconto", () => {
  assert.equal(campaignUnitPriceCents(3590, null), 3590);
  assert.equal(campaignUnitPriceCents(3590, esquenta), 3231);
  assert.equal(campaignUnitPriceCents(3590, black), 2693);
  assert.equal(pixDiscountCents(3231), pixDiscountCents(campaignUnitPriceCents(3590, esquenta)));
  assert.ok(pixDiscountCents(3231) < pixDiscountCents(3590), "Pix sobre o valor com desconto");
});

test("cupom x campanha: não somam, vale o maior; empate fica com a campanha (o cupom não é gasto)", () => {
  assert.equal(couponBeatsCampaign(718, 0), false);
  assert.equal(couponBeatsCampaign(718, 718), false, "empate: campanha");
  assert.equal(couponBeatsCampaign(718, 719), true);

  // 2 florais de R$ 35,90 no Esquenta, cupom de 10% (GPT10) sobre o preço do site = R$ 7,18: empate -> campanha
  const two = { siteSubtotalCents: 7180, siteOfferDiscountCents: 0, campaignSubtotalCents: 6462, campaignOfferDiscountCents: 0 };
  assert.deepEqual(decideCampaign({ ...two, couponsCents: 718 }), { campaignApplied: true, promotionDiscountCents: 718, offerDiscountCents: 0, campaignSavingsCents: 718 });
  // cupom de 15% (R$ 10,77) ganha do Esquenta: preço do site + cupom, sem promoção
  assert.deepEqual(decideCampaign({ ...two, couponsCents: 1077 }), { campaignApplied: false, promotionDiscountCents: 0, offerDiscountCents: 0, campaignSavingsCents: 718 });
  // na Black (25%), o mesmo cupom de 15% perde
  assert.equal(decideCampaign({ siteSubtotalCents: 7180, siteOfferDiscountCents: 0, campaignSubtotalCents: 5386, campaignOfferDiscountCents: 0, couponsCents: 1077 }).campaignApplied, true);
});

test("cotação da sacola (servidor): no Esquenta, item com riscado, promoção = 10%, total com desconto; base do frete e do cupom = preço do site", async () => {
  const { POST } = await import("../src/app/api/cart/quote/route.ts");
  const realNow = Date.now;
  const sono = bioProducts.find((p) => p.slug === "adulto-floral-em-gotas-sono");
  const quote = async () => (await POST(new Request("http://x/api/cart/quote", { method: "POST", body: JSON.stringify({ items: [{ productSlug: sono.slug, qty: 2 }] }) }))).json();

  try {
    Date.now = () => at("2026-11-10T12:00:00-03:00");
    const q = await quote();
    assert.equal(q.campaign.key, "esquenta");
    assert.equal(q.items[0].sitePriceCents, sono.priceCents);
    assert.equal(q.items[0].unitPriceCents, campaignUnitPriceCents(sono.priceCents, esquenta));
    assert.equal(q.grossSubtotalCents, 2 * sono.priceCents);
    assert.equal(q.promotionDiscountCents, 2 * sono.priceCents - 2 * campaignUnitPriceCents(sono.priceCents, esquenta));
    assert.equal(q.totalCents, 2 * campaignUnitPriceCents(sono.priceCents, esquenta));
    assert.equal(q.siteTotalCents, 2 * sono.priceCents, "base do frete grátis e dos cupons");

    Date.now = () => at("2026-11-03T12:00:00-03:00");
    const before = await quote();
    assert.equal(before.campaign, null);
    assert.equal(before.promotionDiscountCents, 0);
    assert.equal(before.totalCents, before.siteTotalCents);
  } finally {
    Date.now = realNow;
  }
});

test("pedido (servidor) e checkout: a mesma regra; o cupom não soma; frete pela base do preço do site; registro da campanha", () => {
  const order = read("src/app/api/orders/create/route.ts");
  assert.ok(order.includes("activeCampaign(Date.now())") && order.includes("decideCampaign({"));
  assert.ok(order.includes("commercialCoupon = null;") && order.includes("partnerCoupon = null;"), "campanha vence: cupom não é aplicado nem gasto");
  assert.ok(order.includes("campaign: campaignApplied && campaign ?"), "registro no pedido");
  // o frete grátis continua pelo subtotal bruto (preço do site)
  assert.ok(/computeB2CShipping\(\{\s*subtotalCents,/.test(order));
  // Pix sobre o valor com desconto
  assert.ok(order.includes("subtotalCents - offerDiscountCents - promotionDiscountCents - couponDiscountCents - partnerCouponDiscountCents"));

  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("couponBeatsCampaign(campaignSavingsCents, typedCouponCents + typedPartnerCouponCents)"));
  assert.ok(checkout.includes("const couponBaseOf = (quote: Quote) => quote.siteTotalCents ?? quote.totalCents;"));
  assert.ok(!/validateCommercialCoupon\([^)]*quote\.totalCents/.test(checkout), "cupom sempre sobre o preço do site");
  assert.ok(checkout.includes("O cupom não soma com o"));
  assert.equal((checkout.match(/data-testid="desconto-campanha"/g) ?? []).length, 1, "uma linha só no resumo");
});

test("tela: faixa no topo só no B2C; preço com riscado na página do produto, barra fixa, kit, sacola, sugestões, /para e quiz", () => {
  assert.equal(isCampaignPath("/produto/x"), true);
  for (const p of ["/parceiros", "/parceiros/x", "/b2b/oferta/x", "/admin/b2b"]) assert.equal(isCampaignPath(p), false, p);
  assert.ok(read("src/app/layout.tsx").includes("<CampaignStrip />"));

  const page = read("src/app/produto/[slug]/page.tsx");
  assert.ok(page.includes("<CampaignPrice") && page.includes("withPix") && !page.includes("formatBRL("), "todos os preços da página pela campanha");
  assert.ok(read("src/components/product/ProductPurchaseActions.tsx").includes("campaignUnitPriceCents(priceCents, phase)"));
  assert.ok(read("src/app/carrinho/page.tsx").includes('data-testid="desconto-campanha"'));
  for (const file of ["src/components/cart/CartShippingSuggestions.tsx", "src/app/para/[slug]/page.tsx", "src/app/quiz/BioQuizClient.tsx"]) assert.ok(read(file).includes("<CampaignPriceInline"), file);
});

test("feeds: sale_price e vigência da fase atual ou da próxima; nada depois do fim; Google e Meta", () => {
  const sono = bioProducts.find((p) => p.slug === "adulto-floral-em-gotas-sono");
  const img = () => "/p.jpg";

  assert.equal(saleEffectiveDate(esquenta), "2026-11-04T00:00-0300/2026-11-26T23:59-0300");
  assert.equal(saleEffectiveDate(black), "2026-11-27T00:00-0300/2026-11-30T23:59-0300");
  assert.equal(feedCampaignPhase(at("2026-11-03T10:00:00-03:00"))?.key, "esquenta", "antes: já publica a próxima");
  assert.equal(feedCampaignPhase(at("2026-11-28T10:00:00-03:00"))?.key, "black");
  assert.equal(feedCampaignPhase(at("2026-12-01T10:00:00-03:00")), null);

  const now = buildFeedItem(sono, "https://www.bioflorais.com.br", img, at("2026-11-03T10:00:00-03:00"));
  assert.equal(now.price, "35.90 BRL");
  assert.equal(now.salePrice, "32.31 BRL");
  assert.equal(now.salePriceEffectiveDate, "2026-11-04T00:00-0300/2026-11-26T23:59-0300");
  const xml = renderGoogleFeedXml([now], "https://www.bioflorais.com.br");
  assert.ok(xml.includes("<g:sale_price>32.31 BRL</g:sale_price>") && xml.includes("<g:sale_price_effective_date>2026-11-04T00:00-0300/2026-11-26T23:59-0300</g:sale_price_effective_date>"));
  assert.ok(META_CSV_COLUMNS.includes("sale_price") && META_CSV_COLUMNS.includes("sale_price_effective_date"));
  assert.ok(renderMetaFeedCsv([now]).trim().endsWith(",32.31 BRL,2026-11-04T00:00-0300/2026-11-26T23:59-0300"));

  const after = buildFeedItem(sono, "https://www.bioflorais.com.br", img, at("2026-12-01T10:00:00-03:00"));
  assert.equal(after.salePrice, null);
  assert.ok(!renderGoogleFeedXml([after], "https://x").includes("sale_price"));
});

test("B2B intocado: nada do B2B importa a campanha", () => {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const b2b = ["src/lib/b2b", "src/app/b2b", "src/app/api/b2b", "src/app/parceiros"].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(b2b.length > 20);
  for (const file of b2b) assert.ok(!readFileSync(file, "utf8").includes("campaign/esquenta-black"), file);
});
