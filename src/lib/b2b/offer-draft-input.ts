/**
 * BIO FLORAIS B2B — validação do rascunho do Offer Builder (pura, sem
 * banco). Testada em scripts/b2b-offer-builder.test.mjs.
 */

import type { CommissionMatrix, EligibilityMode, OfferCondition } from "@/lib/b2b/commission";
import { findPromotionRule } from "@/lib/b2b/commission";

/** Formato mínimo de linha que a validação precisa (BuilderLine serve). */
export type DraftValidationLine = {
  id: string;
  name: string;
  promotions: Array<{ id: string; available?: boolean; reason?: string }>;
};

export type DraftLineCondition = {
  commercialGroupId: string;
  condition: OfferCondition;
};

export type DraftInput = {
  commercialGroupIds: string[];
  conditions: DraftLineCondition[];
};

type RawCondition = {
  commercialGroupId?: unknown;
  promotionId?: unknown;
  eligibilityMode?: unknown;
  maxUses?: unknown;
  durationDays?: unknown;
};

/**
 * Valida o que o navegador mandou contra as linhas/promoções vigentes e a
 * matriz de comissão: só linhas visíveis, só promoções daquela linha, só
 * elegibilidades configuradas (1x/2x/3x, 30/60/90/180 dias...). Linha sem
 * condição = preço B2B normal.
 */
export function validateDraftInput(
  body: { commercialGroupIds?: unknown; promotions?: unknown },
  lines: DraftValidationLine[],
  matrix: CommissionMatrix
): { ok: true; value: DraftInput } | { ok: false; error: string } {
  const lineById = new Map(lines.map((line) => [line.id, line]));

  const groupIds = Array.isArray(body.commercialGroupIds)
    ? Array.from(new Set(body.commercialGroupIds.filter((id): id is string => typeof id === "string")))
    : [];

  if (groupIds.length === 0) {
    return { ok: false, error: "Selecione pelo menos uma linha." };
  }

  if (groupIds.some((id) => !lineById.has(id))) {
    return { ok: false, error: "Uma ou mais linhas não estão disponíveis para B2B." };
  }

  const rawConditions = Array.isArray(body.promotions) ? (body.promotions as RawCondition[]) : [];
  const conditions: DraftLineCondition[] = [];
  const seenGroups = new Set<string>();
  const seenPromotions = new Set<string>();

  for (const raw of rawConditions) {
    const groupId = typeof raw?.commercialGroupId === "string" ? raw.commercialGroupId : "";
    const promotionId = typeof raw?.promotionId === "string" ? raw.promotionId : "";
    const mode = raw?.eligibilityMode as EligibilityMode;

    if (!groupIds.includes(groupId)) {
      return { ok: false, error: "Promoção escolhida para uma linha que não está na oferta." };
    }

    if (seenGroups.has(groupId)) {
      return { ok: false, error: "Escolha apenas uma condição por linha." };
    }

    const line = lineById.get(groupId)!;

    const chosen = line.promotions.find((promotion) => promotion.id === promotionId);

    if (!chosen) {
      return { ok: false, error: `A promoção escolhida não está disponível para a linha ${line.name}.` };
    }

    // O servidor revalida a elegibilidade do CLIENTE (abertura x recorrente): não confia na tela.
    if (chosen.available === false) {
      return { ok: false, error: chosen.reason || `Promoção indisponível para este cliente na linha ${line.name}.` };
    }

    if (seenPromotions.has(promotionId)) {
      return { ok: false, error: "A mesma promoção foi escolhida para duas linhas." };
    }

    if (mode !== "uses" && mode !== "days") {
      return { ok: false, error: "Escolha por número de compras ou por período." };
    }

    const condition = {
      kind: "promotion" as const,
      promotionId,
      eligibilityMode: mode,
      maxUses: mode === "uses" ? Number(raw.maxUses) : null,
      durationDays: mode === "days" ? Number(raw.durationDays) : null,
    };

    if (!findPromotionRule(matrix, condition)) {
      return {
        ok: false,
        error: `Elegibilidade não configurada para a promoção da linha ${line.name}.`,
      };
    }

    seenGroups.add(groupId);
    seenPromotions.add(promotionId);
    conditions.push({ commercialGroupId: groupId, condition });
  }

  return { ok: true, value: { commercialGroupIds: groupIds, conditions } };
}
