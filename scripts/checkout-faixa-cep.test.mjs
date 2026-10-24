/*
 * Hotfix do CEP + faixa de benefícios do checkout (B2C e B2B) + cabeçalho/minicards das páginas /para/*.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { B2C_FREE_SHIPPING_THRESHOLD_CENTS, B2C_SHIPPING_SUBSIDY_PERCENT, buildCheckoutBenefits } from "../src/lib/checkout/benefits.ts";
import { B2B_FREIGHT_FLAT_THRESHOLD_CENTS, B2B_PAYMENT_METHOD_DISCOUNT_PERCENT } from "../src/lib/b2b/pricing.ts";
import { bioLines } from "../src/lib/catalog/bio-products.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const labels = (list) => list.map((b) => b.label.replace(/ /g, " "));

test("B2C: abaixo de R$ 100 = frete com desconto (25%) + quanto falta; a partir de R$ 100 = frete grátis; sem Pix/cartão (não existe no B2C)", () => {
  assert.equal(B2C_FREE_SHIPPING_THRESHOLD_CENTS, 10000);
  assert.equal(B2C_SHIPPING_SUBSIDY_PERCENT, 25);

  const below = buildCheckoutBenefits({ kind: "b2c", subtotalCents: 3590, freeShippingThresholdCents: 10000, shippingSubsidyPercent: 25 });
  assert.deepEqual(labels(below), ["Frete com desconto", "Faltam R$ 64,10 para o frete grátis"]);
  assert.equal(below[0].detail, "subsídio de 25%");

  const exact = buildCheckoutBenefits({ kind: "b2c", subtotalCents: 10000, freeShippingThresholdCents: 10000, shippingSubsidyPercent: 25 });
  assert.deepEqual(labels(exact), ["Frete grátis"]);

  assert.deepEqual(buildCheckoutBenefits({ kind: "b2c", subtotalCents: 0, freeShippingThresholdCents: 10000, shippingSubsidyPercent: 25 }), []);
  assert.ok(!labels(below).some((l) => /pix|cartão/i.test(l)), "o B2C da Bio não tem desconto por forma de pagamento");

  // só aparece desconto de pagamento se estiver configurado
  const withPix = buildCheckoutBenefits({ kind: "b2c", subtotalCents: 12000, freeShippingThresholdCents: 10000, shippingSubsidyPercent: 25, paymentDiscountPercent: { pix: 0.05 } });
  assert.deepEqual(labels(withPix), ["Frete grátis", "Pix com desconto"]);
});

test("B2B: NUNCA 'frete grátis' (usa frete especial a partir de R$ 450); Pix 7% e cartão 3% aparecem sem o percentual", () => {
  assert.equal(B2B_FREIGHT_FLAT_THRESHOLD_CENTS, 45000);

  const below = buildCheckoutBenefits({ kind: "b2b", subtotalCents: 27860, specialFreightThresholdCents: B2B_FREIGHT_FLAT_THRESHOLD_CENTS, paymentDiscountPercent: B2B_PAYMENT_METHOD_DISCOUNT_PERCENT });
  assert.deepEqual(labels(below), ["Faltam R$ 171,40 para o frete especial", "Pix com desconto", "Cartão com desconto"]);

  const reached = buildCheckoutBenefits({ kind: "b2b", subtotalCents: 47760, specialFreightThresholdCents: B2B_FREIGHT_FLAT_THRESHOLD_CENTS, paymentDiscountPercent: B2B_PAYMENT_METHOD_DISCOUNT_PERCENT });
  assert.deepEqual(labels(reached), ["Frete especial", "Pix com desconto", "Cartão com desconto"]);

  for (const list of [below, reached]) {
    const text = JSON.stringify(list);
    assert.ok(!/gr[aá]tis/i.test(text), "B2B nunca fala em frete grátis");
    assert.ok(!/\d+\s?%/.test(text), "o percentual do desconto não é mostrado ao comprador");
    assert.ok(!/GPT10|cupom/i.test(text), "faixa genérica: nenhum cupom específico");
  }

  // sem desconto configurado: não aparece benefício que não existe
  const none = buildCheckoutBenefits({ kind: "b2b", subtotalCents: 47760, specialFreightThresholdCents: 45000, paymentDiscountPercent: { pix: 0, card: 0 } });
  assert.deepEqual(labels(none), ["Frete especial"]);
});

test("fiação: faixa no topo do resumo e perto do botão de pagar, nos dois checkouts; B2C usa as constantes da configuração", () => {
  const b2c = read("src/app/checkout/page.tsx");
  const b2b = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");

  for (const src of [b2c, b2b]) {
    assert.equal(src.split("<CheckoutBenefitsBar benefits={checkoutBenefits}").length - 1, 2, "topo do resumo + perto do botão");
  }

  assert.ok(b2c.includes("B2C_FREE_SHIPPING_THRESHOLD_CENTS") && b2c.includes("B2C_SHIPPING_SUBSIDY_PERCENT / 100"));
  assert.ok(!/merchandiseTotalCents\s*>=\s*10000/.test(b2c), "limite do frete grátis vem da configuração, não de número solto");
  assert.ok(b2b.includes("B2B_FREIGHT_FLAT_THRESHOLD_CENTS") && b2b.includes("B2B_PAYMENT_METHOD_DISCOUNT_PERCENT"));

  assert.ok(!/from "@\/lib\/(b2b|catalog)/.test(read("src/components/checkout/CheckoutBenefitsBar.tsx")), "componente reaproveitável: sem dependência do site");
  assert.ok(!/from "@\/lib\/(b2b|catalog)/.test(read("src/lib/checkout/benefits.ts")), "regra reaproveitável: sem dependência do site");
});

test("CEP: frete calculado sempre que o campo tem 8 dígitos (digitação, colagem, autofill, rascunho); resposta de CEP antigo é descartada", () => {
  const src = read("src/app/checkout/page.tsx");

  assert.ok(src.includes("onChange={handleCepChange}") && src.includes("onBlur={handleCepBlur}"));
  assert.ok(src.includes("function handleCepChange") && src.includes("cep.length !== 8"));
  assert.ok(src.includes("window.setInterval") && src.includes('namedItem("postalCode")'), "verificador para autofill e rascunho (sem onChange)");
  assert.ok(src.includes("const shippingDone = loadShipping(cep);"), "o frete não espera o ViaCEP");
  assert.ok(src.includes("cepLookupRef.current !== cep"), "descarta resposta de CEP antigo");

  // os hooks ficam ANTES do retorno da sacola vazia (React #310)
  const emptyReturn = src.indexOf('if (items.length === 0 && pendingOrderStatus !== "paid")');
  assert.ok(src.indexOf("const cepLookupRef = useRef") < emptyReturn);
  assert.ok(src.indexOf("const couponBaseChecked = useRef") < emptyReturn);
});

test("cupom aplicado vale sobre o total ATUAL: quando a sacola muda, o desconto é recalculado pelo servidor (GPT10 ao comprar outros produtos)", () => {
  const src = read("src/app/checkout/page.tsx");

  assert.ok(src.includes("couponBaseChecked.current === quote.totalCents"));
  assert.ok(src.includes("validateCommercialCoupon(appliedCoupon.code, quote.totalCents)"));
  assert.ok(src.includes("validatePartnerCouponUi(appliedPartnerCoupon.code, partnerBaseCents)"));
});

test("/para/*: ícone da sacola com contagem no cabeçalho, minicards de TODAS as linhas (carrossel no celular, grade no desktop), sem sacola flutuante duplicada", () => {
  const page = read("src/app/para/[slug]/page.tsx");
  const cards = read("src/components/campaign/LineMiniCards.tsx");
  const icon = read("src/components/campaign/CampaignCartIcon.tsx");

  assert.ok(page.includes("<CampaignCartIcon />") && page.includes("<LineMiniCards />"));
  assert.ok(page.indexOf('aria-label="Produtos"') < page.indexOf("<LineMiniCards />") && page.indexOf("<LineMiniCards />") < page.indexOf('aria-label="Perguntas frequentes"'));
  assert.ok(icon.includes("useCart") && icon.includes("campanha-sacola-contagem"));
  assert.ok(read("src/components/cart/GlobalCartButton.tsx").includes('pathname?.startsWith("/para/")'));

  assert.ok(cards.includes("overflow-x-auto") && cards.includes("snap-x") && cards.includes("md:grid"), "carrossel no celular, grade no desktop");
  assert.ok(cards.includes("bioLines.map") && cards.includes("/linha/${line.slug}"));
  for (const line of bioLines) assert.ok(cards.includes(`"${line.slug}"`) || cards.includes(`${line.slug}:`), `foto da linha ${line.slug}`);
  assert.equal(bioLines.length, 11);
});

test("CEP com máscara/hífen (01310-100) conta como 8 dígitos: a limpeza usa /\D/g, nunca /D/g", () => {
  const src = read("src/app/checkout/page.tsx");

  assert.ok(!/replace\(\/D\/g/.test(src), "regex sem a barra invertida não tira o hífen");
  assert.equal((src.match(/value\.replace\(\/\\D\/g, ""\)/g) ?? []).length + (src.match(/\?\? ""\)\.replace\(\/\\D\/g, ""\)/g) ?? []).length >= 3, true, "3 pontos de leitura do CEP (verificador, onChange, onBlur)");
  assert.equal("01310-100".replace(/\D/g, "").length, 8);
});

test("Pix com desconto no B2C: 4% sobre os produtos depois dos cupons, arredondado ao centavo, sem frete, sem mostrar o percentual; cartão sem desconto", async () => {
  const { B2C_PIX_DISCOUNT_PERCENT, pixDiscountCents, buildCheckoutTopStrip } = await import("../src/lib/checkout/benefits.ts");

  assert.equal(B2C_PIX_DISCOUNT_PERCENT, 4);
  assert.equal(pixDiscountCents(3231), 129, "R$ 35,90 − cupom R$ 3,59 = R$ 32,31; 4% = R$ 1,29");
  assert.equal(pixDiscountCents(10000), 400);
  assert.equal(pixDiscountCents(0), 0);
  assert.equal(pixDiscountCents(-5), 0);
  assert.equal(pixDiscountCents(1250), 50);
  assert.equal(pixDiscountCents(1262), 50, "arredonda ao centavo");

  // faixa do topo
  assert.deepEqual(buildCheckoutTopStrip({ kind: "b2c", freeShippingThresholdCents: 10000, shippingSubsidyPercent: 25, paymentDiscountPercent: { pix: 0.04 } }), [
    "Frete grátis a partir de R$ 100 (abaixo disso, frete subsidiado)",
    "Desconto no Pix",
  ]);
  assert.deepEqual(buildCheckoutTopStrip({ kind: "b2b", specialFreightThresholdCents: 45000, paymentDiscountPercent: { pix: 0.07, card: 0.03 } }), [
    "Frete especial a partir de R$ 450",
    "Desconto no Pix",
    "Desconto no cartão",
  ]);
  assert.ok(!buildCheckoutTopStrip({ kind: "b2b", specialFreightThresholdCents: 45000, paymentDiscountPercent: { pix: 0.07, card: 0.03 } }).join(" ").match(/gr[aá]tis/i));

  const route = read("src/app/api/orders/create/route.ts");
  const page = read("src/app/checkout/page.tsx");

  // servidor: só Pix, sobre produtos depois de todos os descontos, fora do frete; grava o valor e a forma
  assert.ok(route.includes('requestedPaymentMethod === "pix" ? pixDiscountCents(merchandiseAfterDiscountsCents) : 0'));
  assert.ok(route.includes("merchandiseAfterDiscountsCents - paymentMethodDiscountCents + shippingCents"));
  assert.ok(route.includes("paymentMethodDiscountCents,\n\n          commercialAdjustmentsJson") || route.includes("paymentMethodDiscountCents,"));
  assert.ok(route.includes("creditCents +\n      paymentMethodDiscountCents;"));

  // cliente: mostra só o valor, em três lugares (escolha, resumo, total); cartão sem desconto
  assert.ok(page.includes("a menos no Pix") && page.includes("Desconto no Pix") && page.includes('paymentMethod === "pix" ? pixSavingsCents : 0'));
  assert.ok(page.includes("merchandiseAfterCouponsCents -\n    pixDiscountAppliedCents +\n    customerShippingCents"));
  assert.ok(!/4\s?%/.test(page.replace(/\/\/.*$/gm, "")), "o percentual não aparece na tela");

  // pagamento: cartão não paga pedido criado com desconto do Pix; Mercado Pago usa o total do pedido gravado
  assert.ok(read("src/app/api/payments/mercadopago/card/route.ts").includes("paymentMethodDiscountCents ?? 0) > 0"));
  assert.ok(read("src/app/api/payments/mercadopago/pix/route.ts").includes("order.totalCents"));
});

test("Central/Omie: o desconto por forma de pagamento vai como linha própria (DESCONTO_PIX / DESCONTO_CARTAO); admin mostra a linha", async () => {
  const { paymentDiscountLines } = await import("../src/lib/central/brand-api.ts");

  assert.deepEqual(paymentDiscountLines("pix", "129"), [{ code: "DESCONTO_PIX", label: "Desconto Pix", cents: 129 }]);
  assert.deepEqual(paymentDiscountLines("card", 300), [{ code: "DESCONTO_CARTAO", label: "Desconto cartão", cents: 300 }]);
  assert.deepEqual(paymentDiscountLines(null, null), []);
  assert.deepEqual(paymentDiscountLines("pix", 0), []);

  assert.ok(read("src/lib/central/contract.ts").includes("discountLines?: OrderDiscountLine[]"));
  assert.ok(read("src/lib/central/brand-api.ts").includes("discountLines: paymentDiscountLines("));
  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/page.tsx").includes("admin-desconto-pagamento"));
});
