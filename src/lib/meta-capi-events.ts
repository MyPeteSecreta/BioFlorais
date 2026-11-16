/**
 * API DE CONVERSÕES DA META, fase 2 (mestre, 16/11): ViewContent, AddToCart e InitiateCheckout também saem pelo SERVIDOR,
 * com o MESMO event_id do pixel do navegador (a Meta deduplica). O Purchase já sai pelo servidor desde 10/11 (meta-capi.ts).
 *  - Mesma base legal do pixel: o navegador só chama /api/meta/events depois que o pixel disparou (trackMeta: aceite de
 *    marketing + página permitida); o servidor exige consent=true e confere de novo a página (produto sensível: nada).
 *  - custom_data: SÓ o que o pixel manda (códigos neutros BF…, valor, BRL, quantidade). Tudo é refeito aqui por lista branca:
 *    código que não existe ou é de produto sensível cai fora; nunca nome, slug nem categoria.
 *  - user_data: só os cookies _fbp/_fbc (ou o fbclid do endereço da página, que vira fbc e não é guardado), IP e navegador.
 *    Nada de e-mail, telefone, nome ou endereço nestes eventos (o visitante ainda não se identificou).
 *  - Sem META_CAPI_TOKEN: não envia e registra "não configurado" uma vez por instância. Nunca lança, nunca atrapalha a página.
 * Funções puras (testáveis); o envio fica na rota /api/meta/events.
 */

import { isMetaPixelPath, isMetaSensitiveProductSlug } from "@/lib/meta-privacy";
import { META_CONTENT_IDS } from "@/lib/feeds/meta-content-ids";

export const META_CAPI_BROWSER_EVENTS = ["ViewContent", "AddToCart", "InitiateCheckout"] as const;
export type MetaCapiBrowserEvent = (typeof META_CAPI_BROWSER_EVENTS)[number];

/** Códigos que podem ir à Meta: os do catálogo, menos os de produto sensível (a mesma regra do pixel). */
const ALLOWED_CONTENT_IDS = new Set(
  Object.entries(META_CONTENT_IDS)
    .filter(([slug]) => !isMetaSensitiveProductSlug(slug))
    .map(([, id]) => id)
);

export const isAllowedMetaContentId = (id: unknown): id is string => typeof id === "string" && ALLOWED_CONTENT_IDS.has(id);

const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;

const money = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000 ? Math.round(value * 100) / 100 : null;

const qty = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 999 ? value : null);

/** Endereço da página: só o caminho do NOSSO site, sem query nem âncora (os endereços vão sem códigos pessoais). */
export function safeSourceUrl(pageUrl: unknown, siteUrl: string): { url: string; pathname: string } | null {
  try {
    const base = new URL(siteUrl);
    const page = new URL(String(pageUrl ?? ""), base);

    if (page.host !== base.host) return null;

    return { url: `${base.origin}${page.pathname}`, pathname: page.pathname };
  } catch {
    return null;
  }
}

/** fbc a partir do fbclid do endereço da página (formato da Meta: fb.1.<ms>.<fbclid>); só é usado quando falta o cookie _fbc. */
export function fbcFromPageUrl(pageUrl: unknown, nowMs: number): string | null {
  try {
    const fbclid = new URL(String(pageUrl ?? "")).searchParams.get("fbclid")?.trim();

    return fbclid && /^[A-Za-z0-9_-]{10,500}$/.test(fbclid) ? `fb.1.${nowMs}.${fbclid}` : null;
  } catch {
    return null;
  }
}

/** custom_data refeito por lista branca (o que vier do navegador e não estiver aqui é descartado). null = nada a enviar. */
export function sanitizeMetaCustomData(name: MetaCapiBrowserEvent, raw: unknown): Record<string, unknown> | null {
  const params = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = Array.isArray(params.content_ids) ? [...new Set(params.content_ids.filter(isAllowedMetaContentId))].slice(0, 50) : [];
  const value = money(params.value);
  const numItems = qty(params.num_items);

  // ViewContent e AddToCart: sempre de UM produto identificável (o pixel não manda produto sensível).
  if (name !== "InitiateCheckout") {
    if (ids.length !== 1) return null;

    return {
      content_type: "product",
      content_ids: ids,
      currency: "BRL",
      ...(name === "ViewContent" && value !== null ? { value } : {}),
    };
  }

  // InitiateCheckout: valor, moeda e quantidade sempre; itens só os identificáveis.
  if (value === null) return null;

  return {
    value,
    currency: "BRL",
    ...(ids.length ? { content_type: "product", content_ids: ids } : {}),
    ...(numItems !== null ? { num_items: numItems } : {}),
  };
}

export type MetaCapiBrowserRequest = {
  event: unknown;
  eventId: unknown;
  params: unknown;
  pageUrl: unknown;
  consent: unknown;
};

export type MetaCapiRequestContext = { fbp: string | null; fbc: string | null; ip: string | null; ua: string | null };

/**
 * Monta o corpo do /{pixel}/events a partir do pedido do navegador. Devolve o motivo quando não há o que enviar
 * (sem aceite, evento desconhecido, página não permitida, item sensível…).
 */
export function buildMetaCapiBrowserEventBody(
  input: MetaCapiBrowserRequest,
  context: MetaCapiRequestContext,
  options: { siteUrl: string; nowMs: number; testEventCode?: string | null }
): { ok: true; body: Record<string, unknown> } | { ok: false; reason: "no_consent" | "bad_event" | "bad_page" | "nothing_to_send" } {
  if (input.consent !== true) return { ok: false, reason: "no_consent" };

  const name = META_CAPI_BROWSER_EVENTS.find((event) => event === input.event);
  if (!name || typeof input.eventId !== "string" || !EVENT_ID.test(input.eventId)) return { ok: false, reason: "bad_event" };

  const source = safeSourceUrl(input.pageUrl, options.siteUrl);
  if (!source || !isMetaPixelPath(source.pathname)) return { ok: false, reason: "bad_page" };

  const customData = sanitizeMetaCustomData(name, input.params);
  if (!customData) return { ok: false, reason: "nothing_to_send" };

  const fbc = context.fbc ?? fbcFromPageUrl(input.pageUrl, options.nowMs);

  return {
    ok: true,
    body: {
      data: [
        {
          event_name: name,
          event_time: Math.floor(options.nowMs / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: source.url,
          user_data: {
            ...(context.ip ? { client_ip_address: context.ip } : {}),
            ...(context.ua ? { client_user_agent: context.ua } : {}),
            ...(context.fbp ? { fbp: context.fbp } : {}),
            ...(fbc ? { fbc } : {}),
          },
          custom_data: customData,
        },
      ],
      ...(options.testEventCode ? { test_event_code: options.testEventCode } : {}),
    },
  };
}

let warnedNoToken = false;

/** Registra uma vez por instância que a API de Conversões está desligada (sem token). */
export function logMetaCapiNotConfigured(): void {
  if (warnedNoToken) return;
  warnedNoToken = true;
  console.info("[meta-capi] não configurado (sem META_CAPI_TOKEN): eventos do servidor desligados; o pixel segue normal");
}
