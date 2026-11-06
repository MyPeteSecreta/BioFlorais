import { NextRequest, NextResponse } from "next/server";

import { resolveLinkCurto } from "@/lib/links-curtos";

/**
 * Link curto /v/<codigo> (tabela em src/lib/links-curtos.ts): 302 para o destino com a UTM, sempre no próprio site.
 * Sem cache, para uma linha nova na tabela valer no próximo deploy sem esperar CDN.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const caminho = resolveLinkCurto(codigo, request.nextUrl.search);
  const origem = request.nextUrl.origin;
  const destino = new URL(caminho, origem);

  // Defesa extra: nunca sai do próprio domínio.
  const alvo = destino.origin === origem ? destino : new URL("/?utm_campaign=link_desconhecido", origem);
  const response = NextResponse.redirect(alvo, 302);

  response.headers.set("Cache-Control", "no-store");

  return response;
}
