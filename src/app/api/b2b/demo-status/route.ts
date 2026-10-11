/**
 * Faixa de DEMONSTRAÇÃO nas telas do cliente (oferta, linha, carrinho, checkout): o navegador pergunta
 * "este link é de demonstração?" com o token da oferta. Só devolve true/false e a URL do botão.
 */

import { NextRequest, NextResponse } from "next/server";

import { demoCtaUrl } from "@/lib/b2b/demo";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { hashToken } from "@/lib/b2b/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get("token") ?? "").trim();

  if (!token || token.length > 200) return NextResponse.json({ demo: false });

  try {
    const [row] = await getAppSqlRunner()(
      `SELECT to_jsonb(r) ->> 'is_demo' AS is_demo
         FROM b2b_offer_links l
         JOIN b2b_offers o ON o.id = l.offer_id
         JOIN b2b_responsibles r ON r.id = o.responsible_id
        WHERE l.token_hash = $1 LIMIT 1`,
      [hashToken(token)]
    );

    return row?.is_demo === "true"
      ? NextResponse.json({ demo: true, ctaUrl: demoCtaUrl(process.env.B2B_DEMO_CTA_URL) })
      : NextResponse.json({ demo: false });
  } catch {
    return NextResponse.json({ demo: false });
  }
}
