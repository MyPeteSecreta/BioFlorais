/**
 * BIO FLORAIS B2B — leitura de uma oferta para a revisão obrigatória e
 * para a ativação (condição + comissão de cada linha). Só para a área do
 * vendedor: devolve comissão.
 */

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bCommercialGroups,
  b2bOfferCommercialGroups,
  b2bOfferPromotions,
} from "@/lib/db/schema";
import {
  commissionFor,
  type CommissionMatrix,
  type OfferCondition,
} from "@/lib/b2b/commission";
import type { BuilderLine, BuilderPromotion } from "@/lib/b2b/offer-builder";
import { homeLineImage } from "@/lib/b2b/line-images";

export type ReviewLine = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  condition: OfferCondition;
  promotion: BuilderPromotion | null;
  /** Promoção salva que deixou de valer (inativa, fora da vigência, sem regra). */
  promotionUnavailable: boolean;
  commission: { basePercent: number; extraPercent: number; totalPercent: number } | null;
};

export async function loadOfferReviewLines(
  offerId: string,
  lines: BuilderLine[],
  matrix: CommissionMatrix
): Promise<ReviewLine[]> {
  const groups = await db
    .select({
      id: b2bCommercialGroups.id,
      slug: b2bCommercialGroups.slug,
      name: b2bCommercialGroups.name,
    })
    .from(b2bOfferCommercialGroups)
    .innerJoin(b2bCommercialGroups, eq(b2bCommercialGroups.id, b2bOfferCommercialGroups.commercialGroupId))
    .where(eq(b2bOfferCommercialGroups.offerId, offerId))
    .orderBy(asc(b2bCommercialGroups.sortOrder), asc(b2bCommercialGroups.name));

  const promotions = await db
    .select({
      promotionId: b2bOfferPromotions.promotionId,
      commercialGroupId: b2bOfferPromotions.commercialGroupId,
      eligibilityMode: b2bOfferPromotions.eligibilityMode,
      maxUses: b2bOfferPromotions.maxUses,
      durationDays: b2bOfferPromotions.durationDays,
    })
    .from(b2bOfferPromotions)
    .where(eq(b2bOfferPromotions.offerId, offerId));

  const lineById = new Map(lines.map((line) => [line.id, line]));

  return groups.map((group) => {
    const saved = promotions.find((row) => row.commercialGroupId === group.id);

    if (!saved || (saved.eligibilityMode !== "uses" && saved.eligibilityMode !== "days")) {
      const condition: OfferCondition = { kind: "normal" };

      return {
        ...group,
        image: homeLineImage(group.slug),
        condition,
        promotion: null,
        promotionUnavailable: Boolean(saved),
        commission: commissionFor(matrix, condition),
      };
    }

    const condition: OfferCondition = {
      kind: "promotion",
      promotionId: saved.promotionId,
      eligibilityMode: saved.eligibilityMode,
      maxUses: saved.eligibilityMode === "uses" ? saved.maxUses : null,
      durationDays: saved.eligibilityMode === "days" ? saved.durationDays : null,
    };

    const promotion =
      lineById.get(group.id)?.promotions.find((item) => item.id === saved.promotionId) ?? null;
    const commission = commissionFor(matrix, condition);

    return {
      ...group,
      image: homeLineImage(group.slug),
      condition,
      promotion,
      promotionUnavailable: !promotion || !commission,
      commission,
    };
  });
}

export function describeEligibility(condition: OfferCondition) {
  if (condition.kind === "normal") return "Preço B2B normal, sem promoção de quantidade.";
  if (condition.eligibilityMode === "uses") {
    return condition.maxUses === 1
      ? "Válida para 1 compra."
      : `Válida para ${condition.maxUses} compras.`;
  }
  return `Compras ilimitadas por ${condition.durationDays} dias a partir da geração do link.`;
}
