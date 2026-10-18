/**
 * Pixel do ChatGPT Ads (OpenAI) — Bio Florais. Pedido técnico PEDIDO_TECNICO_PIXEL_BIO.md.
 *
 * Regras:
 *  - SÓ com consentimento de marketing: sem aceite o script nem é injetado. oaiq("consent", false) antes do init;
 *    aceite -> oaiq("consent", true); retirada -> oaiq("consent", false) (a OpenAI apaga __oppref/__obref).
 *  - SEM dado pessoal: nenhum objeto `user`, nenhum *_sha256. Todo measure leva opt_out: true.
 *  - Evento "Compra" = order_created, UMA vez por pedido PAGO, amount em centavos inteiros, event_id b2c_/b2b_.
 *  - Nunca em /admin, área do vendedor (/b2b/painel, /b2b/login...) e páginas internas.
 * O controlador recebe o ambiente (window/document/storage) por parâmetro para ser testável sem navegador.
 */

import { hasMarketingConsent } from "@/lib/consent";

export const PIXEL_ID = "C43h1qwNBKW7o7E9hgXwh9";
export const PIXEL_SCRIPT_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
export const PIXEL_COOKIES = ["__oppref", "__obref"] as const;
const SENT_PREFIX = "oaiq:sent:";

/** Páginas B2B onde o pixel pode rodar (as do lojista). O resto de /b2b (painel, login, convite, demo) é interno. */
const B2B_PUBLIC = ["/b2b/oferta", "/b2b/carrinho", "/b2b/checkout", "/b2b/pagar"];

export function isPixelPath(pathname: string | null | undefined): boolean {
  const path = String(pathname ?? "/").split("?")[0].split("#")[0];

  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (path === "/api" || path.startsWith("/api/")) return false;

  if (path === "/b2b" || path.startsWith("/b2b/")) {
    return B2B_PUBLIC.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  return true;
}

type Oaiq = ((...args: unknown[]) => void) & { q?: unknown[][] };

export type PixelEnv = {
  win: { oaiq?: Oaiq } & Record<string, unknown>;
  doc: {
    createElement: (tag: string) => { async?: boolean; src?: string; setAttribute?: (name: string, value: string) => void };
    head: { appendChild: (node: unknown) => unknown };
    cookie?: string;
  };
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  /** Domínio atual, para apagar os cookies (defensivo; a OpenAI também apaga ao receber consent false). */
  hostname?: string;
};

export type PixelContent = { id: string; name: string; content_type: "product"; quantity: number };

export type PurchaseEvent = {
  eventId: string;
  /** Total PAGO em centavos (inteiro). */
  amountCents: number;
  contents: Array<{ id: string; name: string; quantity: number }>;
};

type State = { scriptInjected: boolean; initialized: boolean; granted: boolean };
const states = new WeakMap<object, State>();

function stateOf(env: PixelEnv): State {
  let state = states.get(env.win);
  if (!state) {
    state = { scriptInjected: false, initialized: false, granted: false };
    states.set(env.win, state);
  }
  return state;
}

function stub(env: PixelEnv): Oaiq {
  if (env.win.oaiq) return env.win.oaiq;
  const q = ((...args: unknown[]) => {
    q.q!.push(args);
  }) as Oaiq;
  q.q = [];
  env.win.oaiq = q;
  return q;
}

/** Apaga __oppref e __obref (defensivo: expira no domínio atual e no domínio pai). */
export function clearPixelCookies(env: PixelEnv) {
  if (!env.doc || env.doc.cookie === undefined) return;
  const hosts = new Set<string>([""]);

  if (env.hostname) {
    hosts.add(env.hostname);
    // Todos os domínios pais (www.site.com.br, site.com.br): o cookie pode ter sido gravado em qualquer um.
    const parts = env.hostname.split(".");
    for (let i = 1; i < parts.length - 1; i += 1) hosts.add(parts.slice(i).join("."));
  }

  for (const name of PIXEL_COOKIES) {
    for (const host of hosts) {
      env.doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${host ? `; domain=${host}` : ""}`;
    }
  }
}

/** Visitante ACEITOU marketing: injeta (uma vez), consent false -> init -> consent true. */
export function enablePixel(env: PixelEnv): boolean {
  if (!hasMarketingConsent(env.storage)) return false;

  const state = stateOf(env);
  const oaiq = stub(env);

  if (!state.initialized) {
    oaiq("consent", false); // por segurança, antes do init
    oaiq("init", { pixelId: PIXEL_ID }); // sem `user`: nada de e-mail/telefone/hash
    state.initialized = true;
  }

  if (!state.scriptInjected) {
    const script = env.doc.createElement("script");
    script.async = true;
    script.src = PIXEL_SCRIPT_URL;
    env.doc.head.appendChild(script);
    state.scriptInjected = true;
  }

  oaiq("consent", true);
  state.granted = true;
  return true;
}

/** Retirada do consentimento (ou página interna): consent false, que apaga os cookies e para os eventos. */
export function disablePixel(env: PixelEnv) {
  const state = stateOf(env);

  if (env.win.oaiq && (state.initialized || state.scriptInjected)) {
    env.win.oaiq("consent", false);
  }

  state.granted = false;
  clearPixelCookies(env);
}

/** Corpo do evento "Compra" — só campos documentados. */
export function buildOrderCreatedArgs(event: PurchaseEvent): [string, string, Record<string, unknown>, Record<string, unknown>] {
  const amount = Math.round(Number(event.amountCents));
  const contents: PixelContent[] = event.contents
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({ id: String(item.id), name: String(item.name), content_type: "product", quantity: Math.round(Number(item.quantity)) }));

  return [
    "measure",
    "order_created",
    { type: "contents", amount, currency: "BRL", contents },
    { event_id: event.eventId, opt_out: true },
  ];
}

/** Já enviamos este pedido? (não repete ao recarregar) */
export function wasPurchaseSent(env: PixelEnv, eventId: string): boolean {
  try {
    return env.storage?.getItem(`${SENT_PREFIX}${eventId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Envia order_created UMA vez. Só envia se o pixel está ativo (consentimento de marketing) e o pedido ainda não foi
 * enviado; só marca como enviado quando realmente enviou (sem consentimento nada é enviado nem marcado).
 */
export function trackPurchaseOnce(env: PixelEnv, event: PurchaseEvent): "sent" | "duplicate" | "no-consent" | "invalid" {
  if (!event.eventId || !Number.isFinite(event.amountCents) || event.amountCents <= 0) return "invalid";
  if (!hasMarketingConsent(env.storage) || !stateOf(env).granted || !env.win.oaiq) return "no-consent";
  if (wasPurchaseSent(env, event.eventId)) return "duplicate";

  env.win.oaiq(...buildOrderCreatedArgs(event));

  try {
    env.storage?.setItem(`${SENT_PREFIX}${event.eventId}`, "1");
  } catch {
    // sem armazenamento: o event_id também deduplica do lado da plataforma
  }

  return "sent";
}

export const purchaseEventId = (orderId: string, isB2B: boolean) => `${isB2B ? "b2b" : "b2c"}_${orderId}`;
