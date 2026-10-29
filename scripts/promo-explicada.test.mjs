/*
 * Escolha de promoção em linguagem simples (Offer Builder e "Criar link com promoção") e vídeos de treinamento.
 * Só apresentação: as contas usam os mesmos preços e regras de sempre.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { commissionText, describeDeal, eligibilityText, formatBRL, mergeRanges, priceRangeText } from "../src/lib/b2b/promo-explain.ts";
import { TRAINING_VIDEOS_URL } from "../src/lib/b2b/sales-materials.ts";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

test("preço B2B no topo: valor único ou faixa 'de R$ X a R$ Y'", () => {
  assert.equal(formatBRL(2990), "R$ 29,90");
  assert.equal(priceRangeText({ min: 2990, max: 2990 }), "R$ 29,90 por unidade");
  assert.equal(priceRangeText({ min: 1690, max: 2190 }), "de R$ 16,90 a R$ 21,90 por unidade");
  assert.equal(priceRangeText(null), null);
  assert.deepEqual(mergeRanges([{ min: 1990, max: 1990 }, null, { min: 1690, max: 2190 }]), { min: 1690, max: 2190 });
});

test("o que o cliente ganha, com a conta pronta (exemplos do pedido)", () => {
  const four = describeDeal({ buyQuantity: 2, freeQuantity: 2, percent: null }, { min: 2990, max: 2990 });
  assert.equal(four.headline, "4 por 2");
  assert.equal(four.math, "4 por 2: compra 2 por R$ 59,80 e leva 4 → sai R$ 14,95 cada");

  const off = describeDeal({ buyQuantity: 1, freeQuantity: 1, percent: 15 }, { min: 2990, max: 2990 });
  assert.equal(off.headline, "−15%");
  assert.equal(off.math, "−15%: R$ 29,90 → R$ 25,42");

  const three = describeDeal({ buyQuantity: 2, freeQuantity: 1, percent: null }, { min: 1990, max: 1990 });
  assert.equal(three.math, "3 por 2: compra 2 por R$ 39,80 e leva 3 → sai R$ 13,27 cada");

  const range = describeDeal({ buyQuantity: 1, freeQuantity: 1, percent: 10 }, { min: 1690, max: 2190 });
  assert.ok(range.math.includes("exemplo com o produto de R$ 16,90"));
  assert.equal(describeDeal({ buyQuantity: 1, freeQuantity: 1, percent: 10 }, null).math, null);
});

test("por quanto tempo vale e a comissão em frase (sem '1x 10% + 6% = 16%')", () => {
  assert.equal(eligibilityText("uses", 1).title, "Só na 1ª compra");
  assert.equal(eligibilityText("uses", 2).title, "Nas 2 primeiras compras");
  assert.equal(eligibilityText("uses", 3).title, "Nas 3 primeiras compras");
  assert.equal(eligibilityText("days", 30).title, "Por 30 dias");
  assert.ok(eligibilityText("days", 90).hint.includes("sem limite"));
  assert.equal(commissionText(10, 6), "Sua comissão: 16% (10% fixo + 6% de bônus)");
  assert.equal(commissionText(10, 0), "Sua comissão: 10% (10% fixo, sem bônus)");
  assert.equal(commissionText(10, 7.5), "Sua comissão: 17,5% (10% fixo + 7,5% de bônus)");
});

test("telas: Offer Builder e links com promoção usam as mesmas frases e o '?'", () => {
  const builder = read("src/app/b2b/painel/cliente/[clientId]/oferta/OfferBuilder.tsx");
  assert.ok(builder.includes("Preço B2B da linha") && builder.includes("O que o cliente ganha") && builder.includes("Por quanto tempo vale para o cliente?"));
  assert.ok(builder.includes("commissionText(") && builder.includes("describeDeal(") && builder.includes("<HelpTip"));
  assert.ok(!builder.includes("= {formatPercent(matrix.basePercent + extraPercent)}"), "some a conta '10% + 6% ='");

  const links = read("src/components/b2b/PromoLinksPanel.tsx");
  assert.ok(links.includes("O que o cliente ganha") && links.includes("Por quanto tempo vale para o cliente?") && links.includes("item.commission") && links.includes("<HelpTip"));
  assert.ok(read("src/lib/b2b/offer-builder.ts").includes("priceRange"), "o preço da linha vem do catálogo");
});

test("vídeos de treinamento: menu do vendedor e cartão em Materiais de venda, em nova aba", () => {
  assert.equal(TRAINING_VIDEOS_URL, "https://www.youtube.com/channel/UCHua8MveMyC0fdNuWnRBhOQ");

  const layout = read("src/app/b2b/painel/layout.tsx");
  assert.ok(layout.includes("Vídeos de treinamento") && layout.includes("href={TRAINING_VIDEOS_URL}") && layout.includes('target="_blank"') && layout.includes('rel="noopener noreferrer"'));

  const page = read("src/app/b2b/painel/materiais/page.tsx");
  assert.ok(page.includes("cartao-videos-treinamento") && page.includes("href={TRAINING_VIDEOS_URL}") && page.includes('target="_blank"'));
});
