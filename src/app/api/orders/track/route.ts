/**
 * Busca pública "Acompanhe seu pedido":
 *  - principal (mode "contact"): e-mail + CPF/CNPJ, os DOIS do mesmo cliente -> lista dos pedidos dos
 *    últimos 6 meses (cada um com link assinado);
 *  - secundária (mode "number"): número do pedido + (e-mail OU CPF/CNPJ).
 * Resposta GENÉRICA se não achar (não revela se o pedido existe) e limite de
 * 5 tentativas a cada 10 min por IP. Devolve um link assinado, nunca dados do pedido.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import {
  allowTrackingAttempt,
  findOrderForTracking,
  findOrdersByEmailAndDocument,
  hashIp,
  signTrackingToken,
} from "@/lib/order-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Não encontramos pedidos com esses dados. Confira o e-mail e o CPF/CNPJ informados na compra.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string;
      email?: string;
      document?: string;
      number?: string;
      contact?: string;
    };
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const run = getAppSqlRunner();

    if (!(await allowTrackingAttempt(run, hashIp(ip)))) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, { status: 429 });
    }

    // Principal: e-mail + CPF/CNPJ (mesmo cliente) -> lista dos últimos 6 meses. Mesma resposta genérica
    // para "não achou", "e-mail certo com documento errado" e "sem pedidos nos 6 meses".
    if (body.mode === "contact") {
      const found = await findOrdersByEmailAndDocument(run, String(body.email ?? ""), String(body.document ?? ""));
      const orders = found
        .map((order) => {
          const token = signTrackingToken(order.orderId);

          return token
            ? {
                number: order.number,
                createdAt: order.createdAt.toISOString(),
                totalCents: order.totalCents,
                situation: order.situation,
                url: `/acompanhe/${token}`,
              }
            : null;
        })
        .filter(Boolean);

      if (orders.length === 0) return NextResponse.json({ error: GENERIC }, { status: 404 });

      return NextResponse.json({ ok: true, orders });
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
