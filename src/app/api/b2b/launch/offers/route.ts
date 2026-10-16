/**
 * BIO FLORAIS B2B — "Lançar pedido": ofertas ATIVAS (com link) de um cliente do vendedor logado,
 * para escolher com qual oferta/promoções lançar. Isolamento: só clientes do vendedor (ownership.ts).
 */

import { NextRequest, NextResponse } from "next/server";

import { findOwnedClient, getAppSqlRunner, listOwnedOffersForClient } from "@/lib/b2b/ownership";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  const run = getAppSqlRunner();
  const client = await findOwnedClient(run, responsible.id, String(request.nextUrl.searchParams.get("clientId") ?? "").trim());

  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const offers = (await listOwnedOffersForClient(run, responsible.id, client.id))
    .filter((offer) => offer.activatedAt && !offer.revokedAt && offer.hasActiveLink)
    .map((offer) => ({
      id: offer.id,
      lines: offer.lines,
      promotions: offer.promotions,
      createdAt: offer.createdAt.toISOString(),
    }));

  return NextResponse.json({ ok: true, client: { id: client.id, displayName: client.displayName }, offers });
}
