/**
 * Custom Events do Vercel Analytics (Rodada 18): chegada, ver_produto, sacola e checkout, sempre com DUAS propriedades
 * no máximo — origem ("utm_source / utm_medium" do cookie bio_origem; sem utm usa o domínio do referrer; "direto" se vazio)
 * e campanha (utm_campaign). Nada de dado pessoal: só o que o cookie de origem guarda (campanha + domínio).
 * Funções puras (testáveis sem navegador); o envio fica em trackEvent, que nunca quebra a página.
 */

import { readAttributionCookie } from "@/lib/attribution";

export const ANALYTICS_EVENTS = ["chegada", "ver_produto", "sacola", "checkout"] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type EventProps = { origem: string; campanha: string };

/** Propriedades do evento a partir do cookie (document.cookie ou cabeçalho). Sem origem = direto / nenhuma. */
export function eventProps(cookieString: string | null | undefined): EventProps {
  const attribution = readAttributionCookie(cookieString);

  if (!attribution) return { origem: "direto", campanha: "nenhuma" };

  const source = attribution.utm_source ?? attribution.referrer_domain ?? "direto";
  const origem = attribution.utm_medium ? `${source} / ${attribution.utm_medium}` : source;

  return { origem, campanha: attribution.utm_campaign ?? "nenhuma" };
}

/** Qual evento de página uma rota dispara (sacola é disparado ao adicionar item). */
export function pageEventFor(pathname: string | null | undefined): AnalyticsEventName | null {
  const path = String(pathname ?? "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

  if (path.startsWith("/produto/") && path.split("/").length === 3) return "ver_produto";
  if (path === "/checkout" || path === "/b2b/checkout") return "checkout";

  return null;
}

/** Envia o evento (client). Falha silenciosa: bloqueador de anúncios ou ambiente sem Analytics não quebram nada. */
export async function trackEvent(name: AnalyticsEventName, cookieString?: string | null): Promise<void> {
  try {
    const { track } = await import("@vercel/analytics");
    const cookie = cookieString ?? (typeof document !== "undefined" ? document.cookie : "");

    track(name, eventProps(cookie));
  } catch {
    // sem Analytics: segue sem medir
  }
}
