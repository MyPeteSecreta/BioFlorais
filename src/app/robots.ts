import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * Regras de rastreamento (Metadata SEO V2.1, Seção 2/9):
 * - /admin e /api: bloqueados (área administrativa e endpoints técnicos,
 *   sem valor de busca).
 * - /carrinho e /checkout: bloqueados (páginas transacionais/estado de
 *   sessão, nunca devem ser rastreadas ou indexadas).
 *
 * Páginas legais (/cookies, /privacidade, /termos-de-compra) e o resultado
 * do quiz permanecem "noindex" via meta tag na própria página (não via
 * robots.txt) — ver auditoria para o estado real disso, que ainda depende
 * de metadata por rota nesses arquivos.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/carrinho", "/checkout"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
