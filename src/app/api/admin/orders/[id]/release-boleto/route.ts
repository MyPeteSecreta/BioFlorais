/**
 * ADMIN — "Liberar para separação (boleto a prazo)": pedido B2B no boleto que ficou parado aguardando pagamento entra na fila de
 * separação, com registro de quem e quando (order_events, evento 'boleto_released'). Sem SQL; o financeiro não muda (as parcelas
 * seguem em "Boletos a receber"). Regra em src/lib/b2b/boleto-release.ts.
 */

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import { releaseBoletoForFulfillment } from "@/lib/b2b/boleto-release";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

  const { id } = await params;

  if (!isUuid(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const released = await releaseBoletoForFulfillment(getAppSqlRunner(), id, "admin", "Liberado no admin: boleto a prazo (separação antes do pagamento).");

  return released
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Este pedido não é um boleto B2B aguardando separação (ou já foi liberado)." }, { status: 409 });
}
