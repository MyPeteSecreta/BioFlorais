/**
 * BIO FLORAIS B2B — linhas fora da oferta e registro de interesse.
 *
 * O cliente, pelo link da oferta, vê e COMPRA também as demais linhas B2B
 * ativas pelo PREÇO B2B NORMAL, sem promoção (decisão do Luis, 01/10).
 * Ao abrir uma delas, gravamos b2b_offer_line_views
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
import type { PublicB2BOfferContext, PublicB2BProduct } from "@/lib/b2b/public-offer-context";

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

/**
 * Produtos ativos das linhas B2B que NÃO estão na oferta, que o cliente
 * pode comprar pelo preço B2B normal. Nunca entram no motor de promoção
 * (que recebe só context.products), então promoção não se aplica a eles.
 * Produto que também está numa linha da oferta fica só na oferta.
 */
export async function loadOtherLineProducts(
  context: PublicB2BOfferContext,
  onlyGroupId?: string
): Promise<PublicB2BProduct[]> {
  const lines = await loadOtherB2BLines(context);
  const groupIds = lines
    .map((line) => line.id)
    .filter((id) => !onlyGroupId || id === onlyGroupId);

  if (groupIds.length === 0) return [];

  const offerProductIds = new Set(context.products.map((product) => product.id));

  const rows = await db
    .select({
      commercialGroupId: b2bCommercialGroupProducts.commercialGroupId,
      id: products.id,
      slug: products.slug,
      name: products.name,
      priceCents: products.priceCents,
      category: products.category,
    })
    .from(b2bCommercialGroupProducts)
    .innerJoin(products, eq(products.id, b2bCommercialGroupProducts.productId))
    .where(
      and(
        inArray(b2bCommercialGroupProducts.commercialGroupId, groupIds),
        eq(products.active, true)
      )
    )
    .orderBy(asc(products.name));

  const byId = new Map<string, PublicB2BProduct>();

  for (const row of rows) {
    if (offerProductIds.has(row.id)) continue;

    const existing = byId.get(row.id);

    if (existing) {
      existing.commercialGroupIds.push(row.commercialGroupId);
      continue;
    }

    byId.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      b2cPriceCents: row.priceCents,
      category: row.category,
      commercialGroupIds: [row.commercialGroupId],
    });
  }

  return Array.from(byId.values());
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
