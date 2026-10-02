/**
 * Janela de 180 dias da comissão (P2, confirmada em 02/10/2026): os 4 casos
 * do Luis + snapshot por item com basis. Funções puras, sem banco.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  commissionWindowFor,
  describeCommissionWindow,
  resolveItemCommission,
} from "../src/lib/b2b/commission-window.ts";
import { buildOrderItemSnapshots } from "../src/lib/b2b/order-commission.ts";

const DAY = 24 * 60 * 60 * 1000;
const P3 = "11111111-1111-4111-8111-111111111111";
const SONO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COLICA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const first = new Date("2026-10-01T15:00:00Z");

const matrix = {
  configured: true,
  basePercent: 10,
  normalExtraPercent: 15,
  rules: [{ promotionId: P3, eligibilityMode: "uses", maxUses: 2, durationDays: null, extraPercent: 8 }],
};
const terms = [
  { promotionId: P3, name: "3 por 2 - Baby Sono", buyQuantity: 2, freeQuantity: 1, eligibilityMode: "uses", maxUses: 2, durationDays: null },
];

function snapshot(window, bonus) {
  return buildOrderItemSnapshots({
    matrix,
    offerPromotions: terms,
    lines: [
      { productId: SONO, qty: 4, unitPriceCents: 1990 },
      { productId: COLICA, qty: 3, unitPriceCents: 1990 },
    ],
    bonusLines: bonus ? [{ productId: SONO, qty: 2, promotionId: P3 }] : [],
    window,
  });
}

test("cliente sem compra anterior: janela não começou, preço normal 10+15=25", () => {
  const window = commissionWindowFor(null, new Date("2026-10-02T12:00:00Z"));
  assert.equal(window.open, true);
  assert.equal(window.endsAt, null);

  const item = resolveItemCommission({ basePercent: 10, normalExtraPercent: 15, promotionExtraPercent: null, window });
  assert.deepEqual([item.basis, item.extraPercent, item.totalPercent], ["normal_price", 15, 25]);
  assert.match(describeCommissionWindow(matrix, window), /válido por 180 dias a partir da 1ª compra paga; depois 10%/);
});

test("dentro da promoção: item bonificado = base + extra da promoção, mesmo com janela fechada", () => {
  const closed = commissionWindowFor(first, new Date(first.getTime() + 400 * DAY));
  assert.equal(closed.open, false);

  const [sono, , colica] = snapshot(closed, true);

  assert.deepEqual([sono.commissionBasis, sono.commissionExtraPercent, sono.commissionTotalPercent], ["promotion", "8", "18"]);
  assert.equal(sono.promotionName, "3 por 2 - Baby Sono");
  // O item sem bonificação cai na regra do preço normal; janela fechada = só a base.
  assert.deepEqual([colica.commissionBasis, colica.commissionExtraPercent, colica.commissionTotalPercent], ["base_only", "0", "10"]);
});

test("promoção esgotada dentro dos 180 dias: preço normal 10+15=25", () => {
  const open = commissionWindowFor(first, new Date(first.getTime() + 60 * DAY));
  assert.equal(open.open, true);

  // Esgotada = sem bonificação no pedido.
  const items = snapshot(open, false);

  for (const item of items) {
    assert.deepEqual([item.commissionBasis, item.commissionExtraPercent, item.commissionTotalPercent], ["normal_price", "15", "25"]);
  }
});

test("depois de 180 dias: só a base (10%); no dia 180 ainda vale 25%", () => {
  const onDay180 = commissionWindowFor(first, new Date(first.getTime() + 180 * DAY));
  assert.equal(onDay180.open, true);
  assert.equal(resolveItemCommission({ basePercent: 10, normalExtraPercent: 15, promotionExtraPercent: null, window: onDay180 }).totalPercent, 25);

  const after = commissionWindowFor(first, new Date(first.getTime() + 180 * DAY + 1000));
  const item = resolveItemCommission({ basePercent: 10, normalExtraPercent: 15, promotionExtraPercent: null, window: after });
  assert.deepEqual([item.basis, item.extraPercent, item.totalPercent], ["base_only", 0, 10]);
  assert.match(describeCommissionWindow(matrix, after), /encerrada em 30[/]03[/]2027/);
});

test("texto ao vendedor com janela aberta: 10% + 15% = 25% até dd/mm/aaaa; depois 10%", () => {
  const window = commissionWindowFor(first, new Date(first.getTime() + 10 * DAY));
  assert.equal(
    describeCommissionWindow(matrix, window),
    "10% + 15% = 25% até 30/03/2027 (180 dias após a 1ª compra); depois 10%"
  );
});
