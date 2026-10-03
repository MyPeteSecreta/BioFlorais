/**
 * Busca pública "Acompanhe seu pedido": número + (e-mail OU CPF/CNPJ).
 * Resposta GENÉRICA se não achar (não revela se o pedido existe) e limite de
 * 5 tentativas a cada 10 min por IP. Devolve um link assinado, nunca dados do pedido.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { allowTrackingAttempt, findOrderForTracking, hashIp, signTrackingToken } from "@/lib/order-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Não encontramos um pedido com esses dados. Confira o número e o e-mail ou CPF/CNPJ informados na compra.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { number?: string; contact?: string };
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const run = getAppSqlRunner();

    if (!(await allowTrackingAttempt(run, hashIp(ip)))) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, { status: 429 });
    }

    const orderId = await findOrderForTracking(run, String(body.number ?? ""), String(body.contact ?? ""));
    const token = orderId ? signTrackingToken(orderId) : null;

    if (!token) return NextResponse.json({ error: GENERIC }, { status: 404 });

    return NextResponse.json({ ok: true, url: `/acompanhe/${token}` });
  } catch (error) {
    console.error("[orders/track]", error);
    return NextResponse.json({ error: GENERIC }, { status: 404 });
  }
}
