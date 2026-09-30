/**
 * BIO FLORAIS B2B — gerar (POST) ou revogar (DELETE) o link público da
 * oferta. Gerar um novo link revoga o anterior (no máximo 1 ativo). O
 * token bruto só existe nesta resposta; o banco guarda o hash.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bClientRelationships,
  b2bOfferCommercialGroups,
  b2bOfferLinks,
  b2bOffers,
} from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { generateOpaqueToken, hashToken } from "@/lib/b2b/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readOfferId(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { offerId?: string };
  return body.offerId?.trim() ?? "";
}

async function loadOwnedOffer(offerId: string, responsibleId: string) {
  const [offer] = await db
    .select({ id: b2bOffers.id, clientId: b2bOffers.clientId, revokedAt: b2bOffers.revokedAt })
    .from(b2bOffers)
    .where(and(eq(b2bOffers.id, offerId), eq(b2bOffers.responsibleId, responsibleId)))
    .limit(1);

  return offer ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const responsible = await requireResponsible(request);

    if (!responsible) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const offerId = await readOfferId(request);
    const offer = offerId ? await loadOwnedOffer(offerId, responsible.id) : null;

    if (!offer || offer.revokedAt) {
      return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
    }

    const [relationship] = await db
      .select({ id: b2bClientRelationships.id })
      .from(b2bClientRelationships)
      .where(
        and(
          eq(b2bClientRelationships.clientId, offer.clientId),
          eq(b2bClientRelationships.responsibleId, responsible.id),
          eq(b2bClientRelationships.active, true),
          isNull(b2bClientRelationships.unlinkedAt)
        )
      )
      .limit(1);

    if (!relationship) {
      return NextResponse.json(
        { error: "Este cliente não está mais vinculado a você." },
        { status: 403 }
      );
    }

    const [groups] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(b2bOfferCommercialGroups)
      .where(eq(b2bOfferCommercialGroups.offerId, offer.id));

    if (!groups || Number(groups.total) < 1) {
      return NextResponse.json(
        { error: "A oferta não possui linhas comerciais." },
        { status: 400 }
      );
    }

    await db
      .update(b2bOfferLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(b2bOfferLinks.offerId, offer.id), isNull(b2bOfferLinks.revokedAt)));

    const token = generateOpaqueToken();

    await db.insert(b2bOfferLinks).values({
      offerId: offer.id,
      tokenHash: hashToken(token),
      expiresAt: null,
    });

    return NextResponse.json({
      ok: true,
      path: `/b2b/oferta/${token}`,
    });
  } catch (error) {
    console.error("[b2b/offers/link POST]", error);
    return NextResponse.json({ error: "Erro ao gerar link." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const responsible = await requireResponsible(request);

    if (!responsible) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const offerId = await readOfferId(request);
    const offer = offerId ? await loadOwnedOffer(offerId, responsible.id) : null;

    if (!offer) {
      return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
    }

    await db
      .update(b2bOfferLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(b2bOfferLinks.offerId, offer.id), isNull(b2bOfferLinks.revokedAt)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[b2b/offers/link DELETE]", error);
    return NextResponse.json({ error: "Erro ao revogar link." }, { status: 500 });
  }
}
