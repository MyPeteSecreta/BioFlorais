/** ADMIN — oferta de recuperação de pedido não pago: liga/desliga e o % (src/lib/recovery-offer.ts). */

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { saveRecoverySettings } from "@/lib/recovery-offer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown; percent?: unknown };
  const settings = await saveRecoverySettings(getAppSqlRunner(), { enabled: body.enabled === true, percent: Number(body.percent) });

  return NextResponse.json({ ok: true, settings });
}
