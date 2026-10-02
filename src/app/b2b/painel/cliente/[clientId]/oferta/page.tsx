/**
 * BIO FLORAIS B2B — Offer Builder (padrão My Pet, Especificação V1.29):
 * cards reais das linhas da Home, check no canto superior esquerdo,
 * "Ver promoções" abre modal com preço B2B normal + promoções da linha e
 * comissão "base + extra = total" lida de b2b_commission_rules.
 * Salva rascunho e leva à revisão obrigatória.
 */

import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { b2bOfferCommercialGroups, b2bOfferPromotions, b2bOffers } from "@/lib/db/schema";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { findOwnedClient, findOwnedOffer, getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { loadLineWindowTexts } from "@/lib/b2b/line-windows";
import OfferBuilder, { type BuilderChoice } from "./OfferBuilder";

export const dynamic = "force-dynamic";

export default async function OfferBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ offerId?: string; linha?: string }>;
}) {
  const { clientId } = await params;
  const { offerId: requestedOfferId, linha } = await searchParams;
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();
  const client = await findOwnedClient(run, responsible.id, clientId);

  if (!client) {
    notFound();
  }

  const [lines, matrix] = await Promise.all([
    loadBuilderLines(new Date(), client.id),
    loadCommissionMatrix(run, responsible.id, client.id),
  ]);
  const windowTextByLine = await loadLineWindowTexts(run, client.id, matrix, lines.map((line) => line.id));

  // Rascunho a editar: o pedido na URL ou o mais recente do cliente.
  let draftId: string | null = null;

  if (requestedOfferId) {
    const owned = await findOwnedOffer(run, responsible.id, requestedOfferId, client.id);

    if (!owned) notFound();

    if (owned.activatedAt || owned.status !== "draft") {
      redirect(`/b2b/painel/cliente/${client.id}/oferta/revisao?offerId=${owned.id}`);
    }

    draftId = owned.id;
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

    draftId = latest?.id ?? null;
  }

  let initialSelected: string[] = [];
  const initialChoices: Record<string, BuilderChoice> = {};

  if (draftId) {
    const groups = await db
      .select({ id: b2bOfferCommercialGroups.commercialGroupId })
      .from(b2bOfferCommercialGroups)
      .where(eq(b2bOfferCommercialGroups.offerId, draftId));

    initialSelected = groups.map((group) => group.id).filter((id) => lines.some((line) => line.id === id));

    const promotions = await db
      .select({
        promotionId: b2bOfferPromotions.promotionId,
        commercialGroupId: b2bOfferPromotions.commercialGroupId,
        eligibilityMode: b2bOfferPromotions.eligibilityMode,
        maxUses: b2bOfferPromotions.maxUses,
        durationDays: b2bOfferPromotions.durationDays,
      })
      .from(b2bOfferPromotions)
      .where(eq(b2bOfferPromotions.offerId, draftId));

    for (const row of promotions) {
      if (
        row.commercialGroupId &&
        (row.eligibilityMode === "uses" || row.eligibilityMode === "days")
      ) {
        initialChoices[row.commercialGroupId] = {
          promotionId: row.promotionId,
          eligibilityMode: row.eligibilityMode,
          maxUses: row.eligibilityMode === "uses" ? row.maxUses : null,
          durationDays: row.eligibilityMode === "days" ? row.durationDays : null,
        };
      }
    }
  }

  // Vindo de "Interesses dos clientes": já marca a linha vista.
  if (linha && lines.some((line) => line.id === linha) && !initialSelected.includes(linha)) {
    initialSelected = [...initialSelected, linha];
  }

  return (
    <OfferBuilder
      clientId={client.id}
      clientName={client.displayName}
      responsibleName={responsible.name}
      offerId={draftId}
      lines={lines}
      matrix={matrix}
      windowTextByLine={windowTextByLine}
      initialSelected={initialSelected}
      initialChoices={initialChoices}
    />
  );
}
