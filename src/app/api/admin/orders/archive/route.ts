/**
 * ADMIN — "Marcar como teste e arquivar" para QUALQUER pedido (Pedidos e detalhe do pedido).
 * Mesmo arquivamento da aba Dados de teste (lote + desfazer); pedido PAGO de verdade (pago e sem o
 * cupom de teste) só entra com a confirmação explícita (confirmedPaidOrderIds). Nada é apagado.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { resetArchiveCache } from "@/lib/b2b/archive";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { archiveSelected } from "@/lib/b2b/test-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { orderIds?: unknown; confirmedPaidOrderIds?: unknown };
  const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(String) : [];

  if (orderIds.length === 0 || orderIds.length > 300) {
    return NextResponse.json({ error: "Selecione de 1 a 300 pedidos." }, { status: 400 });
  }

  try {
    const result = await archiveSelected(getAppSqlRunner(), {
      orderIds,
      confirmedPaidOrderIds: Array.isArray(body.confirmedPaidOrderIds) ? body.confirmedPaidOrderIds.map(String) : [],
    });

    resetArchiveCache();

    return NextResponse.json({ ok: true, batchId: result.batchId, orders: result.orders, skippedPaid: result.skippedPaid });
  } catch (error) {
    console.error("[admin/orders/archive]", error);
    return NextResponse.json({ error: "Não foi possível arquivar (aplique o SQL 32b, dados de teste)." }, { status: 409 });
  }
}
