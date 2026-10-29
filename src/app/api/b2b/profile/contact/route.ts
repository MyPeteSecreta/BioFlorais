/**
 * POST /api/b2b/profile/contact — o próprio vendedor troca o SEU WhatsApp em "Meu cadastro".
 * O vendedor vem SEMPRE da sessão (nunca de um id na requisição); o nome só o admin altera. Valida o número (DDD + 10/11 dígitos) e
 * registra quem e quando (auditoria, SQL 53b).
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { B2B_SESSION_COOKIE, readB2BResponsibleSession } from "@/lib/b2b/responsible-session";
import { changeContact, parseContactPatch } from "@/lib/b2b/vendor-contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const session = readB2BResponsibleSession(request.cookies.get(B2B_SESSION_COOKIE)?.value);

  if (!session) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401, headers: NO_STORE });

  const body = (await request.json().catch(() => null)) as { whatsapp?: unknown } | null;
  const parsed = parseContactPatch({ whatsapp: body?.whatsapp });

  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const run = getAppSqlRunner();
  const [seller] = await run(`SELECT name FROM b2b_responsibles WHERE id = $1::uuid AND status = 'active'`, [session.responsibleId]);

  if (!seller) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 403, headers: NO_STORE });

  const result = await changeContact(run, session.responsibleId, { whatsapp: parsed.value.whatsapp }, { kind: "vendedor", label: String(seller.name) });

  return result.ok
    ? NextResponse.json({ ok: true, phone: result.phone, changed: result.changed.length > 0 }, { headers: NO_STORE })
    : NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
}
