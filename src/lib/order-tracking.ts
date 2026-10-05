/**
 * BIO FLORAIS — acompanhamento do pedido pelo cliente (B2C e B2B), Rodada 4.
 *
 *  - Busca pública: número do pedido + (e-mail OU CPF/CNPJ). Resposta genérica
 *    se não achar (não revela se o pedido existe) e limite de tentativas por IP.
 *  - Link direto ASSINADO (HMAC com ADMIN_SESSION_SECRET): `<orderId>.<assinatura>`.
 *    Não carrega e-mail, CPF nem nome; o id é um UUID aleatório.
 *  - Só LEITURA de pedidos/itens/pagamentos; escreve apenas em
 *    order_tracking_attempts e order_events (sql/b2b/23b).
 * SQL puro sobre SqlRunner (roda no Neon e no PGlite dos testes).
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { isUuid } from "@/lib/b2b/admin-input";
import { loadBoletoInstallments, type BoletoInstallment } from "@/lib/b2b/boleto-installments";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";

// ---------------------------------------------------------------------------
// Link assinado
// ---------------------------------------------------------------------------

function secret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? null;
}

function sign(orderId: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`order-tracking:${orderId}`).digest("base64url").slice(0, 32);
}

export function signTrackingToken(orderId: string): string | null {
  const signature = sign(orderId);
  return signature ? `${orderId}.${signature}` : null;
}

/** Devolve o id do pedido se a assinatura confere; senão null. */
export function verifyTrackingToken(token: string | null | undefined): string | null {
  const [orderId, signature] = String(token ?? "").split(".");

  if (!orderId || !signature || !isUuid(orderId)) return null;

  const expected = sign(orderId);
  if (!expected) return null;

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b) ? orderId : null;
}

// ---------------------------------------------------------------------------
// Busca (número + e-mail ou CPF/CNPJ) e limite de tentativas
// ---------------------------------------------------------------------------

export const TRACKING_MAX_ATTEMPTS = 5;
export const TRACKING_WINDOW_MINUTES = 10;

const memoryAttempts = new Map<string, number[]>();

export function hashIp(ip: string) {
  return createHash("sha256").update(`tracking:${ip}`).digest("hex").slice(0, 32);
}

/** Registra a tentativa e diz se ainda pode tentar (5 a cada 10 min por IP). */
export async function allowTrackingAttempt(run: SqlRunner, ipHash: string, now = new Date()): Promise<boolean> {
  try {
    const [{ total }] = await run(
      `SELECT count(*)::int AS total FROM order_tracking_attempts
        WHERE ip_hash = $1 AND attempted_at > ($2::timestamp - ($3 || ' minutes')::interval)`,
      [ipHash, now.toISOString(), String(TRACKING_WINDOW_MINUTES)]
    );

    if (Number(total) >= TRACKING_MAX_ATTEMPTS) return false;

    await run(`INSERT INTO order_tracking_attempts (ip_hash, attempted_at) VALUES ($1, $2::timestamp)`, [ipHash, now.toISOString()]);
    return true;
  } catch {
    // Sem a tabela (SQL 23b): limite em memória (por instância; melhor que nada).
    const since = now.getTime() - TRACKING_WINDOW_MINUTES * 60_000;
    const recent = (memoryAttempts.get(ipHash) ?? []).filter((time) => time > since);

    if (recent.length >= TRACKING_MAX_ATTEMPTS) {
      memoryAttempts.set(ipHash, recent);
      return false;
    }

    memoryAttempts.set(ipHash, [...recent, now.getTime()]);
    return true;
  }
}

/** Número do pedido = primeiros 8 caracteres do id, em maiúsculas (como o cliente vê). */
export function normalizeOrderNumber(value: string) {
  const cleaned = String(value ?? "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  return cleaned.length === 8 ? cleaned : null;
}

/** E-mail (tem @) ou documento (11/14 dígitos). */
export function parseContact(value: string): { email: string | null; digits: string | null } | null {
  const text = String(value ?? "").trim();

  if (text.includes("@")) return text.length <= 254 ? { email: text.toLowerCase(), digits: null } : null;

  const digits = text.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? { email: null, digits } : null;
}

/** Id do pedido se número + contato batem com UM pedido; senão null (sem dizer o motivo). */
export async function findOrderForTracking(run: SqlRunner, number: string, contact: string): Promise<string | null> {
  const orderNumber = normalizeOrderNumber(number);
  const parsed = parseContact(contact);

  if (!orderNumber || !parsed) return null;

  const rows = await run(
    `SELECT o.id FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE upper(left(o.id::text, 8)) = $1
        AND ( ($2::text IS NOT NULL AND lower(c.email) = $2::text)
           OR ($3::text IS NOT NULL AND (regexp_replace(coalesce(c.cpf, ''), '\\D', '', 'g') = $3::text
                                      OR regexp_replace(coalesce(c.cnpj, ''), '\\D', '', 'g') = $3::text)) )
      LIMIT 2`,
    [orderNumber, parsed.email, parsed.digits]
  );

  return rows.length === 1 ? String(rows[0].id) : null;
}

// ---------------------------------------------------------------------------
// Linha do tempo (pura)
// ---------------------------------------------------------------------------

export type TimelineStep = {
  key: "received" | "payment" | "separating" | "shipped" | "delivered";
  label: string;
  state: "done" | "current" | "pending";
  detail: string | null;
};

const CANCELLED = ["cancelled", "canceled", "failed", "expired", "refunded", "rejected"];

const brDate = (value: Date | string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value))
    : null;

export type TrackingEvent = {
  event: string;
  carrier: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  note: string | null;
  createdAt: Date;
};

export function buildTimeline(input: {
  status: string;
  fulfillmentStatus: string;
  paymentMethod: string | null;
  createdAt: Date;
  paidAt: Date | null;
  boletoPaid: number;
  boletoTotal: number;
  events: TrackingEvent[];
  trackingCode: string | null;
  carrier: string | null;
}): { cancelled: boolean; steps: TimelineStep[] } {
  const cancelled = CANCELLED.includes(input.status) || input.fulfillmentStatus === "cancelled";
  const find = (name: string) => [...input.events].reverse().find((event) => event.event === name) ?? null;

  const paid = input.status === "paid" || input.status === "approved";
  const separating = find("separating");
  const shippedEvent = find("shipped");
  const deliveredEvent = find("delivered");

  const shipped = Boolean(shippedEvent) || input.fulfillmentStatus === "shipped" || input.fulfillmentStatus === "delivered";
  const delivered = Boolean(deliveredEvent) || input.fulfillmentStatus === "delivered";
  const inSeparation =
    Boolean(separating) || ["separating", "ready_to_ship", "shipped", "delivered"].includes(input.fulfillmentStatus) || shipped;

  const steps: TimelineStep[] = [
    { key: "received", label: "Pedido recebido", state: "done", detail: brDate(input.createdAt) },
    {
      key: "payment",
      label: paid ? "Pagamento confirmado" : "Pagamento",
      state: paid ? "done" : "current",
      detail: paid
        ? brDate(input.paidAt) ?? null
        : input.paymentMethod === "boleto" && input.boletoTotal > 0
          ? `Boleto: ${input.boletoPaid} de ${input.boletoTotal} parcela(s) paga(s)`
          : "Aguardando pagamento",
    },
    {
      key: "separating",
      label: "Em separação",
      state: inSeparation ? "done" : paid ? "current" : "pending",
      detail: separating ? brDate(separating.createdAt) : null,
    },
    {
      key: "shipped",
      label: "Enviado",
      state: shipped ? "done" : inSeparation ? "current" : "pending",
      detail: shipped
        ? [shippedEvent?.carrier ?? input.carrier, shippedEvent ? brDate(shippedEvent.createdAt) : null].filter(Boolean).join(" · ") || null
        : null,
    },
    {
      key: "delivered",
      label: "Entregue",
      state: delivered ? "done" : shipped ? "current" : "pending",
      detail: deliveredEvent ? brDate(deliveredEvent.createdAt) : null,
    },
  ];

  return { cancelled, steps };
}

// ---------------------------------------------------------------------------
// Carga da tela de acompanhamento
// ---------------------------------------------------------------------------

export type TrackingItem = { name: string; qty: number; unitPriceCents: number; bonified: boolean };

export type TrackingView = {
  orderId: string;
  number: string;
  createdAt: Date;
  status: string;
  fulfillmentStatus: string;
  paymentMethod: string | null;
  isB2B: boolean;
  items: TrackingItem[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  carrier: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  /** Endereço parcial: cidade/UF e início do CEP (sem rua, número ou nome). */
  addressPartial: string | null;
  timeline: { cancelled: boolean; steps: TimelineStep[] };
  events: TrackingEvent[];
  boleto: BoletoInstallment[];
  /** Pix ainda válido (criado há < 25 min): copia-e-cola para pagar de novo. */
  pixCode: string | null;
};

function extractPixCode(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const direct = payload.qrCode ?? payload.qr_code ?? payload.emv ?? payload.copyPaste;
  if (typeof direct === "string" && direct.length > 20) return direct;

  const nested = JSON.stringify(payload).match(/"(?:qr_code|qrCode|emv|payload)"\s*:\s*"(000201[^"]+)"/);
  return nested ? nested[1] : null;
}

export async function loadTrackingView(run: SqlRunner, orderId: string, now = new Date()): Promise<TrackingView | null> {
  if (!isUuid(orderId)) return null;

  const [order] = await run(
    `SELECT o.id, o.status, o.fulfillment_status, o.payment_method, o.subtotal_cents, o.discount_cents, o.shipping_cents,
            o.total_cents, o.shipping_service_name, o.tracking_code, o.b2b_offer_id,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            a.city, a.state, a.cep
       FROM orders o LEFT JOIN addresses a ON a.id = o.shipping_address_id
      WHERE o.id = $1`,
    [orderId]
  );

  if (!order) return null;

  const itemRows = await run(
    `SELECT i.qty, i.unit_price_cents, to_jsonb(i) ->> 'product_name_snapshot' AS snapshot,
            p.slug, p.name, p.category, p.line_slug
       FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      WHERE i.order_id = $1 ORDER BY i.unit_price_cents DESC, p.name`,
    [orderId]
  );

  const eventRows = await run(
    `SELECT event, carrier, tracking_code, tracking_url, note, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM order_events WHERE order_id = $1 ORDER BY created_at`,
    [orderId]
  ).catch(() => []);

  const events: TrackingEvent[] = eventRows.map((row) => ({
    event: String(row.event),
    carrier: (row.carrier as string | null) ?? null,
    trackingCode: (row.tracking_code as string | null) ?? null,
    trackingUrl: (row.tracking_url as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    createdAt: new Date(String(row.created_at)),
  }));

  const paymentRows = await run(
    `SELECT status, method, raw_payload, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
    [orderId]
  );

  const paidPayment = paymentRows.find((row) => row.status === "paid");
  const paymentMethod = (order.payment_method as string | null) ?? null;
  const status = String(order.status ?? "");

  let boleto: BoletoInstallment[] = [];

  if (paymentMethod === "boleto") {
    boleto = (await loadBoletoInstallments(run, {}, now).catch(() => [])).filter((item) => item.orderId === orderId);
  }

  // Pix pendente e ainda válido: mostra o copia-e-cola de novo.
  let pixCode: string | null = null;
  const pendingPix = paymentRows.find((row) => row.status === "pending" && (row.method === "pix" || paymentMethod === "pix"));

  if (status === "pending" && pendingPix) {
    const ageMinutes = (now.getTime() - new Date(String(pendingPix.created_at)).getTime()) / 60_000;
    if (ageMinutes < 25) pixCode = extractPixCode(pendingPix.raw_payload);
  }

  const lastShipped = [...events].reverse().find((event) => event.event === "shipped") ?? null;
  const carrier = lastShipped?.carrier ?? (order.shipping_service_name as string | null) ?? null;
  const trackingCode = lastShipped?.trackingCode ?? (order.tracking_code as string | null) ?? null;
  const createdAt = new Date(String(order.created_at));

  return {
    orderId,
    number: orderId.slice(0, 8).toUpperCase(),
    createdAt,
    status,
    fulfillmentStatus: String(order.fulfillment_status ?? ""),
    paymentMethod,
    isB2B: Boolean(order.b2b_offer_id),
    items: itemRows.map((row) => {
      const label = row.slug
        ? b2bProductLabel({
            slug: String(row.slug),
            name: String(row.name ?? "Produto"),
            category: (row.category as string | null) ?? null,
            lineSlug: (row.line_slug as string | null) ?? null,
          }).full
        : "Produto";

      return {
        name: (row.snapshot as string | null) || label,
        qty: Number(row.qty ?? 0),
        unitPriceCents: Number(row.unit_price_cents ?? 0),
        bonified: Number(row.unit_price_cents ?? 0) === 0,
      };
    }),
    subtotalCents: Number(order.subtotal_cents ?? 0),
    discountCents: Number(order.discount_cents ?? 0),
    shippingCents: Number(order.shipping_cents ?? 0),
    totalCents: Number(order.total_cents ?? 0),
    carrier,
    trackingCode,
    trackingUrl: lastShipped?.trackingUrl ?? null,
    addressPartial: order.city ? `${order.city}/${order.state} · CEP ${String(order.cep ?? "").replace(/\D/g, "").slice(0, 5)}-***` : null,
    timeline: buildTimeline({
      status,
      fulfillmentStatus: String(order.fulfillment_status ?? ""),
      paymentMethod,
      createdAt,
      paidAt: paidPayment ? new Date(String(paidPayment.created_at)) : null,
      boletoPaid: boleto.filter((item) => item.status === "pago").length,
      boletoTotal: boleto.length,
      events,
      trackingCode,
      carrier,
    }),
    events,
    boleto,
    pixCode,
  };
}

/** Pedidos de um cliente B2B (só dele), do mais novo ao mais antigo — "Meus pedidos" no link. */
export async function listClientOrders(run: SqlRunner, clientId: string) {
  if (!isUuid(clientId)) return [];

  const rows = await run(
    `SELECT o.id, o.status, o.fulfillment_status, o.payment_method, o.total_cents,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM orders o WHERE o.b2b_client_id = $1 AND o.b2b_offer_id IS NOT NULL
      ORDER BY o.created_at DESC LIMIT 100`,
    [clientId]
  );

  return rows.map((row) => ({
    orderId: String(row.id),
    number: String(row.id).slice(0, 8).toUpperCase(),
    createdAt: new Date(String(row.created_at)),
    status: String(row.status ?? ""),
    fulfillmentStatus: String(row.fulfillment_status ?? ""),
    paymentMethod: (row.payment_method as string | null) ?? null,
    totalCents: Number(row.total_cents ?? 0),
  }));
}

/** Rótulo curto do andamento (lista "Meus pedidos"). */
export function progressLabel(status: string, fulfillmentStatus: string) {
  if (CANCELLED.includes(status) || fulfillmentStatus === "cancelled") return "Cancelado";
  if (fulfillmentStatus === "delivered") return "Entregue";
  if (fulfillmentStatus === "shipped") return "Enviado";
  if (["separating", "ready_to_ship"].includes(fulfillmentStatus)) return "Em separação";
  if (status === "paid" || status === "approved") return "Pago · aguardando separação";
  return "Aguardando pagamento";
}

// ---------------------------------------------------------------------------
// Busca principal: e-mail + CPF/CNPJ (os DOIS, do MESMO cliente) -> pedidos dos últimos 6 meses
// ---------------------------------------------------------------------------

export const TRACKING_LIST_MONTHS = 6;
export const TRACKING_LIST_LIMIT = 50;

export type TrackedOrderSummary = {
  orderId: string;
  number: string;
  createdAt: Date;
  totalCents: number;
  situation: string;
};

/** E-mail válido (sem espaços) em minúsculas, ou null. */
export function parseEmail(value: string): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

/** CPF (11) ou CNPJ (14) só com dígitos, ou null. */
export function parseDocument(value: string): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

/**
 * Pedidos dos últimos 6 meses do cliente cujo cadastro tem esse e-mail E esse CPF/CNPJ.
 * Os dois precisam bater NO MESMO cadastro: e-mail certo com documento errado (ou o
 * contrário) devolve vazio, igual a "não existe" (o chamador responde de forma genérica).
 * Nunca mistura pedidos de outro cliente (mesmo e-mail com outro documento fica de fora).
 */
export async function findOrdersByEmailAndDocument(
  run: SqlRunner,
  emailInput: string,
  documentInput: string,
  now = new Date()
): Promise<TrackedOrderSummary[]> {
  const email = parseEmail(emailInput);
  const document = parseDocument(documentInput);

  if (!email || !document) return [];

  const rows = await run(
    `SELECT o.id, o.status, o.fulfillment_status, o.total_cents,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      WHERE lower(c.email) = $1
        AND (regexp_replace(coalesce(c.cpf, ''), '\\D', '', 'g') = $2 OR regexp_replace(coalesce(c.cnpj, ''), '\\D', '', 'g') = $2)
        AND o.created_at >= ($3::timestamp - ($4 || ' months')::interval)
      ORDER BY o.created_at DESC
      LIMIT $5`,
    [email, document, now.toISOString(), String(TRACKING_LIST_MONTHS), TRACKING_LIST_LIMIT]
  );

  return rows.map((row) => ({
    orderId: String(row.id),
    number: String(row.id).slice(0, 8).toUpperCase(),
    createdAt: new Date(String(row.created_at)),
    totalCents: Number(row.total_cents ?? 0),
    situation: progressLabel(String(row.status ?? ""), String(row.fulfillment_status ?? "")),
  }));
}
