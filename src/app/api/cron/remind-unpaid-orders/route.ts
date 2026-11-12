/**
 * Lembrete de pedido B2C não pago: 1 e-mail transacional ("Seu pedido está separado") para pedido em pending/checkout_pending há mais de
 * 2 h e menos de 48 h, com e-mail e sem lembrete. Depois de 2 dias sem pagar: UMA oferta com cupom (src/lib/recovery-offer.ts; liga/desliga e % em /admin/recuperacao). Nunca para pedido pago, cancelado, B2B ou orçamento (ver src/lib/payment-reminder.ts).
 *
 * GET protegido por Authorization: Bearer ${CRON_SECRET} (a Vercel envia o header nos crons quando CRON_SECRET existe).
 * Agendado em vercel.json a cada 15 minutos. Sem RESEND_API_KEY/MAIL_FROM não faz nada (503, nada é marcado como enviado).
 * Sem a coluna payment_reminder_sent_at (SQL 55b) também não faz nada (503): nunca envia sem poder registrar o envio.
 */

import { runRecoveryOffers } from "@/lib/recovery-offer";
import { runCartRecovery } from "@/lib/cart-recovery";
import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { mailConfigured, sendEmail } from "@/lib/mail";
import { runPaymentReminders } from "@/lib/payment-reminder";
import { getSiteUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) return false;

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  if (!mailConfigured()) return NextResponse.json({ error: "E-mail não configurado (RESEND_API_KEY e MAIL_FROM)." }, { status: 503 });

  const run = getAppSqlRunner();

  try {
    const [column] = await run(`SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_reminder_sent_at'`);

    if (!column) return NextResponse.json({ error: "Aplique o SQL 55b (coluna payment_reminder_sent_at) antes." }, { status: 503 });

    const summary = await runPaymentReminders(run, { send: (mail) => sendEmail(mail), siteUrl: getSiteUrl() });
    // Oferta de 2 dias: falha aqui nunca derruba os lembretes.
    const recovery = await runRecoveryOffers(run, { send: (mail) => sendEmail(mail), siteUrl: getSiteUrl() }).catch((error) => {
      console.error("[cron/remind-unpaid-orders] oferta", error instanceof Error ? error.message : error);
      return null;
    });

    // Carrinho abandonado (só com aceite; SQL 56b): falha aqui nunca derruba os lembretes.
    const carts = await runCartRecovery(run, { send: (mail) => sendEmail(mail), siteUrl: getSiteUrl() }).catch((error) => {
      console.error("[cron/remind-unpaid-orders] sacola", error instanceof Error ? error.message : error);
      return null;
    });

    console.log("[cron/remind-unpaid-orders]", summary, recovery, carts);

    return NextResponse.json({ ok: true, ...summary, recovery, carts });
  } catch (error) {
    console.error("[cron/remind-unpaid-orders] falha", error instanceof Error ? error.message : error);

    return NextResponse.json({ error: "Falha ao enviar os lembretes." }, { status: 500 });
  }
}
