/**
 * ADMIN B2B — promoções: listar e criar ("compre X, leve Y grátis").
 * Promoções de outros tipos já gravadas aparecem só para consulta
 * (supported = false): não têm efeito no servidor da Bio.
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bOfferPromotions,
  b2bPromotionCommercialGroups,
  b2bPromotionProducts,
  b2bPromotions,
} from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { countsAsPurchaseSql } from "@/lib/b2b/purchase-history";
import {
  B2B_SUPPORTED_PROMOTION_TYPE,
  parsePromotionBody,
  loadPromotionEligibilities,
  replacePromotionEligibilities,
  replacePromotionLinks,
  validatePromotionLinks,
} from "@/lib/b2b/admin-promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const promotions = await db
      .select({
        id: b2bPromotions.id,
        name: b2bPromotions.name,
        type: b2bPromotions.type,
        promoType: b2bPromotions.promoType,
        buyQuantity: b2bPromotions.buyQuantity,
        freeQuantity: b2bPromotions.freeQuantity,
        active: b2bPromotions.active,
        sellerSelectable: b2bPromotions.sellerSelectable,
        startsAt: b2bPromotions.startsAt,
        endsAt: b2bPromotions.endsAt,
        createdAt: b2bPromotions.createdAt,
      })
      .from(b2bPromotions)
      .orderBy(desc(b2bPromotions.createdAt));

    const groupLinks = await db
      .select({
        promotionId: b2bPromotionCommercialGroups.promotionId,
        groupId: b2bPromotionCommercialGroups.commercialGroupId,
      })
      .from(b2bPromotionCommercialGroups);

    const productLinks = await db
      .select({
        promotionId: b2bPromotionProducts.promotionId,
        productId: b2bPromotionProducts.productId,
      })
      .from(b2bPromotionProducts);

    const offerCounts = await db
      .select({
        promotionId: b2bOfferPromotions.promotionId,
        offers: sql<number>`count(*)::int`,
      })
      .from(b2bOfferPromotions)
      .groupBy(b2bOfferPromotions.promotionId);

    const eligibilityBy = await loadPromotionEligibilities(promotions.map((promotion) => promotion.id));
    const countsBy = new Map(offerCounts.map((row) => [row.promotionId, row]));

    // Usos = pedidos que receberam a bonificação e contam como compra (R4), não o contador antigo.
    const usesRows = await getAppSqlRunner()(
      `SELECT i.promotion_id AS promotion_id, count(DISTINCT o.id)::int AS used
         FROM orders o JOIN order_items i ON i.order_id = o.id
        WHERE i.promotion_id IS NOT NULL AND coalesce(i.bonus_qty, 0) > 0 AND ${countsAsPurchaseSql("o")}
        GROUP BY i.promotion_id`
    );
    const usesBy = new Map(usesRows.map((row) => [String(row.promotion_id), Number(row.used)]));

    return NextResponse.json({
      promotions: promotions.map((promotion) => ({
        ...promotion,
        supported: promotion.type === B2B_SUPPORTED_PROMOTION_TYPE,
        groupIds: groupLinks.filter((row) => row.promotionId === promotion.id).map((row) => row.groupId),
        productIds: productLinks.filter((row) => row.promotionId === promotion.id).map((row) => row.productId),
        eligibilities: eligibilityBy.get(promotion.id) ?? [],
        offers: Number(countsBy.get(promotion.id)?.offers ?? 0),
        uses: usesBy.get(promotion.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("[admin/b2b/promotions GET]", error);
    return NextResponse.json({ error: "Erro ao carregar promoções." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parsePromotionBody(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Promoção nova ativa sem elegibilidade não seria selecionável pelo vendedor (C1).
    if (parsed.value.active && parsed.value.eligibilities.length === 0) {
      return NextResponse.json(
        { error: "Marque ao menos uma elegibilidade (1x/2x/3x compras ou 30/60/90/180 dias) para ativar a promoção." },
        { status: 400 }
      );
    }

    const linkError = await validatePromotionLinks(parsed.value);

    if (linkError) {
      return NextResponse.json({ error: linkError }, { status: 400 });
    }

    const [promotion] = await db
      .insert(b2bPromotions)
      .values({
        name: parsed.value.name,
        scope: "b2b",
        type: B2B_SUPPORTED_PROMOTION_TYPE,
        promoType: parsed.value.promoType,
        buyQuantity: parsed.value.buyQuantity,
        freeQuantity: parsed.value.freeQuantity,
        active: parsed.value.active,
        sellerSelectable: parsed.value.sellerSelectable,
        startsAt: parsed.value.startsAt,
        endsAt: parsed.value.endsAt,
      })
      .returning({ id: b2bPromotions.id });

    await replacePromotionLinks(promotion.id, parsed.value);
    await replacePromotionEligibilities(promotion.id, parsed.value);

    return NextResponse.json({ ok: true, id: promotion.id });
  } catch (error) {
    console.error("[admin/b2b/promotions POST]", error);
    return NextResponse.json({ error: "Erro ao criar a promoção." }, { status: 500 });
  }
}
