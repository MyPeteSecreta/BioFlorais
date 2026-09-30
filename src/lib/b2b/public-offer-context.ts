/**
 * BIO FLORAIS B2B — resolução do link público de oferta (/b2b/oferta/[token]
 * e ?b2b=token no carrinho/checkout).
 *
 * O token bruto chega do navegador, é re-hasheado aqui e comparado com
 * b2b_offer_links.token_hash. Nada de oferta (produtos, preços, cliente)
 * vem do navegador.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bClientRelationships,
  b2bClients,
  b2bCommercialGroupProducts,
  b2bCommercialGroups,
  b2bOfferCommercialGroups,
  b2bOfferLinks,
  b2bOffers,
  b2bResponsibles,
  products,
} from "@/lib/db/schema";
import { hashToken } from "@/lib/b2b/token";

export type PublicB2BProduct = {
  id: string;
  slug: string;
  name: string;
  /** Preço B2C vigente (products.price_cents) — base do preço B2B. */
  b2cPriceCents: number;
  category: string | null;
  commercialGroupIds: string[];
};

export type PublicB2BOfferContext = {
  offerId: string;
  clientId: string;
  clientDisplayName: string;
  responsibleId: string;
  responsibleName: string;
  responsibleType: string;
  commercialGroups: Array<{ id: string; slug: string; name: string }>;
  products: PublicB2BProduct[];
};

export type PublicB2BOfferResolutionError =
  | "invalid_token"
  | "link_revoked_or_expired"
  | "offer_not_active"
  | "client_relationship_inactive";

export type PublicB2BOfferResolution =
  | { ok: true; context: PublicB2BOfferContext }
  | { ok: false; error: PublicB2BOfferResolutionError };

export async function loadPublicB2BOfferContext(
  rawToken: string
): Promise<PublicB2BOfferResolution> {
  const token = String(rawToken ?? "").trim();

  if (!token) {
    return { ok: false, error: "invalid_token" };
  }

  const [link] = await db
    .select()
    .from(b2bOfferLinks)
    .where(eq(b2bOfferLinks.tokenHash, hashToken(token)))
    .limit(1);

  if (!link) {
    return { ok: false, error: "invalid_token" };
  }

  if (link.revokedAt || (link.expiresAt && new Date() > link.expiresAt)) {
    return { ok: false, error: "link_revoked_or_expired" };
  }

  const [offer] = await db
    .select()
    .from(b2bOffers)
    .where(eq(b2bOffers.id, link.offerId))
    .limit(1);

  if (
    !offer ||
    offer.revokedAt ||
    (!offer.activatedAt && offer.status !== "active")
  ) {
    return { ok: false, error: "offer_not_active" };
  }

  const [client] = await db
    .select()
    .from(b2bClients)
    .where(eq(b2bClients.id, offer.clientId))
    .limit(1);

  const [responsible] = await db
    .select({
      id: b2bResponsibles.id,
      name: b2bResponsibles.name,
      type: b2bResponsibles.type,
      status: b2bResponsibles.status,
    })
    .from(b2bResponsibles)
    .where(eq(b2bResponsibles.id, offer.responsibleId))
    .limit(1);

  if (!client || !client.active || !responsible || responsible.status !== "active") {
    return { ok: false, error: "client_relationship_inactive" };
  }

  const [relationship] = await db
    .select({ id: b2bClientRelationships.id })
    .from(b2bClientRelationships)
    .where(
      and(
        eq(b2bClientRelationships.clientId, offer.clientId),
        eq(b2bClientRelationships.responsibleId, offer.responsibleId),
        eq(b2bClientRelationships.active, true),
        isNull(b2bClientRelationships.unlinkedAt)
      )
    )
    .limit(1);

  if (!relationship) {
    return { ok: false, error: "client_relationship_inactive" };
  }

  const commercialGroups = await db
    .select({
      id: b2bCommercialGroups.id,
      slug: b2bCommercialGroups.slug,
      name: b2bCommercialGroups.name,
    })
    .from(b2bOfferCommercialGroups)
    .innerJoin(
      b2bCommercialGroups,
      eq(b2bCommercialGroups.id, b2bOfferCommercialGroups.commercialGroupId)
    )
    .where(
      and(
        eq(b2bOfferCommercialGroups.offerId, offer.id),
        eq(b2bCommercialGroups.active, true),
        eq(b2bCommercialGroups.b2bVisible, true)
      )
    )
    .orderBy(b2bCommercialGroups.sortOrder, b2bCommercialGroups.name);

  let offerProducts: PublicB2BProduct[] = [];

  if (commercialGroups.length > 0) {
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
          inArray(
            b2bCommercialGroupProducts.commercialGroupId,
            commercialGroups.map((group) => group.id)
          ),
          eq(products.active, true)
        )
      )
      .orderBy(products.name);

    const byId = new Map<string, PublicB2BProduct>();

    for (const row of rows) {
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

    offerProducts = Array.from(byId.values());
  }

  return {
    ok: true,
    context: {
      offerId: offer.id,
      clientId: client.id,
      clientDisplayName: client.displayName,
      responsibleId: responsible.id,
      responsibleName: responsible.name,
      responsibleType: responsible.type,
      commercialGroups,
      products: offerProducts,
    },
  };
}

/**
 * Rotas de pagamento B2B: orderId sozinho não é autorização. Exige o
 * mesmo token da oferta, revalida o link e confere que a oferta do
 * token é a oferta gravada no pedido.
 */
export async function verifyB2BOrderOfferToken(
  orderB2BOfferId: string | null | undefined,
  rawToken: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!orderB2BOfferId) {
    return { ok: false, status: 403, error: "Este pedido não é um pedido B2B." };
  }

  const token = rawToken?.trim() ?? "";

  if (!token) {
    return { ok: false, status: 401, error: "Token da oferta B2B não informado." };
  }

  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) {
    return { ok: false, status: 403, error: "Este link de oferta não é mais válido." };
  }

  if (resolution.context.offerId !== orderB2BOfferId) {
    return {
      ok: false,
      status: 403,
      error: "O token informado não corresponde a este pedido.",
    };
  }

  return { ok: true };
}
