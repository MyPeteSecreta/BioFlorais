/**
 * ADMIN B2B — parâmetros: reconquista_meses (padrão 6). Define quantos
 * meses sem comprar uma linha reabrem a promoção de abertura/reconquista
 * para o cliente (e um novo ciclo de 180 dias naquela linha).
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bSettings } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadReconquistaMonths } from "@/lib/b2b/purchase-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json({ reconquistaMeses: await loadReconquistaMonths(getAppSqlRunner()) });
}

export async function PUT(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { reconquistaMeses?: unknown };
    const months = Number(body.reconquistaMeses);

    if (!Number.isInteger(months) || months < 1 || months > 60) {
      return NextResponse.json({ error: "Informe um número inteiro de meses (1 a 60)." }, { status: 400 });
    }

    await db
      .insert(b2bSettings)
      .values({ key: "reconquista_meses", value: String(months) })
      .onConflictDoUpdate({
        target: b2bSettings.key,
        set: { value: String(months), updatedAt: sql`now()` },
      });

    return NextResponse.json({ ok: true, reconquistaMeses: months });
  } catch (error) {
    console.error("[admin/b2b/settings PUT]", error);
    return NextResponse.json({ error: "Erro ao salvar o parâmetro (o SQL 14b foi aplicado?)." }, { status: 500 });
  }
}
