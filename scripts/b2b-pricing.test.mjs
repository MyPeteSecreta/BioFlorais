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

test("frete: Math.min(tarifa regional, real) só na mais barata", () => {
  const opts = [
    { serviceName: "PAC", priceCents: 2500, etaDays: 5 },
    { serviceName: "SEDEX", priceCents: 4000, etaDays: 2 },
  ];
  const prices = (base, uf, o = opts) =>
    p.applyB2BCheapestModalityRule(o, base, uf).map((x) => x.priceCents);
  assert.deepEqual(prices(45000, "SP"), [990, 4000]);
  assert.deepEqual(prices(44999, "SP"), [2500, 4000]);
  assert.deepEqual(prices(45000, "CE"), [2500, 4000]);
  assert.deepEqual(prices(45000, "BA", [{ serviceName: "X", priceCents: 5000, etaDays: 3 }]), [3590]);
  assert.deepEqual(prices(45000, "AM", [{ serviceName: "X", priceCents: 20000, etaDays: 3 }]), [16990]);
  assert.deepEqual(prices(45000, ""), [2500, 4000]);
});
