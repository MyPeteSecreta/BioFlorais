/*
 * Esquenta Black (10% de 04/11 a 26/11) e Black Friday (25% de 27/11 a 30/11) no B2C da Bio: datas em São Paulo, preço sobre o
 * preço do site, cupom comercial soma e cupom da criadora vale o maior (com comissão), Pix sobre o valor com desconto, frete pela base do preço do site, sacola/servidor/
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
  couponDiscountOn,
  decideCampaignCoupons,
  partnerDiscountOn,
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

test("cupom x campanha (regra do Luis 05/11): comercial soma sobre o preço com desconto; criadora vale o maior e mantém a comissão", () => {
  const gpt10 = { discountType: "percentage", discountValue: 10 };
  const floresce20 = { discountType: "percentage", discountValue: 20 };
  const fixed = { discountType: "fixed", discountValue: 1000 };
  // 2 florais de R$ 35,90: site R$ 71,80; Esquenta R$ 64,62; Black R$ 53,86
  const esq = { siteSubtotalCents: 7180, siteOfferDiscountCents: 0, campaignSubtotalCents: 6462, campaignOfferDiscountCents: 0 };
  const blk = { ...esq, campaignSubtotalCents: 5386 };
  const none = { ...esq, campaignSubtotalCents: null, campaignOfferDiscountCents: null };

  assert.equal(couponDiscountOn(gpt10, 6462), 646);
  assert.equal(couponDiscountOn(fixed, 600), 600, "fixo nunca passa da base");
  assert.equal(partnerDiscountOn(15, 7180), 1077);
  assert.equal(partnerDiscountOn(null, 7180), 0);

  // só o Esquenta
  let d = decideCampaignCoupons({ ...esq, commercial: null, partnerDiscountPercent: null });
  assert.deepEqual([d.campaignApplied, d.promotionDiscountCents, d.merchandiseCents], [true, 718, 6462]);

  // GPT10 SOMA: 10% sobre R$ 64,62 = R$ 6,46 -> R$ 58,16
  d = decideCampaignCoupons({ ...esq, commercial: gpt10, partnerDiscountPercent: null });
  assert.deepEqual([d.campaignApplied, d.promotionDiscountCents, d.commercialBaseCents, d.commercialCouponCents, d.merchandiseCents], [true, 718, 6462, 646, 5816]);
  // FLORESCE20 soma: 20% sobre R$ 64,62 = R$ 12,92 -> R$ 51,70; na Black: 20% sobre R$ 53,86 = R$ 10,77 -> R$ 43,09
  assert.equal(decideCampaignCoupons({ ...esq, commercial: floresce20, partnerDiscountPercent: null }).merchandiseCents, 5170);
  assert.equal(decideCampaignCoupons({ ...blk, commercial: floresce20, partnerDiscountPercent: null }).merchandiseCents, 4309);

  // criadora 15% (R$ 10,77) ganha do Esquenta (R$ 7,18): preço do site − 15% = R$ 61,03
  d = decideCampaignCoupons({ ...esq, commercial: null, partnerDiscountPercent: 15 });
  assert.deepEqual([d.campaignApplied, d.promotionDiscountCents, d.partnerCouponCents, d.partnerDiscountOverridden, d.merchandiseCents], [false, 0, 1077, false, 6103]);

  // criadora 10% empata com o Esquenta: vale a campanha; criadora registrada sem desconto; comissão sobre R$ 64,62
  d = decideCampaignCoupons({ ...esq, commercial: null, partnerDiscountPercent: 10 });
  assert.deepEqual([d.campaignApplied, d.partnerCouponCents, d.partnerDiscountOverridden, d.partnerBaseCents, d.merchandiseCents], [true, 0, true, 6462, 6462]);

  // criadora 15% perde da Black (R$ 53,86 < R$ 61,03): Black; comissão sobre R$ 53,86
  d = decideCampaignCoupons({ ...blk, commercial: null, partnerDiscountPercent: 15 });
  assert.deepEqual([d.campaignApplied, d.partnerCouponCents, d.partnerDiscountOverridden, d.partnerBaseCents], [true, 0, true, 5386]);

  // GPT10 + criadora 15%: Esquenta + GPT10 = R$ 58,16; site + GPT10 (R$ 7,18) + criadora (15% de R$ 64,62 = R$ 9,69) = R$ 54,93 -> vale o segundo
  d = decideCampaignCoupons({ ...esq, commercial: gpt10, partnerDiscountPercent: 15 });
  assert.deepEqual([d.campaignApplied, d.commercialCouponCents, d.partnerBaseCents, d.partnerCouponCents, d.merchandiseCents], [false, 718, 6462, 969, 5493]);
  // GPT10 + criadora 10%: Esquenta + GPT10 (R$ 58,16) ganha de site + GPT10 + criadora (R$ 58,16): empate -> campanha
  d = decideCampaignCoupons({ ...esq, commercial: gpt10, partnerDiscountPercent: 10 });
  assert.deepEqual([d.campaignApplied, d.commercialCouponCents, d.partnerCouponCents, d.partnerDiscountOverridden, d.partnerBaseCents, d.merchandiseCents], [true, 646, 0, true, 5816, 5816]);

  // sem campanha: a regra antiga (comercial e depois criadora, sobre o preço do site)
  d = decideCampaignCoupons({ ...none, commercial: gpt10, partnerDiscountPercent: 15 });
  assert.deepEqual([d.campaignApplied, d.commercialCouponCents, d.partnerCouponCents, d.partnerDiscountOverridden, d.merchandiseCents], [false, 718, 969, false, 5493]);
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

test("pedido (servidor) e checkout: a mesma função (decideCampaignCoupons); comercial sobre a base com a campanha; criadora registrada com comissão; frete pela base do preço do site", () => {
  const order = read("src/app/api/orders/create/route.ts");
  assert.ok(order.includes("activeCampaign(Date.now())") && order.includes("decideCampaignCoupons({"));
  assert.ok(!order.includes("decideCampaign({") && !order.includes("commercialCoupon = null;") && !order.includes("partnerCoupon = null;"), "nenhum cupom é descartado pela campanha");
  assert.ok(/resolveCoupon\(\s*body\.couponCode,\s*campaignCouponBaseCents,/.test(order), "comercial validado sobre o valor com a campanha");
  assert.ok(order.includes("couponDiscountOn(commercialCoupon, siteCouponBaseCents)"), "criadora validada no cenário do preço do site");
  assert.ok(order.includes("partnerDiscountOverridden ? 0 : partnerCoupon.discountPercent"), "evento da parceira: desconto 0 quando a campanha vence");
  assert.ok(order.includes("String(partnerDiscountOverridden ? 0 : partnerCoupon.discountPercent)"), "pedido: percentual de desconto da criadora 0");
  assert.ok(/const partnerCommissionCents =\s*partnerCoupon &&/.test(order), "comissão continua quando há cupom da criadora");
  assert.ok(order.includes("campaign: campaignApplied && campaign ?"), "registro no pedido");
  // o frete grátis continua pelo subtotal bruto (preço do site)
  assert.ok(/computeB2CShipping\(\{\s*subtotalCents,/.test(order));
  // Pix sobre o valor com desconto
  assert.ok(order.includes("subtotalCents - offerDiscountCents - promotionDiscountCents - couponDiscountCents - partnerCouponDiscountCents"));

  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("decideCampaignCoupons({") && !checkout.includes("couponBeatsCampaign"));
  assert.ok(checkout.includes("const couponBaseOf = (quote: Quote) => quote.siteTotalCents ?? quote.totalCents;"));
  assert.ok(checkout.includes("const commercialBaseOf = (quote: Quote) => quote.totalCents;"));
  assert.equal((checkout.match(/validateCommercialCoupon\([^)]*commercialBaseOf\(quote\)/g) ?? []).length, 3, "GPT10, revalidação e aplicar: base com a campanha");
  assert.ok(!/validateCommercialCoupon\([^)]*couponBaseOf\(quote\)/.test(checkout));
  assert.ok(checkout.includes("Cupom da parceira registrado: a criadora recebe a comissão"));
  assert.ok(!checkout.includes("O cupom não soma com o"));
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

test("Omie: a Central calcula o desconto por subtotal + frete − total; o pedido grava subtotal pelo preço do site e todos os descontos em discount_cents", async () => {
  const { calculateSelectedOffers } = await import("../src/lib/commerce/offers.ts");
  const omieDiscount = (order) => order.subtotalCents + order.shippingCents - order.totalCents; // omie-order-source.ts (Central)

  // a mesma conta de /api/orders/create (offerLines, decideCampaignCoupons, Pix sobre os produtos, frete à parte)
  const orderMoney = ({ qty, phase, commercial = null, partnerPercent = null, commissionPercent = 10, pix = false, shippingCents = 0 }) => {
    const site = 3590;
    const line = (unit) => [{ productSlug: "adulto-floral-em-gotas-sono", name: "Sono", category: "Floral em gotas", qty, unitPriceCents: unit }];
    const siteOffers = calculateSelectedOffers(line(site), []);
    const campaignOffers = phase ? calculateSelectedOffers(line(campaignUnitPriceCents(site, phase)), []) : null;
    const d = decideCampaignCoupons({
      siteSubtotalCents: siteOffers.grossSubtotalCents,
      siteOfferDiscountCents: siteOffers.offerDiscountCents,
      campaignSubtotalCents: campaignOffers ? campaignOffers.grossSubtotalCents : null,
      campaignOfferDiscountCents: campaignOffers ? campaignOffers.offerDiscountCents : null,
      commercial,
      partnerDiscountPercent: partnerPercent,
    });
    const subtotalCents = siteOffers.grossSubtotalCents;
    const coupons = d.commercialCouponCents + d.partnerCouponCents;
    const merchandise = subtotalCents - d.offerDiscountCents - d.promotionDiscountCents - coupons;
    const pixCents = pix ? pixDiscountCents(merchandise) : 0;
    const commissionCents = partnerPercent === null ? 0 : Math.round((d.partnerBaseCents - d.partnerCouponCents) * (commissionPercent / 100));
    return { subtotalCents, shippingCents, discountCents: d.offerDiscountCents + d.promotionDiscountCents + coupons + pixCents, totalCents: merchandise - pixCents + shippingCents, pixCents, commissionCents, d };
  };
  const gpt10 = { discountType: "percentage", discountValue: 10 };

  const card = orderMoney({ qty: 2, phase: esquenta });
  assert.deepEqual([card.subtotalCents, card.totalCents, omieDiscount(card)], [7180, 6462, 718]);

  const pix = orderMoney({ qty: 2, phase: esquenta, pix: true });
  assert.equal(pix.pixCents, pixDiscountCents(6462));
  assert.equal(omieDiscount(pix), 718 + pix.pixCents, "Esquenta + Pix");
  assert.equal(omieDiscount(pix), pix.discountCents, "a identidade bate com discount_cents");

  // cupom: chega ao Omie pela mesma identidade
  assert.equal(omieDiscount(orderMoney({ qty: 2, phase: null, commercial: gpt10 })), 718, "GPT10 sem campanha");
  const gptEsq = orderMoney({ qty: 2, phase: esquenta, commercial: gpt10, pix: true });
  assert.equal(gptEsq.totalCents, 5816 - pixDiscountCents(5816), "Esquenta + GPT10 + Pix");
  assert.equal(omieDiscount(gptEsq), 718 + 646 + pixDiscountCents(5816));
  assert.equal(omieDiscount(gptEsq), gptEsq.discountCents);
  // criadora 15% vence o Esquenta: desconto dela 1077, comissão 10% de R$ 61,03
  const creator = orderMoney({ qty: 2, phase: esquenta, partnerPercent: 15 });
  assert.deepEqual([omieDiscount(creator), creator.commissionCents], [1077, 610]);
  // criadora 10% empata: vale o Esquenta (718), desconto dela 0, comissão 10% de R$ 64,62 = R$ 6,46
  const tie = orderMoney({ qty: 2, phase: esquenta, partnerPercent: 10 });
  assert.deepEqual([omieDiscount(tie), tie.d.partnerCouponCents, tie.commissionCents], [718, 0, 646]);
  // frete cobrado não entra no desconto
  const withShipping = orderMoney({ qty: 1, phase: esquenta, shippingCents: 990 });
  assert.equal(omieDiscount(withShipping), 359);

  // a rota grava exatamente esses campos (um insert só para Pix e cartão)
  const route = read("src/app/api/orders/create/route.ts");
  assert.ok(route.includes("const offerResult =\n      calculateSelectedOffers(\n        offerLines(false),"), "subtotal pelo preço do site");
  assert.ok(/const subtotalCents =\s*offerResult\s*\.grossSubtotalCents;/.test(route));
  assert.ok(/const discountCents =\s*offerDiscountCents \+\s*promotionDiscountCents \+\s*couponDiscountCents \+\s*partnerCouponDiscountCents \+\s*creditCents \+\s*paymentMethodDiscountCents;/.test(route));
  assert.ok(route.includes("const totalCents = Math.max(0, merchandiseAfterDiscountsCents - paymentMethodDiscountCents + shippingCents);"));
  assert.equal((route.match(/\.insert\(orders\)/g) ?? []).length, 1);
  assert.ok(/\.insert\(orders\)[\s\S]*?subtotalCents,\s*discountCents,/.test(route));
});
