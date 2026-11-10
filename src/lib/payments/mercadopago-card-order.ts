/**
 * Cartão B2C: criação do pagamento no Mercado Pago (API /v1/orders) feita AQUI, e não pelo pacote @angelblancdigital/payments,
 * porque o pacote só manda o e-mail do pagador. Aprovado pelo Luis em 09/11 (antifraude recusando "high_risk"): mandar ao MP
 * os dados do pagador do pedido (nome, CPF/CNPJ, telefone, endereço) e a identificação do aparelho (security.js do MP ->
 * cabeçalho X-meli-session-id).
 *  - Esses dados vão SÓ para o MP: nunca para log nem para payments.raw_payload.
 *  - Erro HTTP do MP: a mesma mensagem do pacote ("Mercado Pago request failed (402): {json}"), lida por card-decline.ts.
 *  - O status segue a mesma tradução do pacote; a consulta de status continua pelo pacote.
 */

export type CardPayerInput = {
  email: string;
  name?: string | null;
  personType?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  address?: {
    cep?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/** Pagador no formato da API de Orders; campo vazio ou inválido não vai. */
export function buildMercadoPagoPayer(input: CardPayerInput): Record<string, unknown> {
  const payer: Record<string, unknown> = { email: clean(input.email) };

  const name = clean(input.name);
  if (name) {
    const [first, ...rest] = name.split(" ");
    payer.first_name = first.slice(0, 60);
    if (rest.length > 0) payer.last_name = rest.join(" ").slice(0, 60);
  }

  const cnpj = digits(input.cnpj);
  const cpf = digits(input.cpf);
  if (input.personType === "pj" && cnpj.length === 14) payer.identification = { type: "CNPJ", number: cnpj };
  else if (cpf.length === 11) payer.identification = { type: "CPF", number: cpf };
  else if (cnpj.length === 14) payer.identification = { type: "CNPJ", number: cnpj };

  let phone = digits(input.phone);
  if (phone.length >= 12 && phone.startsWith("55")) phone = phone.slice(2);
  if (phone.length === 10 || phone.length === 11) payer.phone = { area_code: phone.slice(0, 2), number: phone.slice(2) };

  const address = input.address;
  const zip = digits(address?.cep);
  if (address && zip.length === 8 && clean(address.street)) {
    payer.address = {
      zip_code: zip,
      street_name: clean(address.street).slice(0, 100),
      street_number: clean(address.number).slice(0, 20) || "S/N",
      ...(clean(address.district) ? { neighborhood: clean(address.district).slice(0, 60) } : {}),
      ...(clean(address.city) ? { city: clean(address.city).slice(0, 60) } : {}),
      ...(/^[A-Za-z]{2}$/.test(clean(address.state)) ? { state: clean(address.state).toUpperCase() } : {}),
      ...(clean(address.complement) ? { complement: clean(address.complement).slice(0, 60) } : {}),
    };
  }

  return payer;
}

/** Identificação do aparelho vinda do navegador (window.MP_DEVICE_SESSION_ID); fora do formato, não vai. */
export function sanitizeDeviceSessionId(value: unknown): string | null {
  const text = String(value ?? "").trim();

  return /^[A-Za-z0-9_:.-]{8,128}$/.test(text) ? text : null;
}

/** A mesma tradução de status do pacote @angelblancdigital/payments (0.1.1). */
export function mapOrderStatus(order: { status?: unknown; status_detail?: unknown; transactions?: { payments?: Array<{ status?: unknown; status_detail?: unknown }> } }) {
  const payment = order.transactions?.payments?.[0];
  const status = String(payment?.status ?? order.status ?? "").toLowerCase();
  const detail = String(payment?.status_detail ?? order.status_detail ?? "").toLowerCase();

  if (status === "processed" || status === "approved" || status === "paid" || detail === "accredited") return "paid";
  if (status === "authorized" || detail === "authorized") return "authorized";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "refunded" || detail === "refunded") return "refunded";
  if (status === "rejected" || status === "failed") return "failed";

  return "pending";
}

/** Corpo do POST /v1/orders (separado para teste). */
export function buildCardOrderBody(input: {
  orderId: string;
  amountCents: number;
  payer: Record<string, unknown>;
  cardToken: string;
  paymentMethodId: string;
  installments: number;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("amountCents must be a positive integer.");

  const amount = (input.amountCents / 100).toFixed(2);

  return {
    type: "online",
    processing_mode: "automatic",
    external_reference: input.orderId,
    total_amount: amount,
    payer: input.payer,
    transactions: {
      payments: [
        {
          amount,
          payment_method: { id: input.paymentMethodId, type: "credit_card", token: input.cardToken, installments: input.installments },
        },
      ],
    },
  };
}

export async function createMercadoPagoCardOrder(
  input: {
    accessToken: string;
    orderId: string;
    amountCents: number;
    payer: Record<string, unknown>;
    cardToken: string;
    paymentMethodId: string;
    installments: number;
    idempotencyKey: string;
    deviceSessionId: string | null;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{ externalId: string; status: ReturnType<typeof mapOrderStatus>; rawPayload: unknown }> {
  const response = await fetchImpl("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken.trim()}`,
      "X-Idempotency-Key": input.idempotencyKey,
      ...(input.deviceSessionId ? { "X-meli-session-id": input.deviceSessionId } : {}),
    },
    body: JSON.stringify(buildCardOrderBody(input)),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: unknown };

  if (!response.ok) throw new Error(`Mercado Pago request failed (${response.status}): ${JSON.stringify(payload)}`);
  if (!payload.id) throw new Error("Mercado Pago did not return an order id.");

  return { externalId: String(payload.id), status: mapOrderStatus(payload as Parameters<typeof mapOrderStatus>[0]), rawPayload: payload };
}
