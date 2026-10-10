/**
 * BIO FLORAIS B2B — revisão obrigatória concluída: ativa o rascunho e
 * gera o link do cliente.
 *
 * - Só rascunho do próprio vendedor, de cliente ainda vinculado a ele.
 * - Revalida cada condição contra as promoções vigentes e a matriz de
 *   comissão (se algo mudou desde o rascunho, pede para editar).
 * - Elegibilidade por prazo: valid_from = agora, valid_until = agora + N
 *   dias. Por compras: max_uses já gravado; uses_count começa em 0.
 * - Ativação condicional (WHERE status = 'draft'): dois cliques não geram
 *   dois links.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bOfferPromotions, b2bOffers } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { findOwnedClient, findOwnedOffer, getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { loadOfferReviewLines } from "@/lib/b2b/offer-review";
import { issueOfferLink } from "@/lib/b2b/offer-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const { offerId } = await params;
    const body = (await request.json().catch(() => ({}))) as { clientId?: string };
    const run = getAppSqlRunner();

    const offer = await findOwnedOffer(run, responsible.id, offerId, String(body.clientId ?? ""));

    if (!offer) {
      return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
    }

    if (offer.status !== "draft" || offer.activatedAt || offer.revokedAt) {
      return NextResponse.json(
        { error: "Esta oferta já foi ativada. Use \"Gerar novo link\" na página do cliente." },
        { status: 409 }
      );
    }

    const client = await findOwnedClient(run, responsible.id, offer.clientId);

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const [lines, matrix] = await Promise.all([
      loadBuilderLines(new Date(), client.id, offer.id),
      loadCommissionMatrix(run, responsible.id, client.id),
    ]);

    const reviewLines = await loadOfferReviewLines(offer.id, lines, matrix);

    if (reviewLines.length === 0) {
      return NextResponse.json({ error: "A oferta não possui linhas." }, { status: 400 });
    }

    const unavailable = reviewLines.find(
      (line) => line.promotionUnavailable || !lines.some((item) => item.id === line.id)
    );

    if (unavailable) {
      return NextResponse.json(
        {
          error: `A condição da linha ${unavailable.name} não está mais disponível. Volte e edite a oferta.`,
        },
        { status: 409 }
      );
    }

    const now = new Date();

    const [activated] = await db
      .update(b2bOffers)
      .set({ status: "active", activatedAt: now, updatedAt: now })
      .where(
        and(
          eq(b2bOffers.id, offer.id),
          eq(b2bOffers.status, "draft"),
          isNull(b2bOffers.activatedAt)
        )
      )
      .returning({ id: b2bOffers.id });

    if (!activated) {
      return NextResponse.json({ error: "Esta oferta já foi ativada." }, { status: 409 });
    }

    for (const line of reviewLines) {
      if (line.condition.kind !== "promotion") continue;

      await db
        .update(b2bOfferPromotions)
        .set({
          validFrom: now,
          validUntil:
            line.condition.eligibilityMode === "days" && line.condition.durationDays
              ? new Date(now.getTime() + line.condition.durationDays * DAY_MS)
              : null,
          maxUses: line.condition.eligibilityMode === "uses" ? line.condition.maxUses : null,
          usesCount: 0,
        })
        .where(
          and(
            eq(b2bOfferPromotions.offerId, offer.id),
            eq(b2bOfferPromotions.promotionId, line.condition.promotionId),
            eq(b2bOfferPromotions.commercialGroupId, line.id)
          )
        );
    }

    const link = await issueOfferLink({
      offerId: offer.id,
      clientName: client.displayName,
      clientPhone: client.phone,
      responsibleName: responsible.name,
    });

    return NextResponse.json({ ok: true, ...link });
  } catch (error) {
    console.error("[b2b/offers/:id/activate]", error);
    return NextResponse.json({ error: "Erro ao gerar o link da oferta." }, { status: 500 });
  }
}
