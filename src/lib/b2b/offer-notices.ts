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

/** Regra "compre X, leve Y" do produto: só nos elegíveis. */
export function productPromotionRule(
  notices: B2BOfferPromotionNotice[],
  groupId: string,
  productId: string
) {
  const match = notices.find(
    (item) =>
      item.commercialGroupId === groupId &&
      (item.productIds.length === 0 || item.productIds.includes(productId))
  );

  return match ? { buyQuantity: match.buyQuantity, freeQuantity: match.freeQuantity } : null;
}

/**
 * Quanto resta da promoção da linha (reabrir o link depois da 1ª compra):
 * "Você ainda tem 2 compras com 3 por 2" ou "3 por 2 válido até 30/10/2026".
 */
export function lineEligibilityCaption(notices: B2BOfferPromotionNotice[], groupId: string) {
  const own = notices.find((item) => item.commercialGroupId === groupId);

  if (!own) return null;

  const label = promotionShortLabel(own.buyQuantity, own.freeQuantity);

  if (own.usesRemaining !== null) {
    return `Você ainda tem ${own.usesRemaining} ${own.usesRemaining === 1 ? "compra" : "compras"} com ${label}`;
  }

  if (own.validUntil) {
    const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(own.validUntil);
    return `${label} válido até ${date}`;
  }

  return null;
}

/** Selo por produto: só nos elegíveis. */
export function productPromotionText(
  notices: B2BOfferPromotionNotice[],
  groupId: string,
  productId: string
) {
  const rule = productPromotionRule(notices, groupId, productId);
  return rule ? bonusLabel(rule.buyQuantity, rule.freeQuantity) : null;
}

/** Volume exibido no card B2B: o do catálogo (bio-products.ts). */
export function b2bProductContent(product: { content: string } | null | undefined) {
  return product?.content || null;
}
