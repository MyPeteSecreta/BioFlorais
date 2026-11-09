/**
 * Cartão B2C (Mercado Pago, API /v1/orders): motivo da recusa, mensagem para o cliente e chave de idempotência por tentativa.
 * Aprovado pelo Luis em 09/11, depois de uma recusa "high_risk" (402) que não ficou gravada e chegou ao cliente como JSON cru.
 *  - A chave de idempotência é POR TENTATIVA (pedido + token do cartão): outra tentativa ou outro cartão não herda a recusa.
 *  - O que se grava da recusa: status, status_detail, HTTP e códigos de erro do MP. Nunca token, número, nome ou documento.
 * Funções puras, testáveis sem servidor.
 */

import { createHash } from "node:crypto";

export function cardAttemptIdempotencyKey(orderId: string, cardToken: string): string {
  const tokenHash = createHash("sha256").update(cardToken).digest("hex").slice(0, 16);

  return `bio-card-${orderId}-${tokenHash}`;
}

export type MercadoPagoOutcome = {
  httpStatus: number | null;
  mpOrderId: string | null;
  mpStatus: string | null;
  mpStatusDetail: string | null;
  mpErrorCodes: string[];
};

type OrderPayload = {
  id?: unknown;
  status?: unknown;
  status_detail?: unknown;
  transactions?: { payments?: Array<{ status?: unknown; status_detail?: unknown }> };
  errors?: Array<{ code?: unknown; details?: unknown }>;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Status e motivo de uma resposta do MP (o do pagamento vale mais que o do pedido). */
export function outcomeFromPayload(payload: unknown, httpStatus: number | null = null): MercadoPagoOutcome {
  const order = (payload && typeof payload === "object" ? payload : {}) as OrderPayload;
  const payment = order.transactions?.payments?.[0];
  const codes = (order.errors ?? []).flatMap((error) => {
    const details = Array.isArray(error.details) ? error.details.map(text).filter((item): item is string => Boolean(item)) : [];
    return [text(error.code), ...details].filter((item): item is string => Boolean(item));
  });

  return {
    httpStatus,
    mpOrderId: text(order.id),
    mpStatus: text(payment?.status) ?? text(order.status),
    mpStatusDetail: text(payment?.status_detail) ?? text(order.status_detail) ?? codes.find((code) => /_|risk|rejected/i.test(code)) ?? null,
    mpErrorCodes: codes.slice(0, 10),
  };
}

/**
 * Erro lançado pelo adaptador (`Mercado Pago request failed (402): {json}`) -> resultado legível; null se não for erro do MP
 * (rede, configuração etc.: segue o tratamento genérico).
 */
export function outcomeFromAdapterError(error: unknown): MercadoPagoOutcome | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = /^Mercado Pago request failed \((\d{3})\): ([\s\S]*)$/.exec(message);

  if (!match) return null;

  let payload: unknown = null;

  try {
    payload = JSON.parse(match[2]);
  } catch {
    payload = null;
  }

  return outcomeFromPayload(payload, Number(match[1]));
}

const PIX_HINT = "Tente outro cartão ou pague no Pix com desconto.";

/** Mensagem para o cliente conforme o motivo (status_detail) do MP. Nunca mostra o código nem o JSON. */
export function cardDeclineMessage(statusDetail: string | null | undefined): string {
  const detail = String(statusDetail ?? "").toLowerCase();

  if (/high_risk|fraud|blacklist/.test(detail)) return `O banco ou o antifraude não aprovou este pagamento. ${PIX_HINT}`;
  if (/insufficient_amount/.test(detail)) return `O cartão não tem limite suficiente para este valor. ${PIX_HINT}`;
  if (/security_code|cvv/.test(detail)) return "O código de segurança (CVV) não confere. Confira e tente de novo.";
  if (/bad_filled_date|expir/.test(detail)) return "A data de validade do cartão não confere. Confira e tente de novo.";
  if (/bad_filled/.test(detail)) return "Algum dado do cartão não confere. Confira o número, a validade e o CVV e tente de novo.";
  if (/call_for_authorize/.test(detail)) return `O banco pediu para você autorizar este pagamento. Ligue para o banco e tente de novo, ou pague no Pix com desconto.`;
  if (/card_disabled/.test(detail)) return `Este cartão está bloqueado ou não ativado. ${PIX_HINT}`;
  if (/max_attempts/.test(detail)) return `Muitas tentativas com este cartão. ${PIX_HINT}`;
  if (/duplicated/.test(detail)) return "Este pagamento já foi enviado. Confira o seu pedido antes de tentar de novo.";
  if (/installments/.test(detail)) return "O cartão não aceita este número de parcelas. Escolha outra opção e tente de novo.";

  return `O pagamento não foi aprovado. ${PIX_HINT}`;
}
