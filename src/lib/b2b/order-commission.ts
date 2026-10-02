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
import { resolveItemCommission, type CommissionBasis, type CommissionWindow } from "./commission-window";

export type OfferPromotionTerms = {
  promotionId: string;
  name: string;
  buyQuantity: number | null;
  freeQuantity: number | null;
  eligibilityMode: string | null;
  maxUses: number | null;
  durationDays: number | null;
};

type QuoteLine = { productId: string; qty: number; unitPriceCents: number; listUnitPriceCents?: number };
type BonusLine = { productId: string; qty: number; promotionId: string };
/** C3: produto com X% de desconto (listUnitPriceCents = preço B2B antes do desconto). */
type DiscountLine = { productId: string; percent: number; promotionId: string };

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
  /** promotion | normal_price | base_only (janela de 180 dias). */
  commissionBasis: CommissionBasis | null;
  /** C3 (sql/b2b/17b): tipo, percentual e valor descontado do item (unit_price já é o efetivo). */
  promotionType: string | null;
  promotionPercent: string | null;
  promotionDiscountCents: number | null;
};

function percentText(value: number | null | undefined) {
  return value === null || value === undefined ? null : String(value);
}

export function buildOrderItemSnapshots(input: {
  matrix: CommissionMatrix;
  offerPromotions: OfferPromotionTerms[];
  lines: QuoteLine[];
  bonusLines: BonusLine[];
  discountLines?: DiscountLine[];
  /** Janela de 180 dias (por cliente e LINHA), avaliada na criação do pedido; função = por produto. */
  window: CommissionWindow | ((productId: string) => CommissionWindow);
}): OrderItemSnapshot[] {
  const termsById = new Map(input.offerPromotions.map((terms) => [terms.promotionId, terms]));
  const bonusByProduct = new Map(input.bonusLines.map((bonus) => [bonus.productId, bonus]));
  const discountByProduct = new Map((input.discountLines ?? []).map((discount) => [discount.productId, discount]));
  const commissionForProduct = (productId: string) => {
    // Item com bonificação OU com desconto % é o item que "realizou" a promoção da oferta.
    const bonus = bonusByProduct.get(productId);
    const discount = discountByProduct.get(productId);
    const realized = bonus ?? discount;
    const terms = realized ? termsById.get(realized.promotionId) : undefined;
    let promotionExtraPercent: number | null = null;
    let promotionTerms: OfferPromotionTerms | undefined;

    if (realized && terms && (terms.eligibilityMode === "uses" || terms.eligibilityMode === "days")) {
      const promotional = commissionFor(input.matrix, {
        kind: "promotion",
        promotionId: terms.promotionId,
        eligibilityMode: terms.eligibilityMode,
        maxUses: terms.eligibilityMode === "uses" ? terms.maxUses : null,
        durationDays: terms.eligibilityMode === "days" ? terms.durationDays : null,
      });

      promotionTerms = terms; // snapshot da promoção mesmo sem regra de comissão
      if (promotional) promotionExtraPercent = promotional.extraPercent;
    }

    // Sem bonificação (ou promoção sem regra): preço normal, limitado à janela de 180 dias.
    const commission = resolveItemCommission({
      basePercent: input.matrix.basePercent,
      normalExtraPercent: input.matrix.normalExtraPercent,
      promotionExtraPercent,
      window: typeof input.window === "function" ? input.window(productId) : input.window,
    });

    return { terms: promotionTerms, commission };
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
      commissionBasis: configured ? configured.basis : null,
      promotionType: terms ? (discountByProduct.has(line.productId) ? "percentage_discount" : "buy_x_get_y_auto_same_sku") : null,
      promotionPercent: discountByProduct.has(line.productId) ? String(discountByProduct.get(line.productId)!.percent) : null,
      promotionDiscountCents: discountByProduct.has(line.productId)
        ? Math.max(0, ((line.listUnitPriceCents ?? line.unitPriceCents) - line.unitPriceCents) * line.qty)
        : null,
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
