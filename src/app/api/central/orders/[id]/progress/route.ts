import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { applyBrandProgress } from "@/lib/central/brand-api";
import { centralAuthError } from "@/lib/central/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Central → Bio: muda o andamento do pedido (grava o histórico que o cliente vê no "Acompanhe seu pedido"). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = centralAuthError(request);

  if (denied) return denied;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { status, ...result } = await applyBrandProgress(getAppSqlRunner(), id, body);

    return NextResponse.json(result, { status: result.ok ? 200 : (status ?? 400) });
  } catch (error) {
    console.error("[central/orders/progress]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível registrar o andamento." }, { status: 500 });
  }
}
