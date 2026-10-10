/**
 * BIO FLORAIS B2B — L2: modelos de oferta do vendedor (listar / salvar / excluir).
 * Isolamento: cada vendedor só enxerga e altera os próprios modelos.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { archiveTemplate, listTemplates, saveTemplate } from "@/lib/b2b/offer-templates";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRED = { error: "Sua sessão expirou. Entre de novo." };
const NEEDS_SQL = "Não foi possível acessar os modelos (o SQL 34b foi aplicado?).";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) return NextResponse.json(EXPIRED, { status: 401 });

  try {
    return NextResponse.json({ templates: await listTemplates(getAppSqlRunner(), responsible.id) });
  } catch (error) {
    console.error("[b2b/offer-templates GET]", error);
    return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
  }
}

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) return NextResponse.json(EXPIRED, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string | null;
      name?: string;
      commercialGroupIds?: unknown;
      promotions?: unknown;
    };
    const result = await saveTemplate(getAppSqlRunner(), responsible.id, body);

    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (error) {
    console.error("[b2b/offer-templates POST]", error);
    return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) return NextResponse.json(EXPIRED, { status: 401 });

  try {
    const id = request.nextUrl.searchParams.get("id") ?? "";
    const done = await archiveTemplate(getAppSqlRunner(), responsible.id, id);

    return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
  } catch (error) {
    console.error("[b2b/offer-templates DELETE]", error);
    return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
  }
}
