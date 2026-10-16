/**
 * BIO FLORAIS B2B — snapshot imutável por item do pedido (promoção aplicada + comissão base + extra
 * congeladas). Extraído de /api/b2b/orders/create para ser a ÚNICA implementação usada na criação do
 * pedido e na prévia de comissão do "Lançar pedido" (o vendedor vê a comissão estimada antes de fechar).
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bOfferPromotions, b2bPromotions } from "@/lib/db/schema";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { buildOrderItemSnapshots } from "@/lib/b2b/order-commission";
import type { SqlRunner } from "@/lib/b2b/ownership";
import type { PublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { commissionWindowForItem, loadClientPurchases, loadReconquistaMonths } from "@/lib/b2b/purchase-history";
import type { B2BQuote } from "@/lib/b2b/quote";

export async function buildQuoteItemSnapshots(
  runSql: SqlRunner,
  context: Pick<PublicB2BOfferContext, "responsibleId" | "clientId" | "offerId">,
  quote: Pick<B2BQuote, "lines" | "bonusLines" | "discountLines">
) {
  const productIds = quote.lines.map((line) => line.productId);

  const [matrix, purchases, reconquistaMonths, groupRows, offerPromotionTerms] = await Promise.all([
    loadCommissionMatrix(runSql, context.responsibleId, context.clientId),
    // Janela de 180 dias por CLIENTE e LINHA (R4/R6), avaliada agora e congelada no item.
    loadClientPurchases(runSql, context.clientId),
    loadReconquistaMonths(runSql),
    runSql(
      `SELECT product_id, commercial_group_id FROM b2b_commercial_group_products WHERE product_id = ANY($1::uuid[])`,
      [productIds]
    ),
    db
      .select({
        promotionId: b2bOfferPromotions.promotionId,
        commercialGroupId: b2bOfferPromotions.commercialGroupId,
        name: b2bPromotions.name,
        buyQuantity: b2bPromotions.buyQuantity,
        freeQuantity: b2bPromotions.freeQuantity,
        eligibilityMode: b2bOfferPromotions.eligibilityMode,
        maxUses: b2bOfferPromotions.maxUses,
        durationDays: b2bOfferPromotions.durationDays,
      })
      .from(b2bOfferPromotions)
      .innerJoin(b2bPromotions, eq(b2bPromotions.id, b2bOfferPromotions.promotionId))
      .where(eq(b2bOfferPromotions.offerId, context.offerId)),
  ]);

  return buildOrderItemSnapshots({
    matrix,
    offerPromotions: offerPromotionTerms,
    lines: quote.lines,
    bonusLines: quote.bonusLines,
    discountLines: quote.discountLines,
    window: (productId) => {
      const nowAt = new Date();
      const groups = groupRows
        .filter((row) => String(row.product_id) === productId)
        .map((row) => String(row.commercial_group_id));
      return commissionWindowForItem(purchases, groups, nowAt, reconquistaMonths);
    },
  });
}
