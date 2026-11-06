// Testes das regras puras do B2B (sem dependência nova).
// Rodar: node --test scripts/b2b-pricing.test.mjs   (Node >= 23.6)
import assert from "node:assert/strict";
import { test } from "node:test";

import * as p from "../src/lib/b2b/pricing.ts";

test("arredondamento: parte inteira em reais + 0,90", () => {
  assert.equal(p.roundB2BUnitPriceCents(2700), 2790);
  assert.equal(p.roundB2BUnitPriceCents(2750), 2790);
  assert.equal(p.roundB2BUnitPriceCents(2795), 2790);
  assert.equal(p.roundB2BUnitPriceCents(2799.5), 2790);
  assert.equal(p.roundB2BUnitPriceCents(2800), 2890);
});

test("preço unitário: floral fixo R$ 19,90; demais 55% arredondado", () => {
  assert.equal(p.resolveB2BUnitPriceCents(4990, "Floral em gotas"), 1990);
  assert.equal(p.resolveB2BUnitPriceCents(4990, "Floral dose única"), 1990);
  assert.equal(p.resolveB2BUnitPriceCents(4990, "FLORAL DOSE UNICA"), 1990);
  assert.equal(p.resolveB2BUnitPriceCents(3990, "Virtudes Divinas"), 1990);
  // 59,90 * 0,55 = 32,945 -> 32,90
  assert.equal(p.resolveB2BUnitPriceCents(5990, "Shampoo"), 3290);
  // 50,00 * 0,55 = 27,50 -> 27,90
  assert.equal(p.resolveB2BUnitPriceCents(5000, "Shampoo"), 2790);
  // 49,00 * 0,55 = 26,95 -> 26,90
  assert.equal(p.resolveB2BUnitPriceCents(4900, null), 2690);
});

test("descontos Pix/cartão só sobre produtos e sem arredondamento ,90", () => {
  assert.deepEqual(p.resolveB2BOrderTotalsByPaymentMethod(50000, 990), {
    pix: 50000 - 3500 + 990,
    card: 50000 - 1500 + 990,
    boleto: 50990,
  });
  assert.equal(p.resolveB2BPaymentMethodDiscountCents(33333, "pix"), 2333);
});

test("mínimo e parcelas", () => {
  assert.equal(p.isB2BOrderAboveMinimum(24999), false);
  assert.equal(p.isB2BOrderAboveMinimum(25000), true);
  assert.equal(p.resolveB2BAllowedInstallments(99999), 1);
  assert.equal(p.resolveB2BAllowedInstallments(100000), 2);
  assert.equal(p.resolveB2BAllowedInstallments(500000), 3);
  const s = p.splitB2BInstallments(100001, 2);
  assert.equal(s.installmentAmountCents + s.lastInstallmentAmountCents, 100001);
});

test("frete (regra do Luis 05/11): abaixo de R$ 450 a mais barata = min(tarifa regional, real); a partir de R$ 450 a mais barata é GRÁTIS; as outras no preço cheio", () => {
  const opts = [
    { serviceName: "PAC", priceCents: 2500, etaDays: 5 },
    { serviceName: "SEDEX", priceCents: 4000, etaDays: 2 },
  ];
  const prices = (base, uf, o = opts) =>
    p.applyB2BCheapestModalityRule(o, base, uf).map((x) => x.priceCents);
  // abaixo de R$ 450: tarifa da região na mais barata
  assert.deepEqual(prices(44999, "SP"), [990, 4000], "Sul/Sudeste R$ 9,90");
  assert.deepEqual(prices(30000, "RS"), [990, 4000]);
  assert.deepEqual(prices(30000, "BA", [{ serviceName: "X", priceCents: 5000, etaDays: 3 }]), [3590], "Centro-Oeste/Nordeste R$ 35,90");
  assert.deepEqual(prices(30000, "CE", [{ serviceName: "X", priceCents: 20000, etaDays: 3 }]), [16990], "Norte/Ceará R$ 169,90");
  assert.deepEqual(prices(30000, "CE"), [2500, 4000], "nunca mais que o preço real");
  assert.deepEqual(prices(30000, "SP", [{ serviceName: "Mini", priceCents: 700, etaDays: 6 }, { serviceName: "PAC", priceCents: 2500, etaDays: 5 }]), [700, 2500], "real menor que a tarifa: paga o real");
  // a partir de R$ 450: grátis na mais barata
  assert.deepEqual(prices(45000, "SP"), [0, 4000]);
  assert.deepEqual(prices(45000, "CE"), [0, 4000]);
  assert.deepEqual(prices(90000, "AM", [{ serviceName: "X", priceCents: 20000, etaDays: 3 }]), [0]);
  // a mais barata é escolhida pelo preço real, em qualquer posição
  assert.deepEqual(prices(45000, "SP", [{ serviceName: "SEDEX", priceCents: 4000, etaDays: 2 }, { serviceName: "PAC", priceCents: 2500, etaDays: 5 }]), [4000, 0]);
  // UF sem região (não verificada): tudo no preço real
  assert.deepEqual(prices(45000, ""), [2500, 4000]);
  assert.deepEqual(prices(30000, "XX"), [2500, 4000]);
  // o custo real é sempre preservado
  assert.deepEqual(p.applyB2BCheapestModalityRule(opts, 45000, "SP").map((x) => x.realPriceCents), [2500, 4000]);
  assert.deepEqual(prices(45000, "SP", []), []);
});

test("frete: textos aprovados (iguais aos da My Pet): faixas, sacola e nota da região depois do CEP", () => {
  assert.equal(p.B2B_SPECIAL_FREIGHT_LABEL, "Frete especial na opção econômica · grátis a partir de R$ 450");
  assert.equal(p.b2bFreeFreightProgressText(27860), "Faltam R$ 171,40 para o frete GRÁTIS na opção econômica.");
  assert.equal(p.b2bFreeFreightProgressText(25000), "Faltam R$ 200,00 para o frete GRÁTIS na opção econômica.");
  assert.equal(p.b2bFreeFreightProgressText(45000), "Frete GRÁTIS na opção econômica!");
  assert.equal(p.b2bEconomyFreightNote(30000, "SP"), "Opção econômica com frete especial: R$ 9,90.");
  assert.equal(p.b2bEconomyFreightNote(30000, "pe"), "Opção econômica com frete especial: R$ 35,90.");
  assert.equal(p.b2bEconomyFreightNote(30000, "CE"), "Opção econômica com frete especial: R$ 169,90.");
  assert.equal(p.b2bEconomyFreightNote(45000, "SP"), null, "a partir de R$ 450 a faixa já diz grátis");
  assert.equal(p.b2bEconomyFreightNote(30000, ""), null);
  assert.equal(p.B2B_MIN_ORDER_CENTS, 25000, "pedido mínimo não muda");
});

test("boleto: vencimentos 28/42/56 dias da data do pedido, soma exata", () => {
  // 01/10/2026 12:00 em São Paulo.
  const schedule = p.buildB2BBoletoSchedule(150001, 3, new Date("2026-10-01T15:00:00Z"));
  assert.deepEqual(schedule.map((item) => item.dueDate), ["2026-10-29", "2026-11-12", "2026-11-26"]);
  assert.deepEqual(schedule.map((item) => item.installment), [1, 2, 3]);
  assert.equal(schedule.reduce((sum, item) => sum + item.amountCents, 0), 150001);
  assert.deepEqual(schedule.map((item) => item.amountCents), [50000, 50000, 50001]);
});

test("boleto: data do pedido pelo calendário de São Paulo, não UTC", () => {
  // 01/10/2026 01:30 UTC = 30/09/2026 22:30 em São Paulo -> base 30/09.
  const schedule = p.buildB2BBoletoSchedule(60000, 1, new Date("2026-10-01T01:30:00Z"));
  assert.deepEqual(schedule, [{ installment: 1, dueDate: "2026-10-28", amountCents: 60000 }]);
});

test("boleto: vira o ano e recusa parcelas inválidas", () => {
  const schedule = p.buildB2BBoletoSchedule(100000, 2, new Date("2026-12-20T15:00:00Z"));
  assert.deepEqual(schedule.map((item) => item.dueDate), ["2027-01-17", "2027-01-31"]);
  assert.throws(() => p.buildB2BBoletoSchedule(100000, 4, new Date()));
  assert.throws(() => p.buildB2BBoletoSchedule(100000, 0, new Date()));
  assert.equal(p.formatB2BDueDate("2027-01-17"), "17/01/2027");
});
