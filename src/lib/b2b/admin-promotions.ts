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

import { and, eq, inArray, notInArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bCommercialGroups,
  b2bPromotionCommercialGroups,
  b2bPromotionProducts,
  products,
} from "@/lib/db/schema";
import { parseInteger, parseSaoPauloDate, parseUuidList } from "@/lib/b2b/admin-input";
import { B2B_SUPPORTED_PROMOTION_TYPE } from "@/lib/b2b/promotion-resolver";

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
