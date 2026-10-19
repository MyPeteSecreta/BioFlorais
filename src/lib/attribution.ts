/**
 * Origem da venda (Rodada 17): na primeira visita guardamos, num cookie próprio (bio_origem, first-party, SameSite=Lax,
 * 30 dias), só utm_source, utm_medium, utm_campaign e o DOMÍNIO do referrer (ex.: google.com, instagram.com). Nenhum dado
 * pessoal, nenhum terceiro, nenhum identificador do visitante. Na criação do pedido o servidor grava esses 4 campos no
 * pedido (orders.utm_source/utm_medium/utm_campaign/referrer_domain). É dado de atribuição, não de marketing: não depende
 * do aceite de marketing (a política de cookies descreve o cookie como "análise de origem").
 *
 * First-touch: a primeira visita COM informação (utm ou referrer externo) fixa a origem por 30 dias. Uma visita direta
 * (sem nada) não fixa nada: não é informação e não pode "travar" a origem verdadeira de uma visita seguinte.
 * Funções puras + controlador com ambiente injetado (testável sem navegador).
 */

export const ATTRIBUTION_COOKIE = "bio_origem";
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const FIELD_MAX_LENGTH = 100;

export type Attribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_domain: string | null;
};

export const EMPTY_ATTRIBUTION: Attribution = { utm_source: null, utm_medium: null, utm_campaign: null, referrer_domain: null };

/** Texto curto e seguro: sem controle/aspas/barras, no máximo 100 caracteres; vazio vira null. */
export function cleanField(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>"'`\\]/g, "")
    .trim()
    .slice(0, FIELD_MAX_LENGTH);

  return text || null;
}

export function hasAttribution(attribution: Attribution | null | undefined): boolean {
  return Boolean(attribution && (attribution.utm_source || attribution.utm_medium || attribution.utm_campaign || attribution.referrer_domain));
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

/** Só o domínio do referrer (sem caminho nem query); null se vazio, inválido ou do próprio site. */
export function referrerDomain(referrer: string | null | undefined, ownHostname?: string | null): string | null {
  const raw = String(referrer ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const host = bareHost(url.hostname);
    if (!host) return null;
    if (ownHostname && host === bareHost(ownHostname)) return null;

    return cleanField(host);
  } catch {
    return null;
  }
}

/** Lê utm_* da query (sem alterar a URL) e o domínio do referrer. */
export function parseAttribution(search: string | null | undefined, referrer: string | null | undefined, ownHostname?: string | null): Attribution {
  let params: URLSearchParams;

  try {
    params = new URLSearchParams(String(search ?? ""));
  } catch {
    params = new URLSearchParams();
  }

  return {
    utm_source: cleanField(params.get("utm_source")),
    utm_medium: cleanField(params.get("utm_medium")),
    utm_campaign: cleanField(params.get("utm_campaign")),
    referrer_domain: referrerDomain(referrer, ownHostname),
  };
}

export function buildAttributionCookie(attribution: Attribution, secure: boolean): string {
  const value = encodeURIComponent(
    JSON.stringify({ s: attribution.utm_source, m: attribution.utm_medium, c: attribution.utm_campaign, r: attribution.referrer_domain })
  );

  return `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Lê o cookie (valor puro ou cabeçalho Cookie inteiro). Inválido/ausente = null. */
export function readAttributionCookie(cookieHeaderOrValue: string | null | undefined, isHeader = true): Attribution | null {
  let value = String(cookieHeaderOrValue ?? "");

  if (isHeader) {
    const match = value.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`));
    if (!match) return null;
    value = match.slice(ATTRIBUTION_COOKIE.length + 1);
  }

  if (!value || value.length > 800) return null;

  try {
    const data = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;

    const attribution: Attribution = {
      utm_source: cleanField(data.s),
      utm_medium: cleanField(data.m),
      utm_campaign: cleanField(data.c),
      referrer_domain: cleanField(data.r),
    };

    return hasAttribution(attribution) ? attribution : null;
  } catch {
    return null;
  }
}

export type AttributionEnv = {
  search: string;
  referrer: string;
  hostname: string;
  doc: { cookie: string };
  secure: boolean;
};

/**
 * Captura first-touch: grava o cookie só se ainda não há origem salva e a visita traz informação.
 * "kept" = já havia origem; "set" = gravou; "none" = visita direta (nada a guardar).
 */
export function captureAttribution(env: AttributionEnv): "kept" | "set" | "none" {
  if (readAttributionCookie(env.doc.cookie)) return "kept";

  const attribution = parseAttribution(env.search, env.referrer, env.hostname);
  if (!hasAttribution(attribution)) return "none";

  env.doc.cookie = buildAttributionCookie(attribution, env.secure);

  return "set";
}

/** "instagram / organic / 2110_rotina" (campos ausentes viram "—"); sem nada = "Direto". */
export function formatOrigin(attribution: Attribution | null | undefined): string {
  if (!attribution || !hasAttribution(attribution)) return "Direto";

  const source = attribution.utm_source ?? attribution.referrer_domain ?? "—";

  return `${source} / ${attribution.utm_medium ?? "—"} / ${attribution.utm_campaign ?? "—"}`;
}
