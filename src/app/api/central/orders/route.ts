import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { listBrandOrders } from "@/lib/central/brand-api";
import { centralAuthError } from "@/lib/central/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Central → Bio: pedidos pagos a separar, separados sem rastreio ou enviados. */
export async function GET(request: NextRequest) {
  const denied = centralAuthError(request);

  if (denied) return denied;

  const stage = request.nextUrl.searchParams.get("stage");

  if (stage !== "separation" && stage !== "tracking" && stage !== "shipped") {
    return NextResponse.json({ ok: false, error: "stage inválido (separation, tracking ou shipped)." }, { status: 400 });
  }

  try {
    return NextResponse.json(await listBrandOrders(getAppSqlRunner(), stage));
  } catch (error) {
    console.error("[central/orders]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar os pedidos." }, { status: 500 });
  }
}
