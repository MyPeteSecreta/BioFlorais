/**
 * API DE CONVERSÕES DA META (item 5 da mestre, 10/11): o Purchase também sai pelo SERVIDOR (Graph API /{pixel}/events) quando o
 * pedido B2C vira pago, com event_id = id do pedido (o MESMO do pixel do navegador: a Meta deduplica).
 *  - Só com o aceite de marketing do banner, registrado no pedido no checkout (política de privacidade, 03/11). Sem aceite: nada.
 *  - user_data: e-mail e telefone em SHA-256, IP, navegador e os cookies _fbp/_fbc. A política publicada diz que NÃO enviamos
 *    nome nem endereço: nome, cidade e CEP ficam de fora até a política mudar.
 *  - custom_data: o MESMO do pixel (metaPurchaseEvent: valor, BRL, códigos BF..., itens sensíveis não identificados).
 *  - Token só em META_CAPI_TOKEN (Vercel); sem ele, não envia. META_TEST_EVENT_CODE opcional (Eventos de teste).
 *  - Falha da Meta nunca atrapalha o pagamento (timeout curto, erro engolido) e nada pessoal vai para log.
 */

import { createHash } from "node:crypto";

import type { SqlRunner } from "@/lib/b2b/ownership";
import { metaPixelId, metaPurchaseEvent, type PurchasePayload } from "@/lib/measurement";
import { loadPurchasePayload } from "@/lib/purchase-event-server";

export const META_GRAPH_VERSION = "v21.0";
export const META_CAPI_TIMEOUT_MS = 3000;

/** O que o checkout guarda no pedido (commercial_adjustments_json.metaCapi), SÓ com aceite de marketing. */
export type MetaCapiCapture = { consent: true; fbp: string | null; fbc: string | null; ip: string | null; ua: string | null };

const clip = (value: string | null | undefined, max: number) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  for (const part of String(cookieHeader ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return clip(decodeURIComponent(rest.join("=")), 200);
  }

  return null;
}

/** Captura no checkout: sem aceite de marketing, null (nada é guardado nem enviado). */
export function captureMetaCapi(headers: Headers, marketingConsent: unknown): MetaCapiCapture | null {
  if (marketingConsent !== true) return null;

  const cookie = headers.get("cookie");
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0];

  return {
    consent: true,
    fbp: cookieValue(cookie, "_fbp"),
    fbc: cookieValue(cookie, "_fbc"),
    ip: clip(forwarded ?? headers.get("x-real-ip"), 64),
    ua: clip(headers.get("user-agent"), 400),
  };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** E-mail normalizado (minúsculas, sem espaços) em hash; vazio = não vai. */
export function hashEmail(email: string | null | undefined): string | null {
  const value = String(email ?? "").trim().toLowerCase();
  return value.includes("@") ? sha256(value) : null;
}

/** Telefone só com dígitos e o 55 do Brasil, em hash; curto demais = não vai. */
export function hashPhone(phone: string | null | undefined): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 ? sha256(digits) : null;
}

export function buildMetaCapiPurchaseBody(input: {
  payload: PurchasePayload;
  capture: MetaCapiCapture;
  email: string | null;
  phone: string | null;
  eventTimeSec: number;
  sourceUrl: string;
  testEventCode?: string | null;
}) {
  const event = metaPurchaseEvent(input.payload);
  const em = hashEmail(input.email);
  const ph = hashPhone(input.phone);

  return {
    data: [
      {
        event_name: event.name,
        event_time: input.eventTimeSec,
        event_id: event.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: {
          ...(em ? { em: [em] } : {}),
          ...(ph ? { ph: [ph] } : {}),
          ...(input.capture.ip ? { client_ip_address: input.capture.ip } : {}),
          ...(input.capture.ua ? { client_user_agent: input.capture.ua } : {}),
          ...(input.capture.fbp ? { fbp: input.capture.fbp } : {}),
          ...(input.capture.fbc ? { fbc: input.capture.fbc } : {}),
        },
        custom_data: event.params,
      },
    ],
    ...(input.testEventCode ? { test_event_code: input.testEventCode } : {}),
  };
}

function readCapture(adjustments: unknown): MetaCapiCapture | null {
  try {
    const parsed = typeof adjustments === "string" ? JSON.parse(adjustments) : adjustments;
    const capi = parsed && typeof parsed === "object" ? (parsed as { metaCapi?: MetaCapiCapture }).metaCapi : null;

    return capi && capi.consent === true ? capi : null;
  } catch {
    return null;
  }
}

/**
 * Envia o Purchase do pedido pelo servidor. Devolve o motivo de não ter enviado (para teste), nunca lança.
 * Só B2C (sem oferta B2B), pedido pago (loadPurchasePayload) e com aceite de marketing registrado.
 */
export async function sendMetaCapiPurchase(
  run: SqlRunner,
  orderId: string,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    now?: Date;
    siteUrl?: string;
    /** Pedido pago (padrão: loadPurchasePayload); injetável no teste. */
    loadPayload?: (orderId: string) => Promise<PurchasePayload | null>;
  } = {}
): Promise<"sent" | "no_token" | "no_pixel" | "not_b2c" | "no_consent" | "not_paid" | "failed"> {
  const env = options.env ?? process.env;
  const token = env.META_CAPI_TOKEN?.trim();
  const pixel = metaPixelId(env.NEXT_PUBLIC_META_PIXEL_ID);

  if (!token) return "no_token";
  if (!pixel) return "no_pixel";

  try {
    const [row] = await run(
      `SELECT o.b2b_offer_id, to_jsonb(o) ->> 'commercial_adjustments_json' AS adjustments, c.email, c.phone
         FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.id = $1::uuid LIMIT 1`,
      [orderId]
    );

    if (!row || row.b2b_offer_id) return "not_b2c";

    const capture = readCapture(row.adjustments);
    if (!capture) return "no_consent";

    const payload = await (options.loadPayload ?? ((id: string) => loadPurchasePayload(run, id)))(orderId);
    if (!payload) return "not_paid";

    const body = buildMetaCapiPurchaseBody({
      payload,
      capture,
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      eventTimeSec: Math.floor((options.now ?? new Date()).getTime() / 1000),
      sourceUrl: `${(options.siteUrl ?? "https://www.bioflorais.com.br").replace(/\/+$/, "")}/checkout`,
      testEventCode: env.META_TEST_EVENT_CODE?.trim() || null,
    });

    const response = await (options.fetchImpl ?? fetch)(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(META_CAPI_TIMEOUT_MS) }
    );

    // log sem dado pessoal: só o pedido e o código HTTP
    if (!response.ok) console.error("[meta-capi] Purchase não aceito", { orderId, status: response.status });

    return response.ok ? "sent" : "failed";
  } catch {
    console.error("[meta-capi] Purchase não enviado", { orderId });
    return "failed";
  }
}
