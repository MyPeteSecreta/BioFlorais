/**
 * BIO FLORAIS B2B — link de uma oferta JÁ ATIVA (revisada):
 *   POST   gera um novo link (revoga o anterior)
 *   DELETE revoga o link ativo
 * Rascunho não gera link aqui: passa pela revisão (…/activate).
 * Isolamento: só ofertas do vendedor logado (ownership.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bOfferLinks } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { findOwnedClient, findOwnedOffer, getAppSqlRunner } from "@/lib/b2b/ownership";
import { issueOfferLink, readActiveOfferLink } from "@/lib/b2b/offer-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readOfferId(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { offerId?: string };
  return String(body.offerId ?? "").trim();
}

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const run = getAppSqlRunner();
    const offer = await findOwnedOffer(run, responsible.id, await readOfferId(request));

    if (!offer || offer.revokedAt) {
      return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
    }

    if (!offer.activatedAt || offer.status !== "active") {
      return NextResponse.json(
        { error: "Revise a oferta antes de gerar o link." },
        { status: 409 }
      );
    }

    const client = await findOwnedClient(run, responsible.id, offer.clientId);

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const link = await issueOfferLink({
      offerId: offer.id,
      clientName: client.displayName,
      clientPhone: client.phone,
      responsibleName: responsible.name,
    });

    return NextResponse.json({ ok: true, ...link });
  } catch (error) {
    console.error("[b2b/offers/link POST]", error);
    return NextResponse.json({ error: "Erro ao gerar link." }, { status: 500 });
  }
}

/** Copiar/reenviar: devolve o link ATIVO da oferta (só do próprio vendedor). */
export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  const run = getAppSqlRunner();
  const offer = await findOwnedOffer(run, responsible.id, String(request.nextUrl.searchParams.get("offerId") ?? "").trim());

  if (!offer || offer.revokedAt || !offer.activatedAt) {
    return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
  }

  const client = await findOwnedClient(run, responsible.id, offer.clientId);

  if (!client) {
    return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
  }

  const link = await readActiveOfferLink(offer.id, {
    clientName: client.displayName,
    clientPhone: client.phone,
    responsibleName: responsible.name,
  });

  if (!link) {
    return NextResponse.json(
      { error: "Este link foi criado antes da cópia guardada. Use \"Gerar novo link\" (o anterior deixa de funcionar)." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, ...link });
}

export async function DELETE(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const offer = await findOwnedOffer(getAppSqlRunner(), responsible.id, await readOfferId(request));

    if (!offer) {
      return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
    }

    await db
      .update(b2bOfferLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(b2bOfferLinks.offerId, offer.id), isNull(b2bOfferLinks.revokedAt)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[b2b/offers/link DELETE]", error);
    return NextResponse.json({ error: "Erro ao revogar link." }, { status: 500 });
  }
}
