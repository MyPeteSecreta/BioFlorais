/**
 * BIO FLORAIS B2B — a escolha de promoção em LINGUAGEM SIMPLES (Offer Builder e "Criar link com promoção"). Só apresentação:
 * as regras, os preços e a comissão são os de sempre, apenas contados em reais e em frases curtas.
 *   - preço B2B no topo ("R$ 29,90 por unidade" / "de R$ X a R$ Y por unidade");
 *   - "O que o cliente ganha" com a conta pronta ("4 por 2: compra 2 por R$ 59,80 e leva 4 → sai R$ 14,95 cada"; "−15%: R$ 29,90 → R$ 25,42");
 *   - "Por quanto tempo vale para o cliente?" (só na 1ª compra / nas 2 primeiras / nas 3 primeiras / por 30, 60, 90 ou 180 dias);
 *   - "Sua comissão: 16% (10% fixo + 6% de bônus)" ao lado de cada opção;
 *   - textos curtos para o "?" de cada termo.
 */

import { applyB2BPercentDiscount } from "@/lib/b2b/promotion-engine";

export type PriceRange = { min: number; max: number };

export const formatBRL = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (value: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;

/** "R$ 29,90 por unidade" ou, onde os preços variam, "de R$ 21,90 a R$ 43,90 por unidade". null = sem preço conhecido. */
export function priceRangeText(range: PriceRange | null | undefined): string | null {
  if (!range || !Number.isFinite(range.min) || range.min <= 0) return null;

  return range.min === range.max ? `${formatBRL(range.min)} por unidade` : `de ${formatBRL(range.min)} a ${formatBRL(range.max)} por unidade`;
}

export function mergeRanges(ranges: Array<PriceRange | null | undefined>): PriceRange | null {
  const valid = ranges.filter((range): range is PriceRange => Boolean(range) && (range as PriceRange).min > 0);

  if (valid.length === 0) return null;

  return { min: Math.min(...valid.map((range) => range.min)), max: Math.max(...valid.map((range) => range.max)) };
}

export type PromotionShape = { buyQuantity: number; freeQuantity: number; percent: number | null };

export type PromotionDeal = {
  /** "4 por 2" ou "−15%". */
  headline: string;
  /** A conta pronta, em uma frase. */
  math: string | null;
  /** Explicação de uma linha do que é. */
  summary: string;
};

/** O que o cliente ganha, com a conta feita sobre o menor preço da linha/produto (null = sem preço para a conta). */
export function describeDeal(promotion: PromotionShape, range: PriceRange | null | undefined): PromotionDeal {
  const unit = range && range.min > 0 ? range.min : null;
  const example = unit && range && range.min !== range.max ? ` (exemplo com o produto de ${formatBRL(unit)})` : "";

  if (promotion.percent !== null) {
    const percent = promotion.percent;
    const headline = `−${String(percent).replace(".", ",")}%`;

    return {
      headline,
      summary: `O cliente paga ${String(percent).replace(".", ",")}% a menos no preço B2B.`,
      math: unit ? `${headline}: ${formatBRL(unit)} → ${formatBRL(applyB2BPercentDiscount(unit, percent))}${example}` : null,
    };
  }

  const pay = promotion.buyQuantity;
  const take = promotion.buyQuantity + promotion.freeQuantity;
  const headline = `${take} por ${pay}`;

  return {
    headline,
    summary: `A cada ${pay} que o cliente compra do mesmo produto, ${promotion.freeQuantity === 1 ? "leva mais 1 grátis" : `leva mais ${promotion.freeQuantity} grátis`}.`,
    math: unit
      ? `${headline}: compra ${pay} por ${formatBRL(pay * unit)} e leva ${take} → sai ${formatBRL(Math.round((pay * unit) / take))} cada${example}`
      : null,
  };
}

export type EligibilityText = { title: string; hint: string };

/** "Por quanto tempo vale para o cliente?": o texto de cada opção. */
export function eligibilityText(mode: "uses" | "days", value: number): EligibilityText {
  if (mode === "uses") {
    if (value === 1) return { title: "Só na 1ª compra", hint: "A promoção vale para o primeiro pedido do cliente." };

    return { title: `Nas ${value} primeiras compras`, hint: `A promoção vale para os ${value} primeiros pedidos do cliente.` };
  }

  return { title: `Por ${value} dias`, hint: `Compras sem limite durante ${value} dias, contados da geração do link.` };
}

/** "Sua comissão: 16% (10% fixo + 6% de bônus)". */
export function commissionText(basePercent: number, extraPercent: number): string {
  const total = Math.round((basePercent + extraPercent) * 10_000) / 10_000;

  return extraPercent > 0
    ? `Sua comissão: ${formatPercent(total)} (${formatPercent(basePercent)} fixo + ${formatPercent(extraPercent)} de bônus)`
    : `Sua comissão: ${formatPercent(total)} (${formatPercent(basePercent)} fixo, sem bônus)`;
}

/** Textos curtos do "?" de cada termo. */
export const HELP = {
  price: "É o preço de tabela que o lojista paga por unidade, antes de qualquer promoção. Onde os produtos têm preços diferentes, mostramos a faixa.",
  deal: "É a vantagem que o cliente recebe. A conta já está feita com o preço da linha: quanto ele paga, quantas unidades leva e quanto sai cada uma.",
  bonus: "“4 por 2” significa: o cliente compra 2 e leva 4 do mesmo produto. “−15%” é desconto direto no preço de cada unidade.",
  duration:
    "É por quanto tempo o cliente continua tendo a promoção depois que você manda o link. Por número de compras: vale só para os primeiros pedidos. Por dias: vale para quantas compras ele quiser dentro do prazo.",
  commission:
    "Comissão fixa é a que você ganha em toda venda. O bônus é um extra que a promoção paga, e muda conforme por quanto tempo ela vale para o cliente. A soma é o que você recebe.",
  opening: "Abertura / reconquista: só para cliente que nunca comprou a linha ou está há meses sem comprar. Recorrente: vale para qualquer cliente, inclusive quem já compra.",
} as const;
