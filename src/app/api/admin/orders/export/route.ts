/**
 * ADMIN — exporta os pedidos em CSV com a origem da venda (utm_source, utm_medium, utm_campaign, referrer_domain).
 * Só leitura. Filtros opcionais ?from=AAAA-MM-DD&to=AAAA-MM-DD. Pedidos arquivados (teste) ficam de fora.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { buildOrdersOriginCsv } from "@/lib/attribution-server";
import { andNotArchived } from "@/lib/b2b/archive";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const run = getAppSqlRunner();
    const csv = await buildOrdersOriginCsv(run, {
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to"),
      notArchivedSql: await andNotArchived(run, "orders", "o"),
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pedidos-origem-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/orders/export]", error);
    return NextResponse.json({ error: "Não foi possível exportar os pedidos." }, { status: 500 });
  }
}
