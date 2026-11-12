/**
 * Aviso de vencimento do boleto B2B: 3 dias antes e no dia, uma vez por parcela (src/lib/boleto-due-reminder.ts).
 * GET protegido por Authorization: Bearer ${CRON_SECRET}. Agendado em vercel.json uma vez por dia (11:00 UTC = 08:00 em São Paulo).
 * Sem RESEND_API_KEY/MAIL_FROM não faz nada (503) e não registra nada como enviado.
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { runBoletoDueReminders } from "@/lib/boleto-due-reminder";
import { mailConfigured, sendEmail } from "@/lib/mail";
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

  try {
    const summary = await runBoletoDueReminders(getAppSqlRunner(), { send: (mail) => sendEmail(mail), siteUrl: getSiteUrl() });

    console.log("[cron/boleto-due-reminders]", summary);

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/boleto-due-reminders] falha", error instanceof Error ? error.message : error);

    return NextResponse.json({ error: "Falha ao enviar os avisos." }, { status: 500 });
  }
}
