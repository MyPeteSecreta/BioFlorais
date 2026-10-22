/**
 * ADMIN B2B — um cliente: GET (cadastro + histórico de alterações) e PUT (editar nome/razão social, CNPJ/CPF validado,
 * e-mail, WhatsApp e endereço). Cada edição registra quem alterou e quando (SQL 47b). Nunca apaga o cadastro.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import { listClientEdits, loadClient, updateClient } from "@/lib/b2b/client-admin";
import { parseClientEdit } from "@/lib/b2b/client-edit";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAUTHORIZED = { error: "Sua sessão expirou. Entre de novo." };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;

  if (!isUuid(id)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  try {
    const run = getAppSqlRunner();
    const client = await loadClient(run, id);

    if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

    return NextResponse.json({ client, edits: await listClientEdits(run, id) });
  } catch (error) {
    console.error("[admin/b2b/clients/id GET]", error);

    return NextResponse.json({ error: "Não foi possível carregar o cliente." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;

  if (!isUuid(id)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseClientEdit(body);

  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });

  try {
    const run = getAppSqlRunner();
    const result = await updateClient(run, id, parsed.values, parsed.changedBy);

    if (!result.ok) return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });

    return NextResponse.json({
      ok: true,
      changed: result.changed,
      changes: result.changes,
      client: result.client,
      edits: await listClientEdits(run, id),
    });
  } catch (error) {
    console.error("[admin/b2b/clients/id PUT]", error);

    return NextResponse.json({ error: "Não foi possível salvar o cadastro." }, { status: 500 });
  }
}
