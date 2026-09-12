import type { MetadataRoute } from "next";

import { bioLines, bioProducts } from "@/lib/catalog/bio-products";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * Dois sitemaps separados (Metadata SEO V2.1, Seção 9):
 * id 0 = institucional (Home + 11 Linhas + páginas de conteúdo/política já
 * confirmadas como "index" na arquitetura aprovada);
 * id 1 = produtos (uma URL por slug do catálogo).
 *
 * Only listing here what the approved architecture marks as index.
 * /atendimento e /ugc ficam de fora por ora — a arquitetura os marca como
 * "index condicional", pendente de confirmação do estado real de conteúdo
 * (ver auditoria). Páginas noindex (legais, carrinho, checkout, admin, api)
 * nunca devem entrar em sitemap nenhum.
 */
export function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }];
}

export default function sitemap({
  id,
}: {
  id: number;
}): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  if (id === 1) {
    return bioProducts.map((product) => ({
      url: `${siteUrl}/produto/${product.slug}`,
      priority: 0.6,
    }));
  }

  const institutionalRoutes = [
    { path: "/", priority: 1 },
    { path: "/terapia-floral", priority: 0.9 },
    { path: "/sobre", priority: 0.8 },
    { path: "/quiz", priority: 0.8 },
    { path: "/frete-e-entrega", priority: 0.5 },
    { path: "/trocas-e-devolucoes", priority: 0.5 },
  ];

  const lineRoutes = bioLines.map((line) => ({
    path: `/linha/${line.slug}`,
    priority: 0.8,
  }));

  return [...institutionalRoutes, ...lineRoutes].map((route) => ({
    url: `${siteUrl}${route.path}`,
    priority: route.priority,
  }));
}
