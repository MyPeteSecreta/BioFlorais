/**
 * BIO FLORAIS B2B — L2 "Gerar link com minha oferta padrão": modelo + cliente (novo, só o nome, ou
 * existente) -> oferta ATIVA com link. `preview: true` só confere e devolve os avisos (promoção
 * indisponível para ESSE cliente sai da oferta e vira aviso antes de gerar). Só modelo e cliente do
 * próprio vendedor.
 */

import { NextRequest, NextResponse } from "next/server";

import { findOwnedClient, getAppSqlRunner } from "@/lib/b2b/ownership";
import { getTemplate } from "@/lib/b2b/offer-templates";
import { createActiveOffer, createClientForResponsible, evaluateTemplate } from "@/lib/b2b/quick-offer";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      templateId?: string;
      clientId?: string;
      clientName?: string;
      preview?: boolean;
    };
    const run = getAppSqlRunner();
    const template = await getTemplate(run, responsible.id, String(body.templateId ?? ""));

    if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });

    let existing: { id: string; displayName: string; phone: string | null } | null = null;

    if (body.clientId) {
      const owned = await findOwnedClient(run, responsible.id, String(body.clientId));

      if (!owned) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

      existing = { id: owned.id, displayName: owned.displayName, phone: owned.phone };
    }

    const name = String(body.clientName ?? "").trim().slice(0, 120);

    if (!existing && name.length < 2) return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });

    // Cliente novo ainda não existe: sem histórico, tudo disponível.
    const evaluation = await evaluateTemplate(run, responsible.id, existing?.id ?? null, template);

    if (evaluation.commercialGroupIds.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha deste modelo está publicada no B2B agora.", evaluation }, { status: 409 });
    }

    if (body.preview) return NextResponse.json({ ok: true, preview: true, evaluation });

    const client = existing ?? { id: await createClientForResponsible(responsible.id, name), displayName: name, phone: null };

    const result = await createActiveOffer(run, {
      responsible: { id: responsible.id, name: responsible.name },
      client,
      commercialGroupIds: evaluation.commercialGroupIds,
      promotions: evaluation.promotions,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      ok: true,
      offerId: result.offerId,
      clientId: result.clientId,
      clientName: result.clientName,
      url: result.url,
      whatsappUrl: result.whatsappUrl,
      evaluation,
    });
  } catch (error) {
    console.error("[b2b/offers/from-template]", error);
    return NextResponse.json({ error: "Não foi possível gerar o link com este modelo." }, { status: 500 });
  }
}
