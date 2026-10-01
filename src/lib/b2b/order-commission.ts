/**
 * BIO FLORAIS B2B — comissão congelada no pedido (Especificação V1.27 §45:
 * "o pedido final recebe snapshot imutável da comissão-base, extra e
 * final efetivamente aplicada").
 *
 * Por item (order_items):
 * - produto que RECEBEU bonificação de uma promoção da oferta -> extra da
 *   promoção na elegibilidade escolhida na oferta (uses/days);
 * - demais itens (inclusive de linha com promoção que não chegou a
 *   bonificar) -> extra do preço B2B normal.
 * Base = comissão-base do vendedor/cliente. Snapshot fica no item: mudar
 * a matriz depois não altera pedidos já criados.
 *
 * Parte pura (buildOrderItemSnapshots) testada em
 * scripts/b2b-order-commission.test.mjs.
 */

import { commissionFor, type CommissionMatrix } from "./commission";

export type OfferPromotionTerms = {
  promotionId: string;
  name: string;
  buyQuantity: number | null;
  freeQuantity: number | null;
  eligibilityMode: string | null;
  maxUses: number | null;
  durationDays: number | null;
};

type QuoteLine = { productId: string; qty: number; unitPriceCents: number };
type BonusLine = { productId: string; qty: number; promotionId: string };

export type OrderItemSnapshot = {
  productId: string;
  qty: number;
  unitPriceCents: number;
  paidQty: number;
  bonusQty: number;
  physicalQty: number;
  promotionId: string | null;
  promotionName: string | null;
  promotionBuyQuantity: number | null;
  promotionFreeQuantity: number | null;
  commissionBasePercent: string | null;
  commissionExtraPercent: string | null;
  commissionTotalPercent: string | null;
};

function percentText(value: number | null | undefined) {
  return value === null || value === undefined ? null : String(value);
}

export function buildOrderItemSnapshots(input: {
  matrix: CommissionMatrix;
  offerPromotions: OfferPromotionTerms[];
  lines: QuoteLine[];
  bonusLines: BonusLine[];
}): OrderItemSnapshot[] {
  const termsById = new Map(input.offerPromotions.map((terms) => [terms.promotionId, terms]));
  const bonusByProduct = new Map(input.bonusLines.map((bonus) => [bonus.productId, bonus]));
  const normal = commissionFor(input.matrix, { kind: "normal" });

  const commissionForProduct = (productId: string) => {
    const bonus = bonusByProduct.get(productId);
    const terms = bonus ? termsById.get(bonus.promotionId) : undefined;

    if (bonus && terms && (terms.eligibilityMode === "uses" || terms.eligibilityMode === "days")) {
      const promotional = commissionFor(input.matrix, {
        kind: "promotion",
        promotionId: terms.promotionId,
        eligibilityMode: terms.eligibilityMode,
        maxUses: terms.eligibilityMode === "uses" ? terms.maxUses : null,
        durationDays: terms.eligibilityMode === "days" ? terms.durationDays : null,
      });

      return { terms, commission: promotional ?? normal };
    }

    return { terms: undefined, commission: normal };
  };

  const snapshots: OrderItemSnapshot[] = [];

  for (const line of input.lines) {
    const bonus = bonusByProduct.get(line.productId);
    const { terms, commission } = commissionForProduct(line.productId);
    const configured = input.matrix.configured ? commission : null;

    const shared = {
      paidQty: line.qty,
      bonusQty: bonus?.qty ?? 0,
      physicalQty: line.qty + (bonus?.qty ?? 0),
      promotionId: terms?.promotionId ?? null,
      promotionName: terms?.name ?? null,
      promotionBuyQuantity: terms?.buyQuantity ?? null,
      promotionFreeQuantity: terms?.freeQuantity ?? null,
      commissionBasePercent: percentText(configured?.basePercent),
      commissionExtraPercent: percentText(configured?.extraPercent),
      commissionTotalPercent: percentText(configured?.totalPercent),
    };

    snapshots.push({
      productId: line.productId,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      ...shared,
    });

    // Unidades bonificadas: item à parte com preço zero (já era assim).
    if (bonus && bonus.qty > 0) {
      snapshots.push({
        productId: line.productId,
        qty: bonus.qty,
        unitPriceCents: 0,
        ...shared,
      });
    }
  }

  return snapshots;
}
