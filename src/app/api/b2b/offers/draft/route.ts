/**
 * BIO FLORAIS B2B — Offer Builder: salvar rascunho (status "draft").
 *
 * Não ativa nem gera link: a revisão obrigatória vem antes
 * (/b2b/painel/cliente/[clientId]/oferta/revisao -> .../activate).
 * Isolamento: só clientes do vendedor logado (ownership.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bOfferCommercialGroups, b2bOfferPromotions, b2bOffers } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { findOwnedClient, findOwnedOffer, getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { validateDraftInput } from "@/lib/b2b/offer-draft-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      clientId?: string;
      offerId?: string | null;
      commercialGroupIds?: unknown;
      promotions?: unknown;
    };

    const run = getAppSqlRunner();
    const clientId = String(body.clientId ?? "");
    const client = await findOwnedClient(run, responsible.id, clientId);

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const [lines, matrix] = await Promise.all([
      loadBuilderLines(new Date(), client.id),
      loadCommissionMatrix(run, responsible.id, client.id),
    ]);

    const parsed = validateDraftInput(body, lines, matrix);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Rascunho a atualizar: o informado (se for rascunho deste vendedor/
    // cliente) ou o rascunho mais recente do cliente; senão, um novo.
    let offerId: string | null = null;

    if (body.offerId) {
      const owned = await findOwnedOffer(run, responsible.id, String(body.offerId), client.id);

      if (!owned) {
        return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
      }

      if (owned.status !== "draft" || owned.activatedAt || owned.revokedAt) {
        return NextResponse.json(
          { error: "Esta oferta já foi ativada e não pode ser editada. Monte uma nova oferta." },
          { status: 409 }
        );
      }

      offerId = owned.id;
    } else {
      const [latest] = await db
        .select({ id: b2bOffers.id })
        .from(b2bOffers)
        .where(
          and(
            eq(b2bOffers.clientId, client.id),
            eq(b2bOffers.responsibleId, responsible.id),
            eq(b2bOffers.status, "draft"),
            isNull(b2bOffers.activatedAt),
            isNull(b2bOffers.revokedAt)
          )
        )
        .orderBy(desc(b2bOffers.updatedAt))
        .limit(1);

      offerId = latest?.id ?? null;
    }

    const now = new Date();

    if (!offerId) {
      const [created] = await db
        .insert(b2bOffers)
        .values({ clientId: client.id, responsibleId: responsible.id, status: "draft" })
        .returning({ id: b2bOffers.id });

      offerId = created.id;
    } else {
      await db.update(b2bOffers).set({ updatedAt: now }).where(eq(b2bOffers.id, offerId));
    }

    // Uma transação só (db.batch): ou grava linhas + promoções, ou nada.
    // Antes eram 4 comandos soltos e uma falha no meio deixava a oferta com
    // linhas e sem a promoção escolhida.
    const promotionRows = parsed.value.conditions.map(({ commercialGroupId, condition }) => {
      if (condition.kind !== "promotion") throw new Error("condição inválida");

      return {
        offerId: offerId!,
        promotionId: condition.promotionId,
        commercialGroupId,
        eligibilityMode: condition.eligibilityMode,
        maxUses: condition.eligibilityMode === "uses" ? condition.maxUses : null,
        durationDays: condition.eligibilityMode === "days" ? condition.durationDays : null,
        usesCount: 0,
      };
    });

    await db.batch([
      db.delete(b2bOfferCommercialGroups).where(eq(b2bOfferCommercialGroups.offerId, offerId)),
      db.delete(b2bOfferPromotions).where(eq(b2bOfferPromotions.offerId, offerId)),
      db.insert(b2bOfferCommercialGroups).values(
        parsed.value.commercialGroupIds.map((commercialGroupId) => ({ offerId: offerId!, commercialGroupId }))
      ),
      ...(promotionRows.length > 0 ? [db.insert(b2bOfferPromotions).values(promotionRows)] : []),
    ]);

    // Confere o que ficou gravado antes de dizer "ok".
    const saved = await db
      .select({ promotionId: b2bOfferPromotions.promotionId })
      .from(b2bOfferPromotions)
      .where(eq(b2bOfferPromotions.offerId, offerId));

    if (saved.length !== promotionRows.length) {
      console.error("[b2b/offers/draft] promoções gravadas diferem das enviadas", {
        offerId,
        sent: promotionRows.length,
        saved: saved.length,
      });
      return NextResponse.json(
        { error: "A promoção escolhida não foi gravada. Tente salvar de novo." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, offerId });
  } catch (error) {
    console.error("[b2b/offers/draft]", error);
    return NextResponse.json({ error: "Erro ao salvar a oferta." }, { status: 500 });
  }
}
