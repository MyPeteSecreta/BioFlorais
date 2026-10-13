/**
 * BIO FLORAIS B2B — cotação do mostruário do vendedor (preço de mostruário, limites e frete regional).
 * Só o vendedor logado; o servidor revalida itens, preço e cota (a tela é só apresentação).
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { computeShowcaseQuote } from "@/lib/b2b/showcase-quote";
import { loadShowcaseState } from "@/lib/b2b/showcase-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const responsible = await requireResponsible(request);

    if (!responsible) {
      return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { items?: unknown; cep?: unknown; state?: unknown };
    const run = getAppSqlRunner();
    const state = await loadShowcaseState(run, responsible.id);

    if (!state.config.available) {
      return NextResponse.json({ error: "O mostruário ainda não está disponível." }, { status: 503 });
    }

    const result = await computeShowcaseQuote(run, state, body);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, quote: result.quote });
  } catch (error) {
    console.error("[b2b/showcase/quote]", error);
    return NextResponse.json({ error: "Não foi possível calcular o mostruário agora." }, { status: 500 });
  }
}
