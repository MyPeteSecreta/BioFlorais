/**
 * Rede de segurança do Pix Mercado Pago (B2C e B2B).
 *
 * GET protegido por Authorization: Bearer ${CRON_SECRET} (a Vercel envia
 * esse header automaticamente nos crons quando CRON_SECRET existe).
 * Agendado em vercel.json a cada 10 minutos.
 *
 * Varre payments mercadopago/pix das últimas 48h cujo pedido ainda está
 * "pending", consulta a Order autenticada no Mercado Pago e, se estiver
 * paga, converge pelo MESMO finalizador do webhook e da rota de status
 * (finalizeMercadoPagoPaid). Nunca cria cobrança; idempotente.
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { createMercadoPagoCardAdapter } from "@angelblancdigital/payments";

import { db } from "@/lib/db/client";
import { orders, payments } from "@/lib/db/schema";
import { finalizeMercadoPagoPaid } from "@/lib/payments/finalize-mercadopago-paid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const MAX_PAYMENTS_PER_RUN = 100;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 503 });
  }

  const candidates = await db
    .select({
      paymentId: payments.id,
      paymentStatus: payments.status,
      externalId: payments.externalId,
      orderId: orders.id,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(
      and(
        eq(payments.provider, "mercadopago"),
        eq(payments.method, "pix"),
        eq(orders.status, "pending"),
        gte(payments.createdAt, new Date(Date.now() - LOOKBACK_MS))
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(MAX_PAYMENTS_PER_RUN);

  const adapter = createMercadoPagoCardAdapter({ accessToken });
  const paidOrderIds = new Set<string>();
  let checked = 0;
  let updated = 0;
  const errors: Array<{ orderId: string; externalId: string }> = [];

  for (const candidate of candidates) {
    if (!candidate.externalId || paidOrderIds.has(candidate.orderId)) {
      continue;
    }

    checked += 1;

    try {
      const remote = await adapter.getPaymentStatus({ externalId: candidate.externalId });

      if (remote.status !== candidate.paymentStatus) {
        await db
          .update(payments)
          .set({ status: remote.status })
          .where(eq(payments.id, candidate.paymentId));
        updated += 1;
      }

      if (remote.status === "paid") {
        await finalizeMercadoPagoPaid({
          orderId: candidate.orderId,
          providerPaymentId: candidate.externalId,
          paidAt: new Date().toISOString(),
        });
        paidOrderIds.add(candidate.orderId);
      }
    } catch (error) {
      console.error("[cron/reconcile-mp-pix] falha ao conciliar", {
        orderId: candidate.orderId,
        externalId: candidate.externalId,
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push({ orderId: candidate.orderId, externalId: candidate.externalId });
    }
  }

  const summary = {
    ok: true,
    candidates: candidates.length,
    checked,
    paymentStatusUpdated: updated,
    ordersPaid: Array.from(paidOrderIds),
    errors,
  };

  if (paidOrderIds.size > 0 || errors.length > 0) {
    console.log("[cron/reconcile-mp-pix]", summary);
  }

  return NextResponse.json(summary);
}
