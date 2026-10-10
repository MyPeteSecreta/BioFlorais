/**
 * BIO FLORAIS B2B — L1 "Link padrão": oferta ATIVA com TODAS as linhas B2B publicadas, sem promoção
 * (preço B2B normal), para um cliente existente do vendedor ou um novo (só o nome).
 * Comissão: a regra normal (base + extra de preço normal / janela de 180 dias).
 * Isolamento: só clientes do vendedor logado.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireResponsible } from "@/lib/b2b/require-responsible";
import { findOwnedClient, getAppSqlRunner } from "@/lib/b2b/ownership";
import { createActiveOffer, createClientForResponsible, evaluateStandardOffer } from "@/lib/b2b/quick-offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { clientId?: string; clientName?: string };
    const run = getAppSqlRunner();
    let client: { id: string; displayName: string; phone: string | null } | null = null;

    if (body.clientId) {
      const owned = await findOwnedClient(run, responsible.id, String(body.clientId));

      if (!owned) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

      client = { id: owned.id, displayName: owned.displayName, phone: owned.phone };
    } else {
      const name = String(body.clientName ?? "").trim().slice(0, 120);

      if (name.length < 2) return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });

      const evaluation = await evaluateStandardOffer(null);

      if (evaluation.commercialGroupIds.length === 0) {
        return NextResponse.json({ error: "Nenhuma linha B2B publicada no momento." }, { status: 409 });
      }

      client = { id: await createClientForResponsible(responsible.id, name), displayName: name, phone: null };
    }

    const standard = await evaluateStandardOffer(client.id);

    if (standard.commercialGroupIds.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha B2B publicada no momento." }, { status: 409 });
    }

    const result = await createActiveOffer(run, {
      responsible: { id: responsible.id, name: responsible.name },
      client,
      commercialGroupIds: standard.commercialGroupIds,
      promotions: [],
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      ok: true,
      offerId: result.offerId,
      clientId: result.clientId,
      clientName: result.clientName,
      url: result.url,
      whatsappUrl: result.whatsappUrl,
      lines: standard.lines.map((line) => line.name),
    });
  } catch (error) {
    console.error("[b2b/offers/quick]", error);
    return NextResponse.json({ error: "Não foi possível gerar o link padrão." }, { status: 500 });
  }
}
