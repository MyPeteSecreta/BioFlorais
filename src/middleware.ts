import { NextRequest, NextResponse } from "next/server";

import { resolveLegacyRedirect, withLegacyQuery } from "@/lib/seo/legacy-redirects";

/**
 * Redirects 301 das URLs do site antigo (URL-01). O mapa fica em src/lib/seo/legacy-redirects.data.ts (fácil de completar
 * com o Search Console) e a lógica em legacy-redirects.ts. TODO redirect preserva a query string inteira (utm_*, oppref).
 * URLs atuais (/, /linha/*, /produto/<válido>, /parceiros, /b2b/*, /acompanhe/*, /checkout, /api/*) nunca são tocadas.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const destination = resolveLegacyRedirect(pathname);

  if (!destination) {
    return NextResponse.next();
  }

  const target = new URL(withLegacyQuery(destination, search), request.url);

  // Nunca redireciona para si mesmo (sem loop).
  if (target.pathname === pathname && target.search === search) {
    return NextResponse.next();
  }

  return NextResponse.redirect(target, 301);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
