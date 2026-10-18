/**
 * Medição do ChatGPT Ads — IMAGE TAG (pedido técnico v3). Substitui o Pixel JS: nada de SDK, sem correspondência
 * avançada, sem objeto `user`, sem script de terceiros. Só um <img> 1x1 no pedido PAGO.
 *
 *  - O clique no anúncio chega com ?oppref=… . Com consentimento de MARKETING guardamos o valor no cookie próprio
 *    `bio_oppref` (first-party, SameSite=Lax, Secure, 30 dias). Sem consentimento não gravamos nada; ao retirar, apagamos.
 *  - O consentimento pode vir depois (banner na mesma visita): o oppref da página de entrada fica em memória
 *    (sessionStorage) até a decisão; recusou = descarta.
 *  - A query string nunca é reescrita.
 * Funções puras + controlador com ambiente injetado (testável sem navegador).
 */

import { readConsent } from "@/lib/consent";

export const ADS_PIXEL_ID = "C43h1qwNBKW7o7E9hgXwh9";
export const ADS_TAG_ENDPOINT = "https://bzr.openai.com/v1/sdk/events";
export const OPPREF_COOKIE = "bio_oppref";
export const OPPREF_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const OPPREF_PENDING_KEY = "bio_oppref_pending";
const OPPREF_MAX_LENGTH = 512;

/** Páginas onde a captura/o banner funcionam: B2C e páginas do lojista; nunca /admin, área do vendedor ou /api. */
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

/** Valor do oppref da query (exatamente como veio). null = ausente ou inválido (vazio, enorme ou com controle). */
export function parseOppref(search: string | null | undefined): string | null {
  try {
    const value = new URLSearchParams(String(search ?? "")).get("oppref");
    if (value === null) return null;
    const trimmed = value.trim();
    // eslint-disable-next-line no-control-regex
    if (!trimmed || trimmed.length > OPPREF_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function buildOppRefCookie(value: string, secure: boolean): string {
  return `${OPPREF_COOKIE}=${encodeURIComponent(value)}; Max-Age=${OPPREF_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function buildOppRefDeleteCookie(secure: boolean): string {
  return `${OPPREF_COOKIE}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Lê o oppref do cookie (valor codificado -> como veio). Aceita o header Cookie inteiro ou só o valor. */
export function readOppRefCookie(cookieHeaderOrValue: string | null | undefined, isHeader = true): string | null {
  const raw = isHeader
    ? String(cookieHeaderOrValue ?? "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${OPPREF_COOKIE}=`))
        ?.slice(OPPREF_COOKIE.length + 1)
    : cookieHeaderOrValue;

  if (!raw) return null;

  try {
    const value = decodeURIComponent(raw);
    return value && value.length <= OPPREF_MAX_LENGTH ? value : null;
  } catch {
    return null;
  }
}

/**
 * URL da Image Tag do evento "Compra". Só o que a plataforma aceita: pid, event, event_id (UUID aleatório, NUNCA o
 * número do pedido), oppref (omitido se não houver), data[type], data[amount] (centavos inteiros) e data[currency].
 * Tudo URL-encoded; sem produtos, sem dado pessoal.
 */
export function buildAdsTagUrl(input: { eventId: string; amountCents: number; oppref?: string | null }): string | null {
  const amount = Math.round(Number(input.amountCents));

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.eventId) || !Number.isInteger(amount) || amount <= 0) {
    return null;
  }

  const parts = [
    `pid=${encodeURIComponent(ADS_PIXEL_ID)}`,
    "event=order_created",
    `event_id=${encodeURIComponent(input.eventId)}`,
  ];

  if (input.oppref) parts.push(`oppref=${encodeURIComponent(input.oppref)}`);

  parts.push("data[type]=contents", `data[amount]=${amount}`, "data[currency]=BRL");

  return `${ADS_TAG_ENDPOINT}?${parts.join("&")}`;
}

// ---------------------------------------------------------------------------
// Captura do oppref (navegador, com ambiente injetado)
// ---------------------------------------------------------------------------

type StorageLike = Pick<Storage, "getItem" | "setItem"> & { removeItem?: (key: string) => void };

export type OppRefEnv = {
  /** window.location.search da página atual. */
  search: string;
  storage: StorageLike | null;
  session: StorageLike | null;
  /** document (só o setter de cookie é usado). */
  doc: { cookie: string };
  secure: boolean;
};

function dropPending(env: OppRefEnv) {
  try {
    env.session?.removeItem?.(OPPREF_PENDING_KEY);
  } catch {
    // sem sessionStorage
  }
}

/**
 * Chamada ao abrir/navegar qualquer página permitida e a cada mudança de consentimento.
 *  - com marketing aceito: grava o cookie (oppref da URL; renova os 30 dias) e aplica o que estava pendente;
 *  - sem escolha ainda: guarda o oppref da URL só na sessão, até a decisão;
 *  - recusado: não grava nada, descarta o pendente e apaga o cookie.
 */
export function syncOppref(env: OppRefEnv, consentChoice: "granted" | "denied" | "undecided"): "cookie-set" | "pending" | "cleared" | "none" {
  const fromUrl = parseOppref(env.search);

  if (consentChoice === "granted") {
    let pending: string | null = null;

    try {
      pending = env.session?.getItem(OPPREF_PENDING_KEY) ?? null;
    } catch {
      pending = null;
    }

    const value = fromUrl ?? (pending && pending.length <= OPPREF_MAX_LENGTH ? pending : null);
    dropPending(env);

    if (!value) return "none";
    env.doc.cookie = buildOppRefCookie(value, env.secure);
    return "cookie-set";
  }

  if (consentChoice === "undecided") {
    if (!fromUrl) return "none";
    try {
      env.session?.setItem(OPPREF_PENDING_KEY, fromUrl);
    } catch {
      // sem sessionStorage: sem captura tardia
    }
    return "pending";
  }

  dropPending(env);
  env.doc.cookie = buildOppRefDeleteCookie(env.secure);
  return "cleared";
}

/** Escolha de cookies de marketing salva no navegador: aceitou, recusou ou ainda não escolheu. */
export function consentChoiceOf(storage: Pick<Storage, "getItem" | "setItem"> | null | undefined): "granted" | "denied" | "undecided" {
  const choice = readConsent(storage);
  return choice === null ? "undecided" : choice.marketing ? "granted" : "denied";
}
