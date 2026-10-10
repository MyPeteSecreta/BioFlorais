/**
 * BIO FLORAIS B2B — Rodada 6: "Link padrão" (L1) e "Minhas ofertas padrão" (L2).
 *
 * Cria, numa só chamada, uma oferta JÁ ATIVA com link: todas as linhas B2B publicadas sem promoção
 * (L1) ou as linhas/promoções de um modelo do vendedor (L2). Usa as MESMAS regras do Offer Builder:
 * validateDraftInput (linha publicada, promoção vigente e disponível para o cliente, elegibilidade
 * configurada na matriz de comissão) e a ativação com vigência por compras/prazo. Promoção do modelo
 * indisponível para aquele cliente sai da oferta (a linha vai com preço normal) e vira AVISO.
 */

import { db } from "@/lib/db/client";
import { b2bClientRelationships, b2bClients, b2bOfferCommercialGroups, b2bOfferPromotions, b2bOffers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findPromotionRule, loadCommissionMatrix, promotionShortLabel, type CommissionMatrix, type EligibilityMode } from "@/lib/b2b/commission";
import { loadBuilderLines, type BuilderLine } from "@/lib/b2b/offer-builder";
import { issueOfferLink } from "@/lib/b2b/offer-link";
import { validateDraftInput } from "@/lib/b2b/offer-draft-input";
import type { SqlRunner } from "@/lib/b2b/ownership";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TemplatePromotion = {
  commercialGroupId: string;
  promotionId: string;
  /** Nome na hora de salvar (para o aviso quando a promoção deixar de existir). */
  promotionName?: string | null;
  eligibilityMode: EligibilityMode;
  maxUses: number | null;
  durationDays: number | null;
};

export type OfferTemplateData = { commercialGroupIds: string[]; promotions: TemplatePromotion[] };

export type TemplateLineReport = {
  id: string;
  name: string;
  /** A linha entra na oferta? (linha deixou de ser publicada = não). */
  included: boolean;
  /** Promoção que ficou (null = preço B2B normal). */
  promotion: { id: string; label: string; eligibility: string } | null;
  /** Aviso mostrado ao vendedor ANTES de gerar. */
  warning: string | null;
};

export type TemplateEvaluation = {
  lines: TemplateLineReport[];
  commercialGroupIds: string[];
  promotions: TemplatePromotion[];
  warnings: string[];
};

function eligibilityText(promotion: TemplatePromotion) {
  return promotion.eligibilityMode === "uses"
    ? `${promotion.maxUses} compra${promotion.maxUses === 1 ? "" : "s"}`
    : `${promotion.durationDays} dias`;
}

function promoLabel(line: BuilderLine, promotionId: string) {
  const promotion = line.promotions.find((item) => item.id === promotionId);

  if (!promotion) return "Promoção";

  return promotion.percent !== null
    ? `${String(promotion.percent).replace(".", ",")}% OFF`
    : promotionShortLabel(promotion.buyQuantity, promotion.freeQuantity);
}

/** L1: todas as linhas B2B publicadas, sem promoção. */
export async function evaluateStandardOffer(clientId: string | null): Promise<TemplateEvaluation> {
  const lines = await loadBuilderLines(new Date(), clientId);

  return {
    lines: lines.map((line) => ({ id: line.id, name: line.name, included: true, promotion: null, warning: null })),
    commercialGroupIds: lines.map((line) => line.id),
    promotions: [],
    warnings: [],
  };
}

/** L2: confere o modelo contra o que está publicado/disponível para ESTE cliente (null = cliente novo). */
export async function evaluateTemplate(
  run: SqlRunner,
  responsibleId: string,
  clientId: string | null,
  template: OfferTemplateData
): Promise<TemplateEvaluation> {
  const [lines, matrix] = await Promise.all([loadBuilderLines(new Date(), clientId), loadCommissionMatrix(run, responsibleId, clientId)]);

  return reconcileTemplate(lines, matrix, template);
}

/** Parte pura da conferência do modelo (testada sem banco). */
export function reconcileTemplate(lines: BuilderLine[], matrix: CommissionMatrix, template: OfferTemplateData): TemplateEvaluation {
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const reports: TemplateLineReport[] = [];
  const groupIds: string[] = [];
  const promotions: TemplatePromotion[] = [];
  const warnings: string[] = [];

  for (const groupId of template.commercialGroupIds) {
    const line = lineById.get(groupId);

    if (!line) {
      const text = "Linha não está mais publicada no B2B: ficou fora desta oferta.";
      reports.push({ id: groupId, name: "Linha indisponível", included: false, promotion: null, warning: text });
      warnings.push(text);
      continue;
    }

    groupIds.push(groupId);
    const chosen = template.promotions.find((item) => item.commercialGroupId === groupId);

    if (!chosen) {
      reports.push({ id: groupId, name: line.name, included: true, promotion: null, warning: null });
      continue;
    }

    const promotion = line.promotions.find((item) => item.id === chosen.promotionId);
    const label = promotion ? promoLabel(line, chosen.promotionId) : chosen.promotionName || "Promoção";
    let reason: string | null = null;

    if (!promotion) {
      reason = "a promoção foi desativada ou saiu da vigência";
    } else if (promotion.available === false) {
      reason = promotion.reason || "indisponível para este cliente";
    } else if (
      !findPromotionRule(matrix, {
        kind: "promotion",
        promotionId: chosen.promotionId,
        eligibilityMode: chosen.eligibilityMode,
        maxUses: chosen.eligibilityMode === "uses" ? chosen.maxUses : null,
        durationDays: chosen.eligibilityMode === "days" ? chosen.durationDays : null,
      })
    ) {
      reason = "a elegibilidade escolhida não está configurada nas regras de comissão";
    }

    if (reason) {
      const text = `${line.name}: ${label} (${eligibilityText(chosen)}) saiu desta oferta, ${reason}. A linha vai com preço B2B normal.`;
      reports.push({ id: groupId, name: line.name, included: true, promotion: null, warning: text });
      warnings.push(text);
      continue;
    }

    promotions.push(chosen);
    reports.push({ id: groupId, name: line.name, included: true, promotion: { id: chosen.promotionId, label, eligibility: eligibilityText(chosen) }, warning: null });
  }

  return { lines: reports, commercialGroupIds: groupIds, promotions, warnings };
}

/** Cria o cliente com só o nome, ligado ao vendedor (como "Novo cliente" do painel). */
export async function createClientForResponsible(responsibleId: string, displayName: string) {
  const [client] = await db.insert(b2bClients).values({ displayName }).returning({ id: b2bClients.id });

  await db.insert(b2bClientRelationships).values({ clientId: client.id, responsibleId });

  return client.id;
}

export type ActiveOfferResult =
  | { ok: true; offerId: string; url: string; whatsappUrl: string; clientId: string; clientName: string }
  | { ok: false; status: number; error: string };

/** Cria a oferta ATIVA (linhas + promoções) e o link. Revalida tudo com as regras do Offer Builder. */
export async function createActiveOffer(
  run: SqlRunner,
  input: {
    responsible: { id: string; name: string };
    client: { id: string; displayName: string; phone: string | null };
    commercialGroupIds: string[];
    promotions: TemplatePromotion[];
  }
): Promise<ActiveOfferResult> {
  const { responsible, client } = input;
  const now = new Date();

  const [lines, matrix] = await Promise.all([loadBuilderLines(now, client.id), loadCommissionMatrix(run, responsible.id, client.id)]);

  const parsed = validateDraftInput(
    {
      commercialGroupIds: input.commercialGroupIds,
      promotions: input.promotions.map((item) => ({
        commercialGroupId: item.commercialGroupId,
        promotionId: item.promotionId,
        eligibilityMode: item.eligibilityMode,
        maxUses: item.maxUses,
        durationDays: item.durationDays,
      })),
    },
    lines,
    matrix
  );

  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const [offer] = await db
    .insert(b2bOffers)
    .values({ clientId: client.id, responsibleId: responsible.id, status: "draft" })
    .returning({ id: b2bOffers.id });

  const promotionRows = parsed.value.conditions.map(({ commercialGroupId, condition }) => {
    if (condition.kind !== "promotion") throw new Error("condição inválida");

    return {
      offerId: offer.id,
      promotionId: condition.promotionId,
      commercialGroupId,
      eligibilityMode: condition.eligibilityMode,
      maxUses: condition.eligibilityMode === "uses" ? condition.maxUses : null,
      durationDays: condition.eligibilityMode === "days" ? condition.durationDays : null,
      usesCount: 0,
      validFrom: now,
      validUntil:
        condition.eligibilityMode === "days" && condition.durationDays ? new Date(now.getTime() + condition.durationDays * DAY_MS) : null,
    };
  });

  await db.batch([
    db.insert(b2bOfferCommercialGroups).values(parsed.value.commercialGroupIds.map((commercialGroupId) => ({ offerId: offer.id, commercialGroupId }))),
    ...(promotionRows.length > 0 ? [db.insert(b2bOfferPromotions).values(promotionRows)] : []),
  ]);

  await db.update(b2bOffers).set({ status: "active", activatedAt: now, updatedAt: now }).where(eq(b2bOffers.id, offer.id));

  const link = await issueOfferLink({
    offerId: offer.id,
    clientName: client.displayName,
    clientPhone: client.phone,
    responsibleName: responsible.name,
  });

  return { ok: true, offerId: offer.id, url: link.url, whatsappUrl: link.whatsappUrl, clientId: client.id, clientName: client.displayName };
}
