/**
 * BIO FLORAIS B2B — linhas fora da oferta e registro de interesse.
 *
 * O cliente, pelo link da oferta, vê também as demais linhas B2B ativas
 * (sem preço). Ao abrir uma delas, gravamos b2b_offer_line_views
 * (oferta, linha, cliente, vendedor, data) — no máximo 1 registro a cada
 * 30 min por oferta+linha — para o vendedor poder mandar nova oferta.
 */

import { and, asc, eq, gt, inArray, notInArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bCommercialGroupProducts,
  b2bCommercialGroups,
  b2bOfferLineViews,
  products,
} from "@/lib/db/schema";
import type { PublicB2BOfferContext } from "@/lib/b2b/public-offer-context";

const VIEW_DEDUP_MS = 30 * 60 * 1000;

/** Linhas B2B ativas e visíveis que NÃO estão na oferta. */
export async function loadOtherB2BLines(context: PublicB2BOfferContext) {
  const offerGroupIds = context.commercialGroups.map((group) => group.id);

  return db
    .select({
      id: b2bCommercialGroups.id,
      slug: b2bCommercialGroups.slug,
      name: b2bCommercialGroups.name,
    })
    .from(b2bCommercialGroups)
    .where(
      and(
        eq(b2bCommercialGroups.active, true),
        eq(b2bCommercialGroups.b2bVisible, true),
        offerGroupIds.length > 0 ? notInArray(b2bCommercialGroups.id, offerGroupIds) : undefined
      )
    )
    .orderBy(asc(b2bCommercialGroups.sortOrder), asc(b2bCommercialGroups.name));
}

export async function findOtherB2BLine(context: PublicB2BOfferContext, slug: string) {
  const lines = await loadOtherB2BLines(context);
  return lines.find((line) => line.slug === slug) ?? null;
}

/** Produtos ativos da linha (sem preço: a linha não faz parte da oferta). */
export async function loadLineProducts(groupId: string) {
  return db
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(b2bCommercialGroupProducts)
    .innerJoin(products, eq(products.id, b2bCommercialGroupProducts.productId))
    .where(
      and(
        inArray(b2bCommercialGroupProducts.commercialGroupId, [groupId]),
        eq(products.active, true)
      )
    )
    .orderBy(asc(products.name));
}

export async function recordOfferLineView(context: PublicB2BOfferContext, groupId: string) {
  const [recent] = await db
    .select({ id: b2bOfferLineViews.id })
    .from(b2bOfferLineViews)
    .where(
      and(
        eq(b2bOfferLineViews.offerId, context.offerId),
        eq(b2bOfferLineViews.commercialGroupId, groupId),
        gt(b2bOfferLineViews.viewedAt, new Date(Date.now() - VIEW_DEDUP_MS))
      )
    )
    .limit(1);

  if (recent) {
    return { recorded: false };
  }

  await db.insert(b2bOfferLineViews).values({
    offerId: context.offerId,
    commercialGroupId: groupId,
    clientId: context.clientId,
    responsibleId: context.responsibleId,
  });

  return { recorded: true };
}
