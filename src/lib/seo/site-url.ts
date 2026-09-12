/**
 * Fonte única da URL pública do site, usada por metadata (canonical, Open
 * Graph, JSON-LD), robots.ts e sitemap.ts.
 *
 * Reaproveita a mesma variável já usada pelo checkout/PixGo/Melhor Envio
 * (`NEXT_PUBLIC_SITE_URL`) para evitar uma segunda fonte de verdade sobre o
 * domínio do site. O fallback abaixo é apenas para ambientes locais/preview
 * sem a variável configurada — em produção, `NEXT_PUBLIC_SITE_URL` deve
 * estar definida com o domínio real e confirmado do site.
 */
const FALLBACK_SITE_URL = "https://www.bioflorais.com.br";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configured) {
    return FALLBACK_SITE_URL;
  }

  return configured.replace(/\/+$/, "");
}
