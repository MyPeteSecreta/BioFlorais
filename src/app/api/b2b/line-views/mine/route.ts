/**
 * BIO FLORAIS B2B — interesses dos clientes do vendedor logado:
 * linhas FORA da oferta que o cliente abriu (agrupado por cliente+linha).
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bClients, b2bCommercialGroups, b2bOfferLineViews } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const lastViewedAt = sql<Date>`max(${b2bOfferLineViews.viewedAt})`;

    const rows = await db
      .select({
        clientId: b2bOfferLineViews.clientId,
        clientName: b2bClients.displayName,
        lineId: b2bOfferLineViews.commercialGroupId,
        lineName: b2bCommercialGroups.name,
        views: sql<number>`count(*)::int`,
        lastViewedAt,
      })
      .from(b2bOfferLineViews)
      .innerJoin(b2bClients, eq(b2bClients.id, b2bOfferLineViews.clientId))
      .innerJoin(b2bCommercialGroups, eq(b2bCommercialGroups.id, b2bOfferLineViews.commercialGroupId))
      .where(eq(b2bOfferLineViews.responsibleId, responsible.id))
      .groupBy(
        b2bOfferLineViews.clientId,
        b2bClients.displayName,
        b2bOfferLineViews.commercialGroupId,
        b2bCommercialGroups.name
      )
      .orderBy(desc(lastViewedAt))
      .limit(100);

    return NextResponse.json({
      interests: rows.map((row) => ({ ...row, views: Number(row.views) })),
    });
  } catch (error) {
    console.error("[b2b/line-views/mine]", error);
    return NextResponse.json({ error: "Erro ao carregar interesses." }, { status: 500 });
  }
}
