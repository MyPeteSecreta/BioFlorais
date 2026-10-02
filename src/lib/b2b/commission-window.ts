/**
 * BIO FLORAIS B2B — janela de 180 dias da comissão (adaptado do desenho da
 * My Pet; confirmada pelo Luis em 02/10/2026).
 *
 * - A janela é por CLIENTE e LINHA (Rodada 2, R6: parametrizável para marca em
 *   purchase-history.ts), não reinicia se o cliente trocar de vendedor, e conta
 *   do `created_at` da 1ª compra do ciclo (compra = R4: paga, ou boleto gerado).
 * - Preço normal: base + extra do preço normal dentro da janela; depois,
 *   só a base ("base_only"). No dia 180 ainda vale o extra.
 * - Item bonificado por promoção da oferta (elegibilidade ainda ativa):
 *   base + extra da promoção ("promotion"), a janela não limita.
 * - Promoção esgotada, item sem bonificação e outras linhas: regra do preço
 *   normal. Sem compra paga anterior a janela ainda não começou: vale o extra
 *   (a própria 1ª compra recebe).
 *
 * Funções puras (testadas em scripts/b2b-commission-window.test.mjs); a
 * consulta da 1ª compra paga é SQL puro sobre um SqlRunner.
 */

export const COMMISSION_WINDOW_DAYS = 180;

export type CommissionBasis = "promotion" | "normal_price" | "base_only";

export type CommissionWindow = {
  /** Geração (created_at) do 1º pedido B2B pago do cliente (null = ainda não comprou). */
  firstPaidAt: Date | null;
  /** Fim da janela (null = ainda não começou). */
  endsAt: Date | null;
  /** Aberta em `now` (inclui "ainda não começou"). */
  open: boolean;
};

export function commissionWindowFor(
  firstPaidAt: Date | null,
  now: Date,
  days: number = COMMISSION_WINDOW_DAYS
): CommissionWindow {
  if (!firstPaidAt) return { firstPaidAt: null, endsAt: null, open: true };

  const endsAt = new Date(firstPaidAt.getTime() + days * 24 * 60 * 60 * 1000);

  return { firstPaidAt, endsAt, open: now.getTime() <= endsAt.getTime() };
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

export type ItemCommission = {
  basePercent: number;
  extraPercent: number;
  totalPercent: number;
  basis: CommissionBasis;
};

export function resolveItemCommission(input: {
  basePercent: number;
  normalExtraPercent: number;
  /** Extra da promoção, só se a bonificação foi realizada com elegibilidade ativa. */
  promotionExtraPercent: number | null;
  window: CommissionWindow;
}): ItemCommission {
  const { basePercent, normalExtraPercent, promotionExtraPercent, window } = input;

  if (promotionExtraPercent !== null) {
    return {
      basePercent,
      extraPercent: promotionExtraPercent,
      totalPercent: round4(basePercent + promotionExtraPercent),
      basis: "promotion",
    };
  }

  if (window.open) {
    return {
      basePercent,
      extraPercent: normalExtraPercent,
      totalPercent: round4(basePercent + normalExtraPercent),
      basis: "normal_price",
    };
  }

  return { basePercent, extraPercent: 0, totalPercent: round4(basePercent), basis: "base_only" };
}

/** Texto para o vendedor (Offer Builder, revisão e painel do cliente). */
export function describeCommissionWindow(
  rules: { basePercent: number; normalExtraPercent: number },
  window: CommissionWindow
): string {
  const base = `${rules.basePercent}%`;
  const extra = `${rules.normalExtraPercent}%`;
  const total = `${round4(rules.basePercent + rules.normalExtraPercent)}%`;

  if (!window.endsAt) {
    return `${base} + ${extra} = ${total} · válido por ${COMMISSION_WINDOW_DAYS} dias a partir da 1ª compra paga; depois ${base}`;
  }

  const until = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(window.endsAt);

  return window.open
    ? `${base} + ${extra} = ${total} até ${until} (${COMMISSION_WINDOW_DAYS} dias após a 1ª compra); depois ${base}`
    : `Janela de ${COMMISSION_WINDOW_DAYS} dias encerrada em ${until}: preço normal rende só ${base}`;
}
