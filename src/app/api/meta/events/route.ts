/**
 * API de Conversões da Meta (fase 2, mestre 16/11): recebe do navegador o ViewContent, o AddToCart e o InitiateCheckout que
 * o pixel ACABOU de disparar (mesmo event_id) e reenvia pelo servidor. Regras em src/lib/meta-capi-events.ts.
 * Responde sempre 204 na hora (o envio à Meta roda depois da resposta, com after()): nunca atrasa nem quebra a página ou o checkout.
 */
import { after, NextResponse } from "next/server";

import { captureMetaCapi, META_CAPI_TIMEOUT_MS, META_GRAPH_VERSION } from "@/lib/meta-capi";
import { buildMetaCapiBrowserEventBody, logMetaCapiNotConfigured, type MetaCapiBrowserRequest } from "@/lib/meta-capi-events";
import { metaPixelId } from "@/lib/measurement";
import { getSiteUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4000;

const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  try {
    const token = process.env.META_CAPI_TOKEN?.trim();
    const pixel = metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

    if (!token || !pixel) {
      logMetaCapiNotConfigured();
      return done();
    }

    const text = await request.text();
    if (!text || text.length > MAX_BODY_BYTES) return done();

    const input = JSON.parse(text) as MetaCapiBrowserRequest;
    // Cookies _fbp/_fbc, IP e navegador desta requisição (a mesma captura do Purchase; consent=true já conferido no corpo).
    const context = captureMetaCapi(request.headers, true)!;
    const built = buildMetaCapiBrowserEventBody(input, context, {
      siteUrl: getSiteUrl(),
      nowMs: Date.now(),
      testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || null,
    });

    if (!built.ok) return done();

    const eventName = String(input.event);

    after(async () => {
      try {
        const response = await fetch(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(built.body), signal: AbortSignal.timeout(META_CAPI_TIMEOUT_MS) }
        );

        // log sem dado pessoal: só o evento e o código HTTP
        if (!response.ok) console.error("[meta-capi] evento não aceito", { event: eventName, status: response.status });
      } catch {
        console.error("[meta-capi] evento não enviado", { event: eventName });
      }
    });

    return done();
  } catch {
    return done();
  }
}
