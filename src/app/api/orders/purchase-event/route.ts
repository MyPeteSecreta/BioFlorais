/**
 * POST /api/orders/purchase-event { orderId } — dados do evento de compra (Google/Meta) do pedido PAGO.
 * 204 = nada a medir (não pago, boleto, arquivado ou id inválido). Sem dado pessoal na resposta.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPurchasePayload } from "@/lib/purchase-event-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { orderId?: unknown };
    const payload = await loadPurchasePayload(getAppSqlRunner(), String(body.orderId ?? "").trim());

    if (!payload) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({ ok: true, order: payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[orders/purchase-event]", error);
    return new NextResponse(null, { status: 204 });
  }
}
