/**
 * ADMIN B2B — "Dados de teste" (V5): lista os candidatos, arquiva os selecionados (sem apagar)
 * e desfaz um lote. Pedido pago de verdade só entra com confirmação linha a linha.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { resetArchiveCache } from "@/lib/b2b/archive";
import { archiveSelected, listBatches, listTestCandidates, restoreBatch, type ArchiveInput } from "@/lib/b2b/test-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRED = { error: "Sua sessão expirou. Entre de novo." };
const NEEDS_SQL = "Aplique o SQL 32b (dados de teste) antes de arquivar.";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json(EXPIRED, { status: 401 });

  try {
    const run = getAppSqlRunner();
    const candidates = await listTestCandidates(run);
    let batches: Awaited<ReturnType<typeof listBatches>> = [];
    let ready = true;

    try {
      batches = await listBatches(run);
    } catch {
      ready = false;
    }

    return NextResponse.json({ ready, candidates, batches });
  } catch (error) {
    console.error("[admin/b2b/test-data GET]", error);
    return NextResponse.json({ error: "Erro ao listar os dados de teste." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json(EXPIRED, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as ArchiveInput & { action?: string; batchId?: string };
    const run = getAppSqlRunner();

    try {
      if (body.action === "restore") {
        const result = await restoreBatch(run, String(body.batchId ?? ""));

        resetArchiveCache();

        return NextResponse.json({ ok: true, ...result });
      }

      if (body.action === "archive") {
        const result = await archiveSelected(run, body);

        resetArchiveCache();

        return NextResponse.json({ ok: true, ...result });
      }
    } catch (error) {
      console.error("[admin/b2b/test-data POST]", error);
      return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/b2b/test-data POST]", error);
    return NextResponse.json({ error: "Erro ao arquivar." }, { status: 500 });
  }
}
