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
