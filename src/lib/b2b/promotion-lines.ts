/**
 * BIO FLORAIS B2B — parte PURA do resolvedor de promoções: dadas as promoções vigentes da oferta
 * (cada uma escolhida numa LINHA, com a elegibilidade dela) e o carrinho, decide o que cada item
 * recebe. A escolha vale por (promoção, LINHA): só para os produtos daquela linha. A mesma promoção
 * pode aparecer em várias linhas, cada uma com a sua elegibilidade (e o seu limite de usos).
 */

import { applyB2BPercentDiscount, calculateB2BPromotionBonusQty } from "@/lib/b2b/promotion-engine";

export const PERCENT_PROMOTION_TYPE = "percentage_discount";

export type ActivePromotionRow = {
  promotionId: string;
  /** Linha em que o vendedor escolheu a promoção (null = registro antigo, sem linha). */
  commercialGroupId: string | null;
  type: string | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
  percentage: string | number | null;
};

export type PromotionLinesBonus = { productId: string; qty: number; promotionId: string; commercialGroupId: string | null };
export type PromotionLinesDiscount = { productId: string; percent: number; promotionId: string; commercialGroupId: string | null };

export function matchPromotionLines(input: {
  active: readonly ActivePromotionRow[];
  /** Produtos da oferta e as linhas a que pertencem. */
  productsById: ReadonlyMap<string, { commercialGroupIds: string[] }>;
  explicitRows: ReadonlyArray<{ promotionId: string; productId: string }>;
  groupRows: ReadonlyArray<{ promotionId: string; commercialGroupId: string }>;
  cartItems: ReadonlyArray<{ productId: string; qty: number }>;
}): { bonusLines: PromotionLinesBonus[]; discountLines: PromotionLinesDiscount[]; promotionIdsUsed: string[] } {
  const { active, productsById, explicitRows, groupRows, cartItems } = input;

  /*
   * Elegibilidade: lista explícita de produtos da promoção > grupos comerciais da promoção > qualquer
   * produto da oferta. Em todos os casos o produto precisa pertencer à oferta E à LINHA em que esta
   * escolha (promoção + linha) foi feita.
   */
  function isEligible(promotionId: string, chosenGroup: string | null, productId: string) {
    const product = productsById.get(productId);

    if (!product) return false;

    if (chosenGroup && !product.commercialGroupIds.includes(chosenGroup)) return false;

    const explicit = explicitRows.filter((row) => row.promotionId === promotionId);

    if (explicit.length > 0) return explicit.some((row) => row.productId === productId);

    const groups = groupRows.filter((row) => row.promotionId === promotionId);

    if (groups.length > 0) return groups.some((row) => product.commercialGroupIds.includes(row.commercialGroupId));

    return true;
  }

  const bonusLines: PromotionLinesBonus[] = [];
  const discountLines: PromotionLinesDiscount[] = [];
  const used = new Set<string>();

  for (const item of cartItems) {
    const match = active.find((promotion) => isEligible(promotion.promotionId, promotion.commercialGroupId, item.productId));

    if (!match) continue;

    if (match.type === PERCENT_PROMOTION_TYPE) {
      // C3: X% de desconto; o item é considerado "promocional" mesmo se o preço não mudar de centavo.
      const percent = Number(match.percentage);

      if (applyB2BPercentDiscount(1000, percent) < 1000) {
        discountLines.push({ productId: item.productId, percent, promotionId: match.promotionId, commercialGroupId: match.commercialGroupId });
        used.add(match.promotionId);
      }

      continue;
    }

    const bonusQty = calculateB2BPromotionBonusQty(item.qty, match.buyQuantity!, match.freeQuantity!);

    if (bonusQty > 0) {
      bonusLines.push({ productId: item.productId, qty: bonusQty, promotionId: match.promotionId, commercialGroupId: match.commercialGroupId });
      used.add(match.promotionId);
    }
  }

  return { bonusLines, discountLines, promotionIdsUsed: Array.from(used) };
}
