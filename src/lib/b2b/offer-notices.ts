/**
 * BIO FLORAIS B2B — textos de promoção da página do link do cliente
 * (puro, sem banco). Só AVISO: o desconto de verdade vem do servidor.
 */

import { promotionShortLabel } from "@/lib/b2b/commission";
import type { B2BOfferPromotionNotice } from "@/lib/b2b/promotion-resolver";

export function bonusLabel(buy: number, free: number) {
  return `Compre ${buy} e leve +${free} grátis`;
}

/** Selo do card da linha: "3 por 2", ou "Promoção somente em Sono" (pontual). */
export function lineBadge(
  notices: B2BOfferPromotionNotice[],
  groupId: string,
  productNameById: Map<string, string>
) {
  const own = notices.filter((item) => item.commercialGroupId === groupId);

  if (own.length === 0) return null;

  const wide = own.find((item) => item.productIds.length === 0);

  if (wide) return promotionShortLabel(wide.buyQuantity, wide.freeQuantity);

  const names = Array.from(
    new Set(own.flatMap((item) => item.productIds.map((id) => productNameById.get(id)).filter(Boolean)))
  ) as string[];

  const label = promotionShortLabel(own[0].buyQuantity, own[0].freeQuantity);

  return names.length > 0 ? `${label} · promoção somente em ${names.join(", ")}` : label;
}

/** Selo por produto: só nos elegíveis. */
export function productPromotionText(
  notices: B2BOfferPromotionNotice[],
  groupId: string,
  productId: string
) {
  const match = notices.find(
    (item) =>
      item.commercialGroupId === groupId &&
      (item.productIds.length === 0 || item.productIds.includes(productId))
  );

  return match ? bonusLabel(match.buyQuantity, match.freeQuantity) : null;
}

/** Volume exibido no card B2B: o do catálogo (bio-products.ts). */
export function b2bProductContent(product: { content: string } | null | undefined) {
  return product?.content || null;
}
