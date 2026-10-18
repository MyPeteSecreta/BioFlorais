/**
 * POST /api/orders/ads-tag { orderId } — oferece a URL da Image Tag (ChatGPT Ads) do pedido PAGO.
 * POST /api/orders/ads-tag { orderId, sent: true } — o navegador confirma o onLoad da imagem: só então marca "tag enviada"
 * (imagem bloqueada = não marca, o evento não se perde).
 * Só com consentimento de marketing (o navegador só chama depois do aceite). 204 = nada a renderizar.
 * Sem dado pessoal na URL: event_id é um UUID aleatório (nunca o número do pedido).
 */

import { NextRequest, NextResponse } from "next/server";

import { OPPREF_COOKIE, readOppRefCookie } from "@/lib/ads-tag";
import { claimAdsTag, confirmAdsTagSent } from "@/lib/ads-tag-server";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { orderId?: unknown; sent?: unknown };

    if (body.sent === true) {
      await confirmAdsTagSent(getAppSqlRunner(), String(body.orderId ?? "").trim());
      return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    const cookieOppref = readOppRefCookie(request.cookies.get(OPPREF_COOKIE)?.value, false);
    const src = await claimAdsTag(getAppSqlRunner(), String(body.orderId ?? "").trim(), cookieOppref);

    if (!src) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({ ok: true, src }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[orders/ads-tag]", error);
    return new NextResponse(null, { status: 204 });
  }
}
