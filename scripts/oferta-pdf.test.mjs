/*
 * PDF da oferta do lojista (item 14b, 11/11): mesmo visual do modelo aprovado (Popular Pet), dados da oferta, botões clicáveis
 * para o link da oferta, condições dos parâmetros do sistema, no máximo 2 casas decimais; "Baixar PDF" ao lado do link.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { OFFER_SHARE_TEXT, buildOfferPdfHtml, promotionRule, promotionUnitCents } from "../src/lib/b2b/offer-pdf.ts";
import { OFFER_PDF_CSS } from "../src/lib/b2b/offer-pdf-css.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const OFFER = "https://www.bioflorais.com.br/b2b/oferta/TOKEN-DE-TESTE";

const line = (overrides) => ({ name: "Linha", slug: "x", image: "/assets/home/linhas/Pet.png", productCount: 1, b2bMinCents: 1990, b2bMaxCents: 1990, consumerMinCents: 3590, consumerMaxCents: 3590, promotion: null, hasDisplay: false, ...overrides });
const data = (lines, extra = {}) => ({
  brand: "Bio Florais",
  siteUrl: "https://www.bioflorais.com.br",
  offerUrl: OFFER,
  clientName: "Popular Pet",
  sellerName: "Luis A C",
  lead: "Florais brasileiros em gotas.",
  lines,
  displayPhoto: "/b2b/displays/pet-12.webp",
  conditions: { pixPercent: 7, cardPercent: 3, maxInstallments: 3, minInstallmentCents: 50000, boletoDays: [28, 42, 56], freeFreightCents: 45000, minOrderCents: 25000 },
  ...extra,
});

const popularPet = [
  line({ name: "Florais Pet", slug: "pet", productCount: 31, hasDisplay: true, promotion: { buyQuantity: 2, freeQuantity: 2, percent: null, usesRemaining: 3, validUntil: null, scopeText: null, b2bMinCents: 1990, consumerMinCents: 3590 } }),
  line({ name: "Cosméticos Pet", slug: "cosmeticos-pet", productCount: 30, b2bMinCents: 1290, b2bMaxCents: 10990, consumerMinCents: 2190, consumerMaxCents: 19990, promotion: { buyQuantity: 3, freeQuantity: 1, percent: null, usesRemaining: 3, validUntil: null, scopeText: "o Spray para Hálito – Menta", b2bMinCents: 1290, consumerMinCents: 2190 } }),
  line({ name: "Floral Adulto", slug: "adulto", productCount: 33 }),
];

test("contas iguais às do modelo da Popular Pet: com a promoção = preço médio contando as grátis; percentual", () => {
  assert.equal(promotionRule({ buyQuantity: 2, freeQuantity: 2, percent: null }), "Compre 2 e leve +2 grátis");
  assert.equal(promotionUnitCents({ buyQuantity: 2, freeQuantity: 2, percent: null }, 1990), 995, "R$ 9,95");
  assert.equal(promotionUnitCents({ buyQuantity: 3, freeQuantity: 1, percent: null }, 1290), 968, "R$ 9,68");
  assert.equal(promotionRule({ buyQuantity: 0, freeQuantity: 0, percent: 10 }), "10% de desconto");
  assert.equal(promotionUnitCents({ buyQuantity: 0, freeQuantity: 0, percent: 10 }, 1690), 1521, "R$ 15,21");
});

test("páginas: capa, promoções, display, tabela de todas as linhas, condições e final; botões clicáveis para a oferta", () => {
  const html = buildOfferPdfHtml(data(popularPet));

  assert.ok(html.includes("Uma oferta especial para<br><span style=\"color:var(--ouro)\">Popular Pet</span>"));
  assert.ok(html.includes("O que preparamos para você") && html.includes("Kit com display") && html.includes("Todas as linhas da sua oferta") && html.includes("Como comprar") && html.includes("Sua oferta está pronta"));
  assert.equal((html.match(/<section class="pg/g) ?? []).length, 6);
  assert.ok(html.includes("<b>R$ 9,95</b>") && html.includes("<b>R$ 9,68</b>"));
  assert.ok(html.includes("Oferta válida para o Spray para Hálito – Menta") && html.includes("vale nas suas próximas 3 compras"));
  assert.ok(html.includes("cada unidade rende R$ 25,95 de margem"), "35,90 − 9,95");
  // tabela: linha sem promoção com "—"
  assert.ok(/<b>Floral Adulto<\/b>[\s\S]*?<td class="n ">—<\/td>/.test(html));
  // condições vindas dos parâmetros
  for (const part of ["7%", "Cartão em até 3x</b> com 3% de desconto", "28/42/56", "Parcela mínima de R$ 500,00", "a partir de R$ 450,00", "Pedido mínimo de R$ 250,00"]) assert.ok(html.includes(part), part);
  // todos os botões são links para a oferta (ou para a linha do kit)
  const links = [...html.matchAll(/<a class="btn" href="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(links.length >= 4);
  for (const href of links) assert.ok(href.startsWith(OFFER), href);
  // nunca mais de 2 casas decimais
  assert.ok(!/R\$ \d+,\d{3}/.test(html) && !/\d+,\d{3}%/.test(html));
  assert.ok(html.includes(OFFER_PDF_CSS) && OFFER_PDF_CSS.includes("size:A4 landscape"), "padrão aprovado, A4 paisagem");
});

test("sem linha com display: sem a página do display; sem promoção: sem a página de promoções; impressão automática opcional", () => {
  const html = buildOfferPdfHtml(data([line({ name: "Floral Adulto", slug: "adulto" })]));
  assert.ok(!html.includes("Kit com display") && !html.includes("O que preparamos para você"));
  assert.equal((html.match(/<section class="pg/g) ?? []).length, 4);
  assert.ok(!html.includes("window.print()"));
  assert.ok(buildOfferPdfHtml(data(popularPet), { autoPrint: true }).includes("window.print()"));
  assert.ok(!buildOfferPdfHtml(data([line({ name: "<script>" })])).includes("<script>alert"), "texto escapado");
});

test("rota e botões: /b2b/oferta/<token>/pdf com dados da oferta; Baixar PDF e texto pronto ao lado do link; PDF no card do cliente", () => {
  const route = read("src/app/b2b/oferta/[token]/pdf/route.ts");
  assert.ok(route.includes("loadPublicB2BOfferContext(token)") && route.includes("listOfferPromotionNotices(context.offerId, context.clientId)"));
  assert.ok(route.includes("B2B_PAYMENT_METHOD_DISCOUNT_PERCENT.pix * 100") && route.includes("B2B_BOLETO_DUE_DAYS") && route.includes("B2B_FREIGHT_FLAT_THRESHOLD_CENTS"));
  assert.ok(route.includes('"X-Robots-Tag": "noindex"'));

  assert.equal(OFFER_SHARE_TEXT, "Veja aqui a oferta especial que elaboramos para você. No link a seguir você faz o seu pedido direto e ainda paga com desconto no Pix e no cartão, ou no boleto em até 3x.");
  assert.ok(read("src/components/b2b/LinkSharePanel.tsx").includes("<OfferPdfButton url={url} />"));
  const button = read("src/components/b2b/OfferPdfButton.tsx");
  assert.ok(button.includes('data-testid="baixar-pdf-oferta"') && button.includes("OFFER_SHARE_TEXT"));
  assert.ok(read("src/components/b2b/ClientCardActions.tsx").includes('data-testid="cliente-pdf-oferta"'));
});
