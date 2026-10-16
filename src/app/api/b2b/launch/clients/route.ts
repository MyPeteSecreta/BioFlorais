/**
 * BIO FLORAIS B2B — "Lançar pedido": cadastra o cliente do vendedor com CPF/CNPJ validado.
 * Regra de dono: documento que já é cliente de OUTRO representante é recusado
 * ("Cliente atendido por outro representante."); se já é cliente DESTE vendedor, reaproveita.
 * Demonstração não cria cliente real.
 */

import { NextRequest, NextResponse } from "next/server";

import { DEMO_PURCHASE_DISABLED_MESSAGE, loadDemoState } from "@/lib/b2b/demo";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { findDocumentOwner } from "@/lib/b2b/storefront";
import { parseLaunchClient, registerLaunchClient } from "@/lib/b2b/vendor-launch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const run = getAppSqlRunner();
    const demo = await loadDemoState(run, responsible.id);

    if (demo.isDemo) {
      return NextResponse.json({ error: DEMO_PURCHASE_DISABLED_MESSAGE }, { status: 403 });
    }

    const parsed = parseLaunchClient((await request.json().catch(() => ({}))) as Record<string, unknown>);

    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await registerLaunchClient(run, responsible.id, parsed.value, findDocumentOwner);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, clientId: result.clientId, displayName: result.displayName, reused: result.reused });
  } catch (error) {
    console.error("[b2b/launch/clients]", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o cliente agora." }, { status: 500 });
  }
}
