/**
 * BIO FLORAIS B2B — registra que o cliente abriu uma linha FORA da
 * oferta. Chamado pela página /b2b/oferta/[token]/linha/[slug] depois de
 * montada (POST, para prefetch de link não contar como visita).
 */

import { NextRequest, NextResponse } from "next/server";

import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { findOtherB2BLine, recordOfferLineView } from "@/lib/b2b/line-views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      b2bToken?: string;
      lineSlug?: string;
    };

    const resolution = await loadPublicB2BOfferContext(body.b2bToken ?? "");

    if (!resolution.ok) {
      return NextResponse.json({ error: "Link de oferta inválido." }, { status: 403 });
    }

    const line = await findOtherB2BLine(resolution.context, String(body.lineSlug ?? ""));

    if (!line) {
      // Linha inexistente, inativa ou que já faz parte da oferta: nada a registrar.
      return NextResponse.json({ ok: true, recorded: false });
    }

    const result = await recordOfferLineView(resolution.context, line.id);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[b2b/line-views]", error);
    return NextResponse.json({ error: "Erro ao registrar visualização." }, { status: 500 });
  }
}
