/**
 * ADMIN — baixa manual de Pix recebido fora do site (16/11). Regras e registro em src/lib/admin/manual-pix.ts.
 */

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { recordManualPix } from "@/lib/admin/manual-pix";
import { isUuid } from "@/lib/b2b/admin-input";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { finalizeMercadoPagoPaid } from "@/lib/payments/finalize-mercadopago-paid";

export const runtime = "nodejs";

/** Hoje em São Paulo (AAAA-MM-DD). */
const todaySaoPaulo = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { by?: unknown; amountCents?: unknown; receivedOn?: unknown; reference?: unknown };

  try {
    const result = await recordManualPix(getAppSqlRunner(), id, { by: body.by, amountCents: body.amountCents, receivedOn: body.receivedOn, reference: body.reference }, { today: todaySaoPaulo(), finalize: finalizeMercadoPagoPaid });

    return result.ok ? NextResponse.json({ ok: true, resumed: result.resumed }) : NextResponse.json({ error: result.error }, { status: result.status });
  } catch {
    console.error("[admin/manual-pix] falha ao dar baixa", { orderId: id });
    return NextResponse.json({ error: "Não foi possível dar a baixa agora. Tente de novo; se repetir, avise o suporte." }, { status: 500 });
  }
}
