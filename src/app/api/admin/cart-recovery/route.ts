/** ADMIN — carrinho abandonado: liga/desliga (src/lib/cart-recovery.ts). */

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { saveCartRecoveryEnabled } from "@/lib/cart-recovery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  const enabled = await saveCartRecoveryEnabled(getAppSqlRunner(), body.enabled === true);

  return NextResponse.json({ ok: true, enabled });
}
