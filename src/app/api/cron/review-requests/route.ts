/**
 * Pedido de avaliação 7 dias depois de entregue, uma vez por pedido (src/lib/review-request.ts). Desligado até configurar o link
 * no admin (/admin/recuperacao). GET protegido por Authorization: Bearer ${CRON_SECRET}. Agendado em vercel.json uma vez por dia
 * (13:00 UTC = 10:00 em São Paulo). Sem RESEND_API_KEY/MAIL_FROM não faz nada (503).
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { runReviewRequests } from "@/lib/review-request";
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
    const summary = await runReviewRequests(getAppSqlRunner(), { send: (mail) => sendEmail(mail), siteUrl: getSiteUrl() });

    console.log("[cron/review-requests]", summary);

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/review-requests] falha", error instanceof Error ? error.message : error);

    return NextResponse.json({ error: "Falha ao enviar os pedidos de avaliação." }, { status: 500 });
  }
}
