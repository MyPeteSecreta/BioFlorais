/**
 * GET /api/orders/pixel-event?orderId=<uuid> — dados mínimos (sem dado pessoal) do evento "Compra" do pixel,
 * só se o pedido está PAGO. 204 = ainda não há evento (pendente, boleto, arquivado ou inexistente).
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPurchaseEvent } from "@/lib/pixel-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const orderId = String(request.nextUrl.searchParams.get("orderId") ?? "").trim();
    const event = await loadPurchaseEvent(getAppSqlRunner(), orderId);

    if (!event) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({ ok: true, event }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[orders/pixel-event]", error);
    return new NextResponse(null, { status: 204 });
  }
}
