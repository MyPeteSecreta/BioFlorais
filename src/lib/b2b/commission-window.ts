/**
 * BIO FLORAIS B2B — janela de 180 dias da comissão (adaptado do desenho da
 * My Pet; confirmada pelo Luis em 02/10/2026).
 *
 * - A janela é por CLIENTE nesta marca (não reinicia se o cliente trocar de
 *   vendedor) e conta de `orders.created_at` do 1º pedido B2B do cliente
 *   que foi PAGO.
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

import type { SqlRunner } from "@/lib/b2b/ownership";
import { isUuid } from "@/lib/b2b/admin-input";

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

/**
 * created_at do 1º pedido B2B PAGO do cliente. Independe do vendedor da
 * oferta. orders.created_at é timestamp sem fuso, lido como UTC (Neon).
 */
export async function loadFirstPaidOrderAt(run: SqlRunner, clientId: string): Promise<Date | null> {
  if (!isUuid(clientId)) return null;

  const [row] = await run(
    `SELECT to_char(min(created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS first_paid_at
       FROM orders
      WHERE b2b_client_id = $1 AND b2b_offer_id IS NOT NULL AND status = 'paid'`,
    [clientId]
  );

  const raw = row?.first_paid_at;

  if (!raw) return null;

  // to_char devolve texto ISO em UTC (created_at é timestamp sem fuso, tratado como UTC).
  return new Date(String(raw));
}

export async function loadClientCommissionWindow(run: SqlRunner, clientId: string, now = new Date()) {
  return commissionWindowFor(await loadFirstPaidOrderAt(run, clientId), now);
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
