/**
 * BIO FLORAIS B2B — "Lançar pedido": dados do cliente da oferta para pré-preencher o checkout.
 * Só o vendedor DONO da oferta (sessão validada no servidor); o link público do cliente nunca recebe isto.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { B2B_SESSION_COOKIE } from "@/lib/b2b/responsible-session";
import { verifyLaunchAccess } from "@/lib/b2b/vendor-launch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { b2bToken?: string };
    const resolution = await loadPublicB2BOfferContext(body.b2bToken ?? "");

    if (!resolution.ok) {
      return NextResponse.json({ error: "Este link de oferta não é mais válido." }, { status: 403 });
    }

    const run = getAppSqlRunner();
    const access = await verifyLaunchAccess(run, request.cookies.get(B2B_SESSION_COOKIE)?.value, resolution.context.responsibleId);

    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const [client] = await run(
      `SELECT display_name, email, phone, to_jsonb(c) ->> 'document' AS document FROM b2b_clients c WHERE c.id = $1::uuid LIMIT 1`,
      [resolution.context.clientId]
    );

    const document = String(client?.document ?? "").replace(/\D/g, "");

    return NextResponse.json({
      ok: true,
      buyer: {
        name: String(client?.display_name ?? resolution.context.clientDisplayName ?? ""),
        email: String(client?.email ?? ""),
        phone: String(client?.phone ?? "").replace(/\D/g, ""),
        personType: document.length === 14 ? "pj" : "pf",
        document,
      },
    });
  } catch (error) {
    console.error("[b2b/launch/buyer]", error);
    return NextResponse.json({ error: "Não foi possível carregar os dados do cliente." }, { status: 500 });
  }
}
