import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bClients,
  b2bCommercialGroups,
  b2bOfferCommercialGroups,
  b2bOfferLinks,
  b2bOffers,
} from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const offerRows = await db
    .select({
      id: b2bOffers.id,
      clientId: b2bOffers.clientId,
      clientName: b2bClients.displayName,
      status: b2bOffers.status,
      createdAt: b2bOffers.createdAt,
      revokedAt: b2bOffers.revokedAt,
    })
    .from(b2bOffers)
    .innerJoin(b2bClients, eq(b2bClients.id, b2bOffers.clientId))
    .where(eq(b2bOffers.responsibleId, responsible.id))
    .orderBy(desc(b2bOffers.createdAt));

  const offerIds = offerRows.map((offer) => offer.id);

  const groupRows = offerIds.length
    ? await db
        .select({
          offerId: b2bOfferCommercialGroups.offerId,
          name: b2bCommercialGroups.name,
        })
        .from(b2bOfferCommercialGroups)
        .innerJoin(
          b2bCommercialGroups,
          eq(b2bCommercialGroups.id, b2bOfferCommercialGroups.commercialGroupId)
        )
        .where(inArray(b2bOfferCommercialGroups.offerId, offerIds))
    : [];

  const activeLinkRows = offerIds.length
    ? await db
        .select({ offerId: b2bOfferLinks.offerId })
        .from(b2bOfferLinks)
        .where(and(inArray(b2bOfferLinks.offerId, offerIds), isNull(b2bOfferLinks.revokedAt)))
    : [];

  const withActiveLink = new Set(activeLinkRows.map((row) => row.offerId));

  return NextResponse.json({
    offers: offerRows.map((offer) => ({
      ...offer,
      groups: groupRows.filter((row) => row.offerId === offer.id).map((row) => row.name),
      hasActiveLink: withActiveLink.has(offer.id),
    })),
  });
}
