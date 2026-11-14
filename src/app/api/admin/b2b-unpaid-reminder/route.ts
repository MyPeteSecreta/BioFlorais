/** ADMIN — lembrete de pedido B2B não pago (item 41): liga/desliga (src/lib/b2b/unpaid-reminder.ts). */

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { saveB2BReminderEnabled } from "@/lib/b2b/unpaid-reminder";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  const enabled = await saveB2BReminderEnabled(getAppSqlRunner(), body.enabled === true);

  return NextResponse.json({ ok: true, enabled });
}
