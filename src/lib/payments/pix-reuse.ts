/**
 * Pix B2C (Mercado Pago /v1/orders): reaproveitar o Pix pendente do mesmo pedido em vez de criar outro (aprovado pelo Luis em
 * 10/11, depois de um pedido que gerou 11 Pix em 6 minutos). Vale o Pix com código, do MESMO valor do pedido, criado há menos
 * de 25 minutos (o Pix vale 30: sobram pelo menos 5 para pagar) e ainda não pago, cancelado ou vencido.
 * Funções puras (testáveis sem banco).
 */

export const PIX_VALIDITY_MINUTES = 30;
export const PIX_REUSE_MAX_AGE_MINUTES = 25;
export const PIX_NO_CODE_MESSAGE = "O Mercado Pago não devolveu o código do Pix. Tente de novo em instantes ou pague com cartão.";

const CLOSED = new Set(["paid", "approved", "processed", "cancelled", "canceled", "expired", "failed", "rejected", "refunded"]);

type PixOrderPayload = {
  id?: unknown;
  status?: unknown;
  status_detail?: unknown;
  total_amount?: unknown;
  transactions?: {
    payments?: Array<{
      id?: unknown;
      status?: unknown;
      status_detail?: unknown;
      amount?: unknown;
      payment_method?: { ticket_url?: unknown; qr_code?: unknown; qr_code_base64?: unknown };
    }>;
  };
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export type PixResponse = {
  mercadoPagoOrderId: string;
  mercadoPagoPaymentId: string | null;
  status: string;
  statusDetail: string | null;
  pix: { ticketUrl: string | null; qrCode: string; qrCodeBase64: string | null };
};

/** Resposta do Pix a partir do pedido do MP; null se não houver código (não dá para pagar). */
export function pixResponseFromOrder(payload: unknown): PixResponse | null {
  const order = (payload && typeof payload === "object" ? payload : {}) as PixOrderPayload;
  const payment = order.transactions?.payments?.[0];
  const qrCode = text(payment?.payment_method?.qr_code);
  const id = text(order.id);

  if (!id || !qrCode) return null;

  return {
    mercadoPagoOrderId: id,
    mercadoPagoPaymentId: text(payment?.id),
    status: text(payment?.status) ?? text(order.status) ?? "pending",
    statusDetail: text(payment?.status_detail) ?? text(order.status_detail),
    pix: { ticketUrl: text(payment?.payment_method?.ticket_url), qrCode, qrCodeBase64: text(payment?.payment_method?.qr_code_base64) },
  };
}

/** Pix já gerado que ainda serve para este pedido: mesmo valor, com código, aberto e com tempo para pagar. */
export function reusablePix(
  candidate: { status: string | null; rawPayload: unknown; createdAt: Date | null },
  orderTotalAmount: string,
  nowMs: number = Date.now()
): (PixResponse & { expiresAt: string }) | null {
  if (!candidate.createdAt || CLOSED.has(String(candidate.status ?? "").toLowerCase())) return null;

  const ageMs = nowMs - candidate.createdAt.getTime();
  if (ageMs < 0 || ageMs > PIX_REUSE_MAX_AGE_MINUTES * 60 * 1000) return null;

  const order = (candidate.rawPayload && typeof candidate.rawPayload === "object" ? candidate.rawPayload : {}) as PixOrderPayload;
  const amount = text(order.total_amount) ?? text(order.transactions?.payments?.[0]?.amount);
  if (amount !== orderTotalAmount) return null;

  const response = pixResponseFromOrder(order);
  if (!response || CLOSED.has(response.status.toLowerCase())) return null;

  return { ...response, expiresAt: new Date(candidate.createdAt.getTime() + PIX_VALIDITY_MINUTES * 60 * 1000).toISOString() };
}
