/**
 * Privacidade do pixel da Meta (pedido do GPT e da mestre, aprovado pelo Luis em 05/11). Só a Meta: Google Ads, Analytics,
 * checkout, Merchant, eventos internos, ChatGPT Ads, oppref e GPT10 NÃO usam nada daqui (isPixelPath continua igual).
 *
 *  - Produto sensível = a MESMA lista dos feeds (FEED_AD_EXCLUDED_SLUGS): peso, alimentação, lambedura/automutilação, pânico,
 *    parar de fumar e vícios. Uma lista só.
 *  - Página de produto sensível: nenhum evento da Meta (nem PageView, ViewContent ou AddToCart).
 *  - content_ids: código neutro e fixo (BF0001...; meta-content-ids.ts), o mesmo id do catálogo da Meta. Nunca o slug, nunca
 *    content_name nem content_category.
 *  - InitiateCheckout e Purchase: valor, moeda e quantidade total continuam; os itens sensíveis não são identificados.
 */

import { isPixelPath } from "@/lib/ads-tag";
import { FEED_AD_EXCLUDED_SLUGS } from "@/lib/feeds/products";
import { META_CONTENT_IDS } from "@/lib/feeds/meta-content-ids";

export function isMetaSensitiveProductSlug(slug: string | null | undefined): boolean {
  const value = String(slug ?? "");

  return FEED_AD_EXCLUDED_SLUGS.some((pattern) => pattern.test(value));
}

/** Código neutro do produto para a Meta; null = produto sem código (não é enviado). */
export function metaContentId(slug: string | null | undefined): string | null {
  return META_CONTENT_IDS[String(slug ?? "")] ?? null;
}

/** Slug da página de produto (/produto/<slug>), ou null. */
export function productSlugFromPath(pathname: string | null | undefined): string | null {
  const path = String(pathname ?? "/").split("?")[0].split("#")[0];
  const match = /^\/produto\/([^/]+)\/?$/.exec(path);

  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Páginas onde a Meta pode receber eventos: as do pixel (isPixelPath), menos a página de um produto sensível. */
export function isMetaPixelPath(pathname: string | null | undefined): boolean {
  if (!isPixelPath(pathname)) return false;

  return !isMetaSensitiveProductSlug(productSlugFromPath(pathname));
}

/** Itens que podem ser identificados para a Meta: não sensíveis e com código. Devolve os códigos (sem repetir). */
export function metaAllowedProductSlugs(slugs: Array<string | null | undefined>): string[] {
  return slugs.filter((slug): slug is string => Boolean(slug) && !isMetaSensitiveProductSlug(slug) && metaContentId(slug) !== null);
}
