/**
 * BIO FLORAIS B2B — criação de oferta (linhas/grupos comerciais e,
 * opcionalmente, promoções) para um cliente do responsável logado.
 * A oferta nasce ativa; o acesso público depende de gerar o link.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bClientRelationships,
  b2bCommercialGroups,
  b2bOfferCommercialGroups,
  b2bOfferPromotions,
  b2bOffers,
  b2bPromotions,
} from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { B2B_SUPPORTED_PROMOTION_TYPE } from "@/lib/b2b/promotion-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)))
    : [];
}

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    clientId?: string;
    commercialGroupIds?: unknown;
    promotionIds?: unknown;
  };

  const clientId = body.clientId?.trim() ?? "";
  const commercialGroupIds = uniqueStrings(body.commercialGroupIds);
  const promotionIds = uniqueStrings(body.promotionIds);

  if (!clientId) {
    return NextResponse.json({ error: "Cliente não informado." }, { status: 400 });
  }

  if (commercialGroupIds.length === 0) {
    return NextResponse.json(
      { error: "Selecione ao menos uma linha para esta oferta." },
      { status: 400 }
    );
  }

  const [relationship] = await db
    .select({ id: b2bClientRelationships.id })
    .from(b2bClientRelationships)
    .where(
      and(
        eq(b2bClientRelationships.clientId, clientId),
        eq(b2bClientRelationships.responsibleId, responsible.id),
        eq(b2bClientRelationships.active, true),
        isNull(b2bClientRelationships.unlinkedAt)
      )
    )
    .limit(1);

  if (!relationship) {
    return NextResponse.json(
      { error: "Este cliente não pertence a este responsável." },
      { status: 403 }
    );
  }

  const validGroups = await db
    .select({ id: b2bCommercialGroups.id })
    .from(b2bCommercialGroups)
    .where(
      and(
        inArray(b2bCommercialGroups.id, commercialGroupIds),
        eq(b2bCommercialGroups.active, true),
        eq(b2bCommercialGroups.b2bVisible, true)
      )
    );

  if (validGroups.length !== commercialGroupIds.length) {
    return NextResponse.json(
      { error: "Uma ou mais linhas selecionadas não estão disponíveis para B2B." },
      { status: 400 }
    );
  }

  if (promotionIds.length > 0) {
    const validPromotions = await db
      .select({ id: b2bPromotions.id })
      .from(b2bPromotions)
      .where(
        and(
          inArray(b2bPromotions.id, promotionIds),
          eq(b2bPromotions.type, B2B_SUPPORTED_PROMOTION_TYPE),
          eq(b2bPromotions.active, true),
          eq(b2bPromotions.sellerSelectable, true)
        )
      );

    if (validPromotions.length !== promotionIds.length) {
      return NextResponse.json(
        { error: "Uma ou mais promoções selecionadas são inválidas." },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  const [offer] = await db
    .insert(b2bOffers)
    .values({
      clientId,
      responsibleId: responsible.id,
      status: "active",
      activatedAt: now,
    })
    .returning({ id: b2bOffers.id });

  await db
    .insert(b2bOfferCommercialGroups)
    .values(commercialGroupIds.map((commercialGroupId) => ({ offerId: offer.id, commercialGroupId })));

  if (promotionIds.length > 0) {
    await db
      .insert(b2bOfferPromotions)
      .values(promotionIds.map((promotionId) => ({ offerId: offer.id, promotionId })));
  }

  return NextResponse.json({ success: true, offerId: offer.id });
}
