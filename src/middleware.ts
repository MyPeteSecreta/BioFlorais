import { NextRequest, NextResponse } from "next/server";

import { isPixelPath } from "@/lib/ads-tag";
import { ATTRIBUTION_COOKIE, serverAttributionCookie } from "@/lib/attribution";
import { resolveLegacyRedirect, withLegacyQuery } from "@/lib/seo/legacy-redirects";

/**
 * Redirects 301 das URLs do site antigo (URL-01). O mapa fica em src/lib/seo/legacy-redirects.data.ts (fácil de completar
 * com o Search Console) e a lógica em legacy-redirects.ts. TODO redirect preserva a query string inteira (utm_*, oppref).
 * URLs atuais (/, /linha/*, /produto/<válido>, /parceiros, /b2b/*, /acompanhe/*, /checkout, /api/*) nunca são tocadas.
 *
 * Origem da venda (14/11): na chegada a uma página (documento), grava o bio_origem também pela resposta HTTP, com a MESMA regra de
 * primeiro toque do navegador (src/lib/attribution.ts). Não grava no /v/<codigo> (o link curto redireciona com a UTM, e é a página
 * de destino que grava) nem fora das páginas do B2C/lojista (isPixelPath).
 */
function withAttribution(request: NextRequest, response: NextResponse): NextResponse {
  const { pathname, search, hostname, protocol } = request.nextUrl;
  const isDocument = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");

  if (!isDocument || pathname === "/v" || pathname.startsWith("/v/") || !isPixelPath(pathname)) return response;

  const cookie = serverAttributionCookie({
    existingCookie: request.cookies.get(ATTRIBUTION_COOKIE)?.value,
    search,
    referer: request.headers.get("referer"),
    hostname,
    secure: protocol === "https:",
  });

  if (cookie) response.headers.append("Set-Cookie", cookie);

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const destination = resolveLegacyRedirect(pathname);

  if (!destination) {
    return withAttribution(request, NextResponse.next());
  }

  const target = new URL(withLegacyQuery(destination, search), request.url);

  // Nunca redireciona para si mesmo (sem loop).
  if (target.pathname === pathname && target.search === search) {
    return withAttribution(request, NextResponse.next());
  }

  return NextResponse.redirect(target, 301);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
