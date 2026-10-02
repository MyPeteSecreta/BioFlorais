/**
 * BIO FLORAIS B2B — gravação das promoções pelo admin.
 *
 * Só o tipo com efeito real no servidor da Bio:
 * "buy_x_get_y_auto_same_sku" (a cada X unidades pagas do mesmo produto,
 * Y grátis — calculado em promotion-resolver.ts). Percentual e preço
 * fixo NÃO são oferecidos: hoje não têm efeito no motor de preço.
 *
 * Elegibilidade (promotion-resolver.ts): produtos explícitos têm
 * prioridade; senão, os produtos das linhas vinculadas; sem nenhum dos
 * dois, vale para qualquer produto da oferta.
 */

import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bCommercialGroups,
  b2bCommissionRules,
  b2bPromotionCommercialGroups,
  b2bPromotionProducts,
  products,
} from "@/lib/db/schema";
import { parseInteger, parseSaoPauloDate, parseUuidList } from "@/lib/b2b/admin-input";
import { B2B_SUPPORTED_PROMOTION_TYPE } from "@/lib/b2b/promotion-resolver";
import { parseEligibilities, type EligibilityInput } from "@/lib/b2b/promotion-eligibility-defaults";

export { B2B_SUPPORTED_PROMOTION_TYPE };

export type PromotionInput = {
  name: string;
  /** Obrigatório: abertura_reconquista | recorrente (Rodada 2, R7). */
  promoType: "abertura_reconquista" | "recorrente";
  buyQuantity: number;
  freeQuantity: number;
  active: boolean;
  sellerSelectable: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  groupIds: string[];
  productIds: string[];
  /** Elegibilidades que o vendedor pode escolher, com a comissão extra de cada uma (C1/C2). */
  eligibilities: EligibilityInput[];
  /** false = o chamador não mandou o campo: as regras gravadas ficam como estão. */
  eligibilitiesProvided: boolean;
};

export function parsePromotionBody(
  body: Record<string, unknown>
): { ok: true; value: PromotionInput } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim();
  const buyQuantity = parseInteger(body.buyQuantity, { min: 1, max: 999 });
  const freeQuantity = parseInteger(body.freeQuantity, { min: 1, max: 999 });
  const startsAt = parseSaoPauloDate(body.startsAt, "start");
  const endsAt = parseSaoPauloDate(body.endsAt, "end");
  const groupIds = parseUuidList(body.groupIds);
  const productIds = parseUuidList(body.productIds);

  const promoType = body.promoType;

  if (!name) return { ok: false, error: "Informe o nome da promoção." };
  if (promoType !== "abertura_reconquista" && promoType !== "recorrente") {
    return { ok: false, error: "Escolha o tipo: abertura / reconquista ou recorrente." };
  }
  if (buyQuantity === null) return { ok: false, error: "Quantidade paga inválida (1 a 999)." };
  if (freeQuantity === null) return { ok: false, error: "Quantidade grátis inválida (1 a 999)." };
  if (startsAt === undefined || endsAt === undefined) {
    return { ok: false, error: "Datas inválidas." };
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    return { ok: false, error: "A data final é anterior à inicial." };
  }
  if (groupIds === null || productIds === null) {
    return { ok: false, error: "Lista de linhas/produtos inválida." };
  }

  const eligibilities = parseEligibilities(body.eligibilities);

  if (!eligibilities.ok) return eligibilities;

  // Sem nenhuma elegibilidade o vendedor não consegue escolher a promoção: não pode ficar ativa.
  if (body.eligibilities !== undefined && body.active !== false && eligibilities.value.length === 0) {
    return {
      ok: false,
      error: "Marque ao menos uma elegibilidade (1x/2x/3x compras ou 30/60/90/180 dias) para ativar a promoção.",
    };
  }

  return {
    ok: true,
    value: {
      name,
      promoType,
      buyQuantity,
      freeQuantity,
      active: body.active !== false,
      sellerSelectable: body.sellerSelectable !== false,
      startsAt,
      endsAt,
      groupIds,
      productIds,
      eligibilities: eligibilities.value,
      eligibilitiesProvided: body.eligibilities !== undefined,
    },
  };
}

export async function validatePromotionLinks(input: PromotionInput) {
  if (input.groupIds.length > 0) {
    const found = await db
      .select({ id: b2bCommercialGroups.id })
      .from(b2bCommercialGroups)
      .where(inArray(b2bCommercialGroups.id, input.groupIds));

    if (found.length !== input.groupIds.length) return "Uma ou mais linhas não existem.";
  }

  if (input.productIds.length > 0) {
    const found = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, input.productIds));

    if (found.length !== input.productIds.length) return "Um ou mais produtos não existem.";
  }

  return null;
}

export async function replacePromotionLinks(promotionId: string, input: PromotionInput) {
  await db
    .delete(b2bPromotionCommercialGroups)
    .where(
      input.groupIds.length > 0
        ? and(
            eq(b2bPromotionCommercialGroups.promotionId, promotionId),
            notInArray(b2bPromotionCommercialGroups.commercialGroupId, input.groupIds)
          )
        : eq(b2bPromotionCommercialGroups.promotionId, promotionId)
    );

  if (input.groupIds.length > 0) {
    await db
      .insert(b2bPromotionCommercialGroups)
      .values(input.groupIds.map((commercialGroupId) => ({ promotionId, commercialGroupId })))
      .onConflictDoNothing();
  }

  await db
    .delete(b2bPromotionProducts)
    .where(
      input.productIds.length > 0
        ? and(
            eq(b2bPromotionProducts.promotionId, promotionId),
            notInArray(b2bPromotionProducts.productId, input.productIds)
          )
        : eq(b2bPromotionProducts.promotionId, promotionId)
    );

  if (input.productIds.length > 0) {
    await db
      .insert(b2bPromotionProducts)
      .values(input.productIds.map((productId) => ({ promotionId, productId })))
      .onConflictDoNothing();
  }
}

/**
 * Grava as elegibilidades da promoção como regras GERAIS (sem vendedor nem
 * cliente) em b2b_commission_rules: é daí que o Offer Builder lê as opções
 * e a comissão extra. Regra desmarcada fica inativa (sem DELETE); regra
 * específica de vendedor/cliente não é tocada.
 */
export async function replacePromotionEligibilities(promotionId: string, input: PromotionInput) {
  if (!input.eligibilitiesProvided) return;

  const existing = await db
    .select({
      id: b2bCommissionRules.id,
      mode: b2bCommissionRules.eligibilityMode,
      maxUses: b2bCommissionRules.maxUses,
      durationDays: b2bCommissionRules.durationDays,
    })
    .from(b2bCommissionRules)
    .where(
      and(
        eq(b2bCommissionRules.scope, "promotion_eligibility"),
        eq(b2bCommissionRules.promotionId, promotionId),
        isNull(b2bCommissionRules.responsibleId),
        isNull(b2bCommissionRules.clientId)
      )
    );

  const keep = new Set<string>();

  for (const item of input.eligibilities) {
    const row = existing.find((rule) =>
      item.mode === "uses"
        ? rule.mode === "uses" && rule.maxUses === item.value
        : rule.mode === "days" && rule.durationDays === item.value
    );

    if (row) {
      keep.add(row.id);
      await db
        .update(b2bCommissionRules)
        .set({ extraPercent: String(item.extraPercent), active: true, updatedAt: new Date() })
        .where(eq(b2bCommissionRules.id, row.id));
    } else {
      await db.insert(b2bCommissionRules).values({
        scope: "promotion_eligibility",
        promotionId,
        eligibilityMode: item.mode,
        maxUses: item.mode === "uses" ? item.value : null,
        durationDays: item.mode === "days" ? item.value : null,
        extraPercent: String(item.extraPercent),
      });
    }
  }

  const drop = existing.filter((rule) => !keep.has(rule.id)).map((rule) => rule.id);

  if (drop.length > 0) {
    await db
      .update(b2bCommissionRules)
      .set({ active: false, updatedAt: new Date() })
      .where(inArray(b2bCommissionRules.id, drop));
  }
}

/** Elegibilidades gerais ativas de cada promoção (para o admin editar). */
export async function loadPromotionEligibilities(promotionIds: string[]) {
  const byPromotion = new Map<string, EligibilityInput[]>();

  if (promotionIds.length === 0) return byPromotion;

  const rows = await db
    .select({
      promotionId: b2bCommissionRules.promotionId,
      mode: b2bCommissionRules.eligibilityMode,
      maxUses: b2bCommissionRules.maxUses,
      durationDays: b2bCommissionRules.durationDays,
      extraPercent: b2bCommissionRules.extraPercent,
    })
    .from(b2bCommissionRules)
    .where(
      and(
        eq(b2bCommissionRules.scope, "promotion_eligibility"),
        inArray(b2bCommissionRules.promotionId, promotionIds),
        isNull(b2bCommissionRules.responsibleId),
        isNull(b2bCommissionRules.clientId),
        eq(b2bCommissionRules.active, true)
      )
    );

  for (const row of rows) {
    const value = row.mode === "uses" ? row.maxUses : row.durationDays;

    if (!row.promotionId || (row.mode !== "uses" && row.mode !== "days") || value === null) continue;

    const list = byPromotion.get(row.promotionId) ?? [];
    list.push({ mode: row.mode, value, extraPercent: Number(row.extraPercent ?? 0) });
    byPromotion.set(row.promotionId, list);
  }

  return byPromotion;
}
