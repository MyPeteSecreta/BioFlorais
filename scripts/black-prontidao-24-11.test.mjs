/*
 * 24/11 — PRONTIDÃO DA BLACK (Bio): a promoção liga e desliga sozinha por data (São Paulo), percentuais por linha no catálogo REAL,
 * cupom da criadora soma, frete grátis sobre o preço praticado, Pix sobre o preço da Black, feeds com a vigência certa.
 * Tudo com data simulada (nada paga, nada vai à rede).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { activeCampaign, campaignPercentFor, campaignUnitPriceCents, decideCampaignCoupons, feedCampaignPhase, saleEffectiveDate, CAMPAIGN_PHASES } from "../src/lib/campaign/esquenta-black.ts";
import { bioProducts } from "../src/lib/catalog/bio-products.ts";
import { buildFeedItem } from "../src/lib/feeds/products.ts";
import { pixDiscountCents } from "../src/lib/checkout/benefits.ts";
import { computeB2CShipping, freeShippingBaseCents } from "../src/lib/checkout/shipping-b2c.ts";
import { googleAdsConversionEvent, googleAdsConversionTarget, googlePurchaseEvent } from "../src/lib/measurement.ts";

const at = (iso) => Date.parse(iso);
const key = (iso) => activeCampaign(at(iso))?.key ?? null;

test("liga e desliga sozinha por data (São Paulo): Esquenta até 26/11 23:59:59; Black de 27/11 00:00 a 30/11 23:59:59; depois nada", () => {
  assert.equal(key("2026-11-03T23:59:59.999-03:00"), null, "antes do Esquenta");
  assert.equal(key("2026-11-04T00:00:00-03:00"), "esquenta");
  assert.equal(key("2026-11-26T23:59:59.999-03:00"), "esquenta", "último milissegundo do Esquenta");
  assert.equal(key("2026-11-27T00:00:00-03:00"), "black", "vira a Black à meia-noite de São Paulo");
  assert.equal(key("2026-11-28T15:00:00-03:00"), "black");
  assert.equal(key("2026-11-30T23:59:59.999-03:00"), "black", "último milissegundo da Black");
  assert.equal(key("2026-12-01T00:00:00-03:00"), null, "desliga sozinha em 01/12");
  // as mesmas viradas em UTC (o servidor da Vercel roda em UTC): 27/11 00:00 SP = 03:00 UTC; 01/12 00:00 SP = 03:00 UTC
  assert.equal(key("2026-11-27T02:59:59.999Z"), "esquenta");
  assert.equal(key("2026-11-27T03:00:00.000Z"), "black");
  assert.equal(key("2026-12-01T02:59:59.999Z"), "black");
  assert.equal(key("2026-12-01T03:00:00.000Z"), null);
  assert.equal(CAMPAIGN_PHASES.find((p) => p.key === "esquenta").percent, 10);
  assert.equal(CAMPAIGN_PHASES.find((p) => p.key === "black").percent, 25);
});

test("percentuais no catálogo REAL: Black 25% em tudo, Virtudes Divinas 35%, Flormed 30%; Esquenta 10% em tudo", () => {
  const black = CAMPAIGN_PHASES.find((p) => p.key === "black");
  const esq = CAMPAIGN_PHASES.find((p) => p.key === "esquenta");
  const virtudes = bioProducts.filter((p) => p.lineSlug === "virtudes-divinas");
  const flormed = bioProducts.filter((p) => /(^|-)flormed(-|$)/.test(p.slug));
  const others = bioProducts.filter((p) => !virtudes.includes(p) && !flormed.includes(p));

  assert.ok(virtudes.length >= 1 && flormed.length >= 1 && others.length > 20, `virtudes ${virtudes.length}, flormed ${flormed.length}, resto ${others.length}`);
  for (const p of virtudes) assert.equal(campaignPercentFor(black, p.slug), 35, p.slug);
  for (const p of flormed) assert.equal(campaignPercentFor(black, p.slug), 30, p.slug);
  for (const p of others) assert.equal(campaignPercentFor(black, p.slug), 25, p.slug);
  for (const p of bioProducts) assert.equal(campaignPercentFor(esq, p.slug), 10, p.slug + " (Esquenta sempre 10%)");
  // "Flormed" que não é da linha Flormed não pega 30%: nenhum slug de outra linha cai na regra por engano
  assert.ok(flormed.every((p) => /flormed/.test(p.slug)));
  // exemplo de preço: floral de R$ 35,90 -> Black R$ 26,93; Virtudes e Flormed pelos seus percentuais
  const sono = bioProducts.find((p) => p.slug === "adulto-floral-em-gotas-sono");
  assert.equal(campaignUnitPriceCents(sono.priceCents, black, sono.slug), Math.round((sono.priceCents * 75) / 100));
  assert.equal(campaignUnitPriceCents(virtudes[0].priceCents, black, virtudes[0].slug), Math.round((virtudes[0].priceCents * 65) / 100));
  assert.equal(campaignUnitPriceCents(flormed[0].priceCents, black, flormed[0].slug), Math.round((flormed[0].priceCents * 70) / 100));
});

test("cupom da criadora (Academia) 10% SOMA com a Black; frete grátis de R$ 70 sobre o preço praticado; Pix sobre o valor da Black", () => {
  const black = CAMPAIGN_PHASES.find((p) => p.key === "black");
  const unit = 3590;
  const bp = (qty) => campaignUnitPriceCents(unit, black, "adulto-floral-em-gotas-sono") * qty; // 2693 por unidade
  const run = (qty, partner) =>
    decideCampaignCoupons({ siteSubtotalCents: unit * qty, siteOfferDiscountCents: 0, campaignSubtotalCents: bp(qty), campaignOfferDiscountCents: 0, commercial: null, partnerDiscountPercent: partner });

  // 3 florais: 3 x 26,93 = 80,79; criadora 10% = 8,08; total dos produtos 72,71
  const d = run(3, 10);
  assert.deepEqual([d.campaignApplied, d.partnerCouponCents, d.partnerDiscountOverridden, d.merchandiseCents], [true, 808, false, 7271]);
  assert.equal(run(3, null).merchandiseCents, 8079, "sem cupom: só a Black");
  // frete grátis: base = preço praticado (Black), não o preço do site
  const base2 = freeShippingBaseCents(unit * 2, unit * 2 - bp(2));
  const base3 = freeShippingBaseCents(unit * 3, unit * 3 - bp(3));
  assert.deepEqual([base2, base3], [5386, 8079]);
  const ship = (subtotal) => computeB2CShipping({ subtotalCents: subtotal, optionCostCents: 2500, cheapestCostCents: 2500, uf: "SP" }).customerCents;
  assert.ok(ship(base2) > 0, "2 florais na Black (R$ 53,86): ainda paga frete");
  assert.equal(ship(base3), 0, "3 florais na Black (R$ 80,79): frete grátis");
  // Pix: 4% sobre os produtos já com Black e cupom (nunca sobre o frete)
  assert.equal(pixDiscountCents(d.merchandiseCents), Math.round(7271 * 0.04));
});

test("feeds: Esquenta publica a vigência até 26/11; depois da virada o feed troca para a Black (27/11 a 30/11) e some em 01/12", () => {
  assert.equal(saleEffectiveDate(CAMPAIGN_PHASES[0]), "2026-11-04T00:00-0300/2026-11-26T23:59-0300");
  assert.equal(saleEffectiveDate(CAMPAIGN_PHASES[1]), "2026-11-27T00:00-0300/2026-11-30T23:59-0300");
  const sono = bioProducts.find((p) => p.slug === "adulto-floral-em-gotas-sono");
  const virtudes = bioProducts.find((p) => p.lineSlug === "virtudes-divinas");
  const flormed = bioProducts.find((p) => /(^|-)flormed(-|$)/.test(p.slug));
  const img = () => "/p.jpg";
  const item = (product, iso) => buildFeedItem(product, "https://www.bioflorais.com.br", img, at(iso));

  assert.equal(item(sono, "2026-11-26T23:00:00-03:00").salePriceEffectiveDate, "2026-11-04T00:00-0300/2026-11-26T23:59-0300");
  const b = item(sono, "2026-11-27T00:30:00-03:00");
  assert.equal(b.salePriceEffectiveDate, "2026-11-27T00:00-0300/2026-11-30T23:59-0300");
  assert.equal(b.salePrice, "26.93 BRL");
  assert.equal(b.price, "35.90 BRL");
  if (virtudes) assert.equal(item(virtudes, "2026-11-28T10:00:00-03:00").salePrice, `${(Math.round((virtudes.priceCents * 65) / 100) / 100).toFixed(2)} BRL`);
  if (flormed) assert.equal(item(flormed, "2026-11-28T10:00:00-03:00").salePrice, `${(Math.round((flormed.priceCents * 70) / 100) / 100).toFixed(2)} BRL`);
  assert.equal(item(sono, "2026-12-01T00:00:00-03:00").salePrice, null);
  assert.equal(feedCampaignPhase(at("2026-12-01T00:00:00-03:00")), null);
});

test("Google Ads: a compra paga manda a conversão com send_to = AW-18548030046/2rC3CNXqjbAdEN70sYxF, valor em BRL e transaction_id = pedido (o rótulo vem de NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL)", () => {
  const target = googleAdsConversionTarget(["AW-18548030046"], "2rC3CNXqjbAdEN70sYxF");
  assert.equal(target, "AW-18548030046/2rC3CNXqjbAdEN70sYxF");
  assert.equal(googleAdsConversionTarget(["AW-18548030046"], null), null, "sem rótulo, não dispara");
  assert.equal(googleAdsConversionTarget(["G-ABC123"], "2rC3CNXqjbAdEN70sYxF"), null, "sem AW-, não dispara");
  const order = { orderId: "11111111-2222-4333-8444-555555555555", valueCents: 8090, segment: "b2c", items: [{ id: "adulto-floral-em-gotas-sono", quantity: 2, priceCents: 2693 }] };
  const conversion = googleAdsConversionEvent(order, target);
  assert.deepEqual(conversion.params, { send_to: target, value: 80.9, currency: "BRL", transaction_id: order.orderId });
  const purchase = googlePurchaseEvent(order);
  assert.deepEqual([purchase.params.value, purchase.params.currency, purchase.params.transaction_id], [80.9, "BRL", order.orderId]);
});
