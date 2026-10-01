/**
 * BIO FLORAIS B2B — promoções "compre X, leve Y grátis" de uma oferta.
 *
 * Só o tipo buy_x_get_y_auto_same_sku tem efeito (mesmo recorte da
 * Secreta). Simplificações deliberadas:
 * - um produto recebe no máximo UMA promoção (a primeira elegível);
 * - o limite respeitado é b2b_offer_promotions.max_uses/uses_count.
 */

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bOfferPromotions,
  b2bPromotionCommercialGroups,
  b2bPromotionProducts,
  b2bPromotionTerms,
  b2bPromotions,
} from "@/lib/db/schema";
import { calculateB2BPromotionBonusQty } from "@/lib/b2b/promotion-engine";
import type { PublicB2BProduct } from "@/lib/b2b/public-offer-context";

export const B2B_SUPPORTED_PROMOTION_TYPE = "buy_x_get_y_auto_same_sku";

export type B2BPromotionBonusLine = {
  productId: string;
  qty: number;
  promotionId: string;
};

export async function resolveB2BPromotionBonusLines(
  offerId: string,
  offerProducts: readonly PublicB2BProduct[],
  cartItems: ReadonlyArray<{ productId: string; qty: number }>
): Promise<{ bonusLines: B2BPromotionBonusLine[]; promotionIdsUsed: string[] }> {
  const now = new Date();

  const rows = await db
    .select({
      promotionId: b2bOfferPromotions.promotionId,
      promotionTermId: b2bOfferPromotions.promotionTermId,
      maxUses: b2bOfferPromotions.maxUses,
      usesCount: b2bOfferPromotions.usesCount,
      validFrom: b2bOfferPromotions.validFrom,
      validUntil: b2bOfferPromotions.validUntil,
      type: b2bPromotions.type,
      active: b2bPromotions.active,
      startsAt: b2bPromotions.startsAt,
      endsAt: b2bPromotions.endsAt,
      buyQuantity: b2bPromotions.buyQuantity,
      freeQuantity: b2bPromotions.freeQuantity,
    })
    .from(b2bOfferPromotions)
    .innerJoin(b2bPromotions, eq(b2bPromotions.id, b2bOfferPromotions.promotionId))
    .where(eq(b2bOfferPromotions.offerId, offerId));

  const eligible = rows.filter(
    (row) =>
      row.type === B2B_SUPPORTED_PROMOTION_TYPE &&
      row.active &&
      Boolean(row.buyQuantity) &&
      Boolean(row.freeQuantity) &&
      !(row.startsAt && now < row.startsAt) &&
      !(row.endsAt && now > row.endsAt) &&
      !(row.validFrom && now < row.validFrom) &&
      !(row.validUntil && now > row.validUntil) &&
      !(row.maxUses !== null && row.usesCount >= row.maxUses)
  );

  if (eligible.length === 0) {
    return { bonusLines: [], promotionIdsUsed: [] };
  }

  const termIds = eligible
    .map((row) => row.promotionTermId)
    .filter((id): id is string => Boolean(id));

  const validTermIds = new Set<string>();

  if (termIds.length > 0) {
    const terms = await db
      .select({
        id: b2bPromotionTerms.id,
        active: b2bPromotionTerms.active,
        validUntil: b2bPromotionTerms.validUntil,
      })
      .from(b2bPromotionTerms)
      .where(inArray(b2bPromotionTerms.id, termIds));

    for (const term of terms) {
      if (term.active && !(term.validUntil && now > term.validUntil)) {
        validTermIds.add(term.id);
      }
    }
  }

  const active = eligible.filter(
    (row) => !row.promotionTermId || validTermIds.has(row.promotionTermId)
  );

  if (active.length === 0) {
    return { bonusLines: [], promotionIdsUsed: [] };
  }

  const promotionIds = active.map((row) => row.promotionId);

  const explicitRows = await db
    .select({
      promotionId: b2bPromotionProducts.promotionId,
      productId: b2bPromotionProducts.productId,
    })
    .from(b2bPromotionProducts)
    .where(inArray(b2bPromotionProducts.promotionId, promotionIds));

  const groupRows = await db
    .select({
      promotionId: b2bPromotionCommercialGroups.promotionId,
      commercialGroupId: b2bPromotionCommercialGroups.commercialGroupId,
    })
    .from(b2bPromotionCommercialGroups)
    .where(inArray(b2bPromotionCommercialGroups.promotionId, promotionIds));

  const productsById = new Map(offerProducts.map((product) => [product.id, product]));

  /*
   * Elegibilidade: lista explícita de produtos da promoção > grupos
   * comerciais da promoção > qualquer produto da oferta. Em todos os
   * casos o produto precisa pertencer à oferta.
   */
  function isEligible(promotionId: string, productId: string) {
    const product = productsById.get(productId);

    if (!product) {
      return false;
    }

    const explicit = explicitRows.filter((row) => row.promotionId === promotionId);

    if (explicit.length > 0) {
      return explicit.some((row) => row.productId === productId);
    }

    const groups = groupRows.filter((row) => row.promotionId === promotionId);

    if (groups.length > 0) {
      return groups.some((row) =>
        product.commercialGroupIds.includes(row.commercialGroupId)
      );
    }

    return true;
  }

  const bonusLines: B2BPromotionBonusLine[] = [];
  const used = new Set<string>();

  for (const item of cartItems) {
    const match = active.find((promotion) =>
      isEligible(promotion.promotionId, item.productId)
    );

    if (!match) {
      continue;
    }

    const bonusQty = calculateB2BPromotionBonusQty(
      item.qty,
      match.buyQuantity!,
      match.freeQuantity!
    );

    if (bonusQty > 0) {
      bonusLines.push({
        productId: item.productId,
        qty: bonusQty,
        promotionId: match.promotionId,
      });
      used.add(match.promotionId);
    }
  }

  return { bonusLines, promotionIdsUsed: Array.from(used) };
}

export type B2BOfferPromotionNotice = {
  promotionId: string;
  commercialGroupId: string | null;
  buyQuantity: number;
  freeQuantity: number;
  /** Vazio = vale para a linha inteira; senão, só estes produtos. */
  productIds: string[];
};

/**
 * Promoções vigentes da oferta, só para AVISAR o cliente na página do link
 * ("compre X, leve Y grátis"). O desconto de verdade continua sendo
 * calculado no servidor por resolveB2BPromotionBonusLines.
 */
export async function listOfferPromotionNotices(offerId: string): Promise<B2BOfferPromotionNotice[]> {
  const now = new Date();

  const rows = await db
    .select({
      promotionId: b2bOfferPromotions.promotionId,
      commercialGroupId: b2bOfferPromotions.commercialGroupId,
      maxUses: b2bOfferPromotions.maxUses,
      usesCount: b2bOfferPromotions.usesCount,
      validFrom: b2bOfferPromotions.validFrom,
      validUntil: b2bOfferPromotions.validUntil,
      type: b2bPromotions.type,
      active: b2bPromotions.active,
      startsAt: b2bPromotions.startsAt,
      endsAt: b2bPromotions.endsAt,
      buyQuantity: b2bPromotions.buyQuantity,
      freeQuantity: b2bPromotions.freeQuantity,
    })
    .from(b2bOfferPromotions)
    .innerJoin(b2bPromotions, eq(b2bPromotions.id, b2bOfferPromotions.promotionId))
    .where(eq(b2bOfferPromotions.offerId, offerId));

  const valid = rows.filter(
    (row) =>
      row.type === B2B_SUPPORTED_PROMOTION_TYPE &&
      row.active &&
      Boolean(row.buyQuantity) &&
      Boolean(row.freeQuantity) &&
      !(row.startsAt && now < row.startsAt) &&
      !(row.endsAt && now > row.endsAt) &&
      !(row.validFrom && now < row.validFrom) &&
      !(row.validUntil && now > row.validUntil) &&
      !(row.maxUses !== null && row.usesCount >= row.maxUses)
  );

  if (valid.length === 0) return [];

  const explicit = await db
    .select({ promotionId: b2bPromotionProducts.promotionId, productId: b2bPromotionProducts.productId })
    .from(b2bPromotionProducts)
    .where(inArray(b2bPromotionProducts.promotionId, valid.map((row) => row.promotionId)));

  return valid.map((row) => ({
    promotionId: row.promotionId,
    commercialGroupId: row.commercialGroupId,
    buyQuantity: row.buyQuantity!,
    freeQuantity: row.freeQuantity!,
    productIds: explicit.filter((item) => item.promotionId === row.promotionId).map((item) => item.productId),
  }));
}
