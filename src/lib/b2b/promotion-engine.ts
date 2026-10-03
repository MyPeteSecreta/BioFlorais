/**
 * BIO FLORAIS B2B — "compre X, leve Y grátis" (mesmo SKU).
 * Função pura: quantas unidades bônus o cliente ganha pelas pagas.
 * Ex.: buy=3, free=1, 7 pagas -> 2 blocos completos -> 2 grátis.
 */
export function calculateB2BPromotionBonusQty(
  paidQty: number,
  buyQuantity: number,
  freeQuantity: number
): number {
  if (
    !Number.isFinite(paidQty) ||
    !Number.isFinite(buyQuantity) ||
    !Number.isFinite(freeQuantity) ||
    paidQty <= 0 ||
    buyQuantity <= 0 ||
    freeQuantity <= 0
  ) {
    return 0;
  }

  return Math.floor(paidQty / buyQuantity) * freeQuantity;
}

/**
 * Promoção "X% de desconto" (C3): preço unitário efetivo em centavos,
 * arredondado ao centavo. O desconto Pix 7% / cartão 3% incide DEPOIS, sobre
 * este preço; o cupom vale sobre o total como antes.
 */
export function applyB2BPercentDiscount(unitPriceCents: number, percent: number): number {
  if (!Number.isFinite(unitPriceCents) || !Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    return unitPriceCents;
  }

  return Math.round((unitPriceCents * (100 - percent)) / 100);
}

/** Preço unitário efetivo da linha da sacola (com o desconto %, se houver). */
export function effectiveUnitPriceCents(line: { priceCents: number; discountPercent?: number | null }) {
  return applyB2BPercentDiscount(line.priceCents, line.discountPercent ?? 0);
}
