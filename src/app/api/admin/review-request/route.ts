/** ADMIN — pedido de avaliação: liga/desliga e o link onde a avaliação cai (src/lib/review-request.ts). */

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { saveReviewSettings } from "@/lib/review-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown; url?: unknown };
  const settings = await saveReviewSettings(getAppSqlRunner(), { enabled: body.enabled === true, url: String(body.url ?? "") });

  if (body.enabled === true && !settings.enabled) {
    return NextResponse.json({ error: "Informe um link https válido para ligar o pedido de avaliação.", settings }, { status: 400 });
  }

  return NextResponse.json({ ok: true, settings });
}
