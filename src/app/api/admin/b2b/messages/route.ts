/**
 * ADMIN B2B — "Mensagens ao lojista" (C11): listar, criar e editar (título,
 * texto, ativa, ordem). Não há exclusão: desative a mensagem.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { listAdminMessages, loadRotation, parseMessageInput } from "@/lib/b2b/retailer-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const run = getAppSqlRunner();
    return NextResponse.json({ messages: await listAdminMessages(run), rotation: await loadRotation(run) });
  } catch (error) {
    console.error("[admin/b2b/messages GET]", error);
    return NextResponse.json({ error: "Erro ao carregar (o SQL 22b foi aplicado?)." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseMessageInput(body);

    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const run = getAppSqlRunner();
    const id = typeof body.id === "string" && isUuid(body.id) ? body.id : null;

    if (id) {
      const rows = await run(
        `UPDATE b2b_retailer_messages SET title = $2, body = $3, active = $4, sort_order = $5, short_call = $6, updated_at = now()
          WHERE id = $1 RETURNING id`,
        [id, parsed.value.title, parsed.value.body, parsed.value.active, parsed.value.sortOrder, parsed.value.shortCall || null]
      );

      if (rows.length === 0) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
      return NextResponse.json({ ok: true, id });
    }

    const [created] = await run(
      `INSERT INTO b2b_retailer_messages (title, body, active, sort_order, short_call) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [parsed.value.title, parsed.value.body, parsed.value.active, parsed.value.sortOrder, parsed.value.shortCall || null]
    );

    return NextResponse.json({ ok: true, id: String(created.id) });
  } catch (error) {
    console.error("[admin/b2b/messages POST]", error);
    return NextResponse.json({ error: "Erro ao salvar a mensagem (o SQL 25b foi aplicado?)." }, { status: 500 });
  }
}
