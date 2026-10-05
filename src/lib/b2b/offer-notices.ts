/**
 * BIO FLORAIS B2B — textos de promoção da página do link do cliente
 * (puro, sem banco). Só AVISO: o desconto de verdade vem do servidor.
 */

import { promotionShortLabel } from "@/lib/b2b/commission";
import type { B2BOfferPromotionNotice } from "@/lib/b2b/promotion-resolver";

export function bonusLabel(buy: number, free: number) {
  return `Compre ${buy} e leve +${free} grátis`;
}

/** Selo curto da promoção: "3 por 2" ou "10% OFF" (C3). */
export function promotionBadgeLabel(notice: { percent: number | null; buyQuantity: number; freeQuantity: number }) {
  return notice.percent !== null ? `${percentText(notice.percent)}% OFF` : promotionShortLabel(notice.buyQuantity, notice.freeQuantity);
}

export function percentText(percent: number) {
  return String(Math.round(percent * 100) / 100).replace(".", ",");
}

/** Selo do card da linha: "3 por 2", ou "Promoção somente em Sono" (pontual). */
export function lineBadge(
  notices: B2BOfferPromotionNotice[],
  groupId: string,
  /** Aviso único do alcance ("os sabonetes líquidos"), calculado pela página. */
  scopeText: string | null
) {
  const own = notices.filter((item) => item.commercialGroupId === groupId);

  if (own.length === 0) return null;

  const wide = own.find((item) => item.productIds.length === 0);

  if (wide) return promotionBadgeLabel(wide);

  const label = promotionBadgeLabel(own[0]);

  return scopeText ? `${label} · Oferta válida para ${scopeText}` : label;
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

  return match
    ? { buyQuantity: match.buyQuantity, freeQuantity: match.freeQuantity, percent: match.percent }
    : null;
}

/**
 * Quanto resta da promoção da linha (reabrir o link depois da 1ª compra):
 * "Você ainda tem 2 compras com 3 por 2" ou "3 por 2 válido até 30/10/2026".
 */
export function lineEligibilityCaption(notices: B2BOfferPromotionNotice[], groupId: string) {
  const own = notices.find((item) => item.commercialGroupId === groupId);

  if (!own) return null;

  const label = promotionBadgeLabel(own);

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
  if (!rule) return null;
  return rule.percent !== null ? `−${percentText(rule.percent)}% neste produto` : bonusLabel(rule.buyQuantity, rule.freeQuantity);
}

/** Volume exibido no card B2B: o do catálogo (bio-products.ts). */
export function b2bProductContent(product: { content: string } | null | undefined) {
  return product?.content || null;
}
