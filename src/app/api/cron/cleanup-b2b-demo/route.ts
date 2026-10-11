/**
 * Limpeza DIÁRIA do modo demonstração (vercel.json): apaga vendedores de demonstração EXPIRADOS (24 h) e
 * tudo ligado a eles. Nunca toca em vendedor real nem em demo ainda válido.
 * GET protegido por Authorization: Bearer ${CRON_SECRET} (a Vercel envia nos crons).
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { cleanupExpiredDemo } from "@/lib/b2b/demo";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) return false;

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    return NextResponse.json({ ok: true, ...(await cleanupExpiredDemo(getAppSqlRunner())) });
  } catch (error) {
    console.error("[cron/cleanup-b2b-demo]", error);
    return NextResponse.json({ ok: false, error: "Falha na limpeza (SQL 36b aplicado?)." }, { status: 500 });
  }
}
