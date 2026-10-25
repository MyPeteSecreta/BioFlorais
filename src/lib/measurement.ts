/**
 * Medição para Google e Meta (só código; os IDs vêm de variáveis de ambiente, nada de chave no repositório).
 *
 *  - Google tag (gtag) com Consent Mode v2: tudo começa NEGADO e só passa a "concedido" depois do aceite do banner. Eventos:
 *    page_view e purchase (valor em BRL e id do pedido, sem dado pessoal).
 *  - Pixel da Meta: só carrega depois do aceite de marketing. Eventos: PageView, ViewContent, AddToCart, InitiateCheckout e
 *    Purchase (event_id = id do pedido, para deduplicar com a API de Conversões no futuro).
 *  - Nada roda no /admin, na área do vendedor nem em /api (mesma regra do banner: `isPixelPath`).
 * Funções puras (testáveis sem navegador). O carregamento dos scripts fica em src/components/measurement.
 */

import { sanitizeAnalyticsUrl } from "@/lib/analytics-url";
import type { ConsentChoice } from "@/lib/consent";

export const CURRENCY = "BRL";

/** IDs públicos (visíveis no navegador por natureza). Vazio/ausente = a medição daquele serviço fica desligada. */
export function googleTagIds(raw: string | null | undefined = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID): string[] {
  return String(raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^(G|AW|GT)-[A-Z0-9]+$/i.test(value));
}

export function metaPixelId(raw: string | null | undefined = process.env.NEXT_PUBLIC_META_PIXEL_ID): string | null {
  const value = String(raw ?? "").trim();
  return /^\d{8,20}$/.test(value) ? value : null;
}

export type GoogleConsentState = {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
};

/** Padrão do Consent Mode v2: TUDO negado até o aceite. */
export const GOOGLE_CONSENT_DEFAULT: GoogleConsentState = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
};

/**
 * Escolha do banner -> sinais do Consent Mode v2. Marketing controla ad_storage, ad_user_data e ad_personalization.
 * analytics_storage tem o seu próprio campo (`analytics`); o banner atual só tem o interruptor de Marketing (a "Análise" do
 * banner é a medição da Vercel, sem cookies), então, sem campo próprio, ele acompanha o aceite.
 */
export function googleConsentFromChoice(choice: Pick<ConsentChoice, "marketing"> & { analytics?: boolean } | null | undefined): GoogleConsentState {
  if (!choice) return { ...GOOGLE_CONSENT_DEFAULT };

  const marketing = choice.marketing === true;
  const analytics = typeof choice.analytics === "boolean" ? choice.analytics : marketing;

  return {
    ad_storage: marketing ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied",
    analytics_storage: analytics ? "granted" : "denied",
  };
}

/** Endereço da página sem tokens (ofertas, pedidos, links pessoais) antes de ir para o Google/Meta. */
export function safePageLocation(href: string): string {
  return sanitizeAnalyticsUrl(href);
}

export type PurchaseItem = { id: string; quantity: number; priceCents: number };

export type PurchasePayload = {
  orderId: string;
  valueCents: number;
  items: PurchaseItem[];
};

const toValue = (cents: number) => Math.round(Number(cents)) / 100;

/** Evento "purchase" do Google: valor em BRL, transaction_id = id do pedido (o GA4 não conta o mesmo id duas vezes). Sem dado pessoal. */
export function googlePurchaseEvent(order: PurchasePayload) {
  return {
    name: "purchase" as const,
    params: {
      transaction_id: order.orderId,
      value: toValue(order.valueCents),
      currency: CURRENCY,
      items: order.items.map((item) => ({ item_id: item.id, quantity: item.quantity, price: toValue(item.priceCents) })),
    },
  };
}

/** Purchase da Meta: event_id = id do pedido (deduplica com a API de Conversões no futuro). */
export function metaPurchaseEvent(order: PurchasePayload) {
  return {
    name: "Purchase" as const,
    params: {
      value: toValue(order.valueCents),
      currency: CURRENCY,
      content_type: "product",
      content_ids: order.items.map((item) => item.id),
      contents: order.items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: toValue(item.priceCents) })),
      num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
    },
    eventId: order.orderId,
  };
}

export function metaViewContentEvent(product: { slug: string; name: string; priceCents: number | null }) {
  return {
    name: "ViewContent" as const,
    params: {
      content_type: "product",
      content_ids: [product.slug],
      content_name: product.name,
      ...(product.priceCents ? { value: toValue(product.priceCents), currency: CURRENCY } : {}),
    },
  };
}

export function metaAddToCartEvent(productSlug: string) {
  return { name: "AddToCart" as const, params: { content_type: "product", content_ids: [productSlug], currency: CURRENCY } };
}

export function metaInitiateCheckoutEvent(cart: { valueCents: number; items: Array<{ slug: string; qty: number }> }) {
  return {
    name: "InitiateCheckout" as const,
    params: {
      value: toValue(cart.valueCents),
      currency: CURRENCY,
      content_type: "product",
      content_ids: cart.items.map((item) => item.slug),
      num_items: cart.items.reduce((sum, item) => sum + item.qty, 0),
    },
  };
}

/** Chave para não repetir o evento de compra no mesmo navegador (um por pedido e por serviço). */
export const purchaseSentKey = (service: "google" | "meta", orderId: string) => `bio_purchase_${service}_${orderId}`;
