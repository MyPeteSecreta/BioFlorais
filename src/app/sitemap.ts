import type { MetadataRoute } from "next";

import { bioLines, bioProducts } from "@/lib/catalog/bio-products";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * UM sitemap (sem generateSitemaps): Home + páginas institucionais + 11 Linhas + uma URL por produto.
 *
 * Antes eram dois sitemaps segmentados (id 0/1) e o filtro `id === 1` nunca casava (no Next.js 16 o `id` chega como
 * Promise<string>), então os produtos nunca apareciam e /sitemap.xml não respondia. Agora é uma função só, sem filtro
 * de id. As URLs usam getSiteUrl() (sempre www).
 *
 * Só entra o que a arquitetura aprovada marca como index. /atendimento e /ugc ficam de fora (index condicional).
 * Páginas noindex (legais, carrinho, checkout, admin, api, B2B) nunca entram.
 *
 * Produtos terminados em "-5l" ou "-500ml" (apresentações maiores de Cosméticos Pet) não são páginas públicas de
 * navegação (redirecionam para a apresentação base), então ficam de fora.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const institutionalRoutes = [
    { path: "/", priority: 1 },
    { path: "/terapia-floral", priority: 0.9 },
    { path: "/sobre", priority: 0.8 },
    { path: "/quiz", priority: 0.8 },
    { path: "/frete-e-entrega", priority: 0.5 },
    { path: "/trocas-e-devolucoes", priority: 0.5 },
  ];

  const lineRoutes = bioLines.map((line) => ({ path: `/linha/${line.slug}`, priority: 0.8 }));

  const productRoutes = bioProducts
    .filter((product) => !product.slug.endsWith("-5l") && !product.slug.endsWith("-500ml"))
    .map((product) => ({ path: `/produto/${product.slug}`, priority: 0.6 }));

  return [...institutionalRoutes, ...lineRoutes, ...productRoutes].map((route) => ({
    url: `${siteUrl}${route.path}`,
    priority: route.priority,
  }));
}
