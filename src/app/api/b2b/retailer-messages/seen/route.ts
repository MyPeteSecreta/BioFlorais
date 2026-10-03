/**
 * BIO FLORAIS B2B — registra que o cliente JÁ viu o pop-up de boas-vindas
 * (1º acesso). O cliente vem do token da oferta; nada vem do navegador além
 * do token e do id da mensagem exibida.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { markPopupSeen } from "@/lib/b2b/retailer-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { b2bToken?: string; messageId?: string };
    const resolution = await loadPublicB2BOfferContext(body.b2bToken ?? "");

    if (!resolution.ok) {
      return NextResponse.json({ error: "Link de oferta inválido." }, { status: 403 });
    }

    await markPopupSeen(getAppSqlRunner(), resolution.context.clientId, body.messageId ?? null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[b2b/retailer-messages/seen]", error);
    return NextResponse.json({ error: "Erro ao registrar." }, { status: 500 });
  }
}
