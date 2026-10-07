/**
 * ADMIN B2B — acompanhamento: ofertas geradas, pedidos B2B, solicitações
 * de boleto (parcelas e vencimentos) e linhas abertas fora da oferta.
 * Últimos 200 registros de cada bloco.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bBoletoRequests,
  b2bClients,
  b2bCommercialGroups,
  b2bOfferCommercialGroups,
  b2bOfferLineViews,
  b2bOfferLinks,
  b2bOfferPromotions,
  b2bOffers,
  b2bPromotions,
  b2bResponsibles,
  customers,
  orders,
} from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 200;

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    // ---------------------------------------------------------------- ofertas
    const offerRows = await db
      .select({
        id: b2bOffers.id,
        createdAt: b2bOffers.createdAt,
        status: b2bOffers.status,
        revokedAt: b2bOffers.revokedAt,
        responsibleName: b2bResponsibles.name,
        clientName: b2bClients.displayName,
      })
      .from(b2bOffers)
      .innerJoin(b2bResponsibles, eq(b2bResponsibles.id, b2bOffers.responsibleId))
      .innerJoin(b2bClients, eq(b2bClients.id, b2bOffers.clientId))
      .orderBy(desc(b2bOffers.createdAt))
      .limit(LIMIT);

    const offerIds = offerRows.map((offer) => offer.id);

    const [offerGroups, offerPromotions, activeLinks, anyLinks] = offerIds.length
      ? await Promise.all([
          db
            .select({ offerId: b2bOfferCommercialGroups.offerId, name: b2bCommercialGroups.name })
            .from(b2bOfferCommercialGroups)
            .innerJoin(b2bCommercialGroups, eq(b2bCommercialGroups.id, b2bOfferCommercialGroups.commercialGroupId))
            .where(inArray(b2bOfferCommercialGroups.offerId, offerIds)),
          db
            .select({ offerId: b2bOfferPromotions.offerId, name: b2bPromotions.name })
            .from(b2bOfferPromotions)
            .innerJoin(b2bPromotions, eq(b2bPromotions.id, b2bOfferPromotions.promotionId))
            .where(inArray(b2bOfferPromotions.offerId, offerIds)),
          db
            .select({ offerId: b2bOfferLinks.offerId })
            .from(b2bOfferLinks)
            .where(and(inArray(b2bOfferLinks.offerId, offerIds), isNull(b2bOfferLinks.revokedAt))),
          db
            .select({ offerId: b2bOfferLinks.offerId })
            .from(b2bOfferLinks)
            .where(inArray(b2bOfferLinks.offerId, offerIds)),
        ])
      : [[], [], [], []];

    const activeLinkSet = new Set(activeLinks.map((row) => row.offerId));
    const anyLinkSet = new Set(anyLinks.map((row) => row.offerId));

    const offers = offerRows.map((offer) => ({
      ...offer,
      groups: offerGroups.filter((row) => row.offerId === offer.id).map((row) => row.name),
      promotions: offerPromotions.filter((row) => row.offerId === offer.id).map((row) => row.name),
      linkStatus: activeLinkSet.has(offer.id)
        ? "active"
        : anyLinkSet.has(offer.id)
          ? "revoked"
          : "none",
    }));

    // ---------------------------------------------------------------- pedidos
    const orderRows = await db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        status: orders.status,
        fulfillmentStatus: orders.fulfillmentStatus,
        paymentMethod: orders.paymentMethod,
        totalCents: orders.totalCents,
        responsibleName: orders.b2bResponsibleName,
        customerName: customers.name,
        personType: customers.personType,
        clientName: b2bClients.displayName,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(b2bClients, eq(b2bClients.id, orders.b2bClientId))
      .where(isNotNull(orders.b2bOfferId))
      .orderBy(desc(orders.createdAt))
      .limit(LIMIT);

    // ---------------------------------------------------------------- boletos
    const boletos = await db
      .select({
        id: b2bBoletoRequests.id,
        orderId: b2bBoletoRequests.orderId,
        amountCents: b2bBoletoRequests.amountCents,
        installments: b2bBoletoRequests.installments,
        schedule: b2bBoletoRequests.schedule,
        status: b2bBoletoRequests.status,
        requestedAt: b2bBoletoRequests.requestedAt,
        orderStatus: orders.status,
        customerName: customers.name,
      })
      .from(b2bBoletoRequests)
      .innerJoin(orders, eq(orders.id, b2bBoletoRequests.orderId))
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .orderBy(desc(b2bBoletoRequests.requestedAt))
      .limit(LIMIT);

    // ---------------------------------------------- linhas fora da oferta
    const lastViewedAt = sql<Date>`max(${b2bOfferLineViews.viewedAt})`;

    const lineViews = await db
      .select({
        offerId: b2bOfferLineViews.offerId,
        clientName: b2bClients.displayName,
        responsibleName: b2bResponsibles.name,
        lineName: b2bCommercialGroups.name,
        views: sql<number>`count(*)::int`,
        lastViewedAt,
      })
      .from(b2bOfferLineViews)
      .innerJoin(b2bClients, eq(b2bClients.id, b2bOfferLineViews.clientId))
      .innerJoin(b2bResponsibles, eq(b2bResponsibles.id, b2bOfferLineViews.responsibleId))
      .innerJoin(b2bCommercialGroups, eq(b2bCommercialGroups.id, b2bOfferLineViews.commercialGroupId))
      .groupBy(
        b2bOfferLineViews.offerId,
        b2bClients.displayName,
        b2bResponsibles.name,
        b2bCommercialGroups.name
      )
      .orderBy(desc(lastViewedAt))
      .limit(LIMIT);

    return NextResponse.json({
      offers,
      orders: orderRows,
      boletos: boletos.map((row) => ({ ...row, schedule: row.schedule ?? [] })),
      lineViews: lineViews.map((row) => ({ ...row, views: Number(row.views) })),
    });
  } catch (error) {
    console.error("[admin/b2b/tracking GET]", error);
    return NextResponse.json({ error: "Erro ao carregar o acompanhamento." }, { status: 500 });
  }
}
