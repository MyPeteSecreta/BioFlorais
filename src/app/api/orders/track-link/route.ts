/**
 * Link assinado para a tela de pedido concluído ("Acompanhar meu pedido").
 * O id do pedido (UUID aleatório) já é o segredo que o checkout usa; o link
 * devolvido não leva dado pessoal.
 */

import { NextRequest, NextResponse } from "next/server";

import { isUuid } from "@/lib/b2b/admin-input";
import { signTrackingToken } from "@/lib/order-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderId = String(request.nextUrl.searchParams.get("orderId") ?? "");
  const token = isUuid(orderId) ? signTrackingToken(orderId) : null;

  if (!token) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  return NextResponse.json({ path: `/acompanhe/${token}` });
}
