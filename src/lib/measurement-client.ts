/**
 * Lado do navegador da medição Google/Meta: instalação dos scripts e disparo de eventos. Nunca chamar no servidor.
 * Nada é carregado sem o ID (variável de ambiente); o pixel da Meta só carrega com aceite de marketing.
 */

import { hasMarketingConsent } from "@/lib/consent";
import { isMetaPixelPath } from "@/lib/meta-privacy";

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** Define o `gtag` (fila em dataLayer): a função precisa empilhar `arguments`, como pede o Google. */
export function ensureGtagStub(): Gtag {
  window.dataLayer = window.dataLayer ?? [];

  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }

  return window.gtag;
}

export function loadScript(src: string): void {
  if (document.querySelector(`script[src="${src}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Instala o pixel da Meta (snippet padrão). Chamar só com aceite de marketing. */
export function installMetaPixel(pixelId: string): void {
  if (window.fbq) return;

  function fbqStub() {
    // eslint-disable-next-line prefer-rest-params
    const args = arguments as unknown as unknown[];
    const self = fbqStub as unknown as Fbq;

    if (self.callMethod) self.callMethod(...args);
    else self.queue!.push(args);
  }

  const fbq = fbqStub as unknown as Fbq;

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  // Privacidade (decisão do Luis 05/11): sem leitura automática da página (autoConfig lê dados estruturados, como nome e
  // categoria do produto, e cliques) e sem PageView automático nas trocas de página: o PageView sai do MetaPixel.tsx,
  // que bloqueia as páginas de produto sensível.
  (fbq as unknown as { disablePushState?: boolean }).disablePushState = true;
  loadScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("set", "autoConfig", false, pixelId);
  window.fbq("init", pixelId);
}

function marketingAllowed(): boolean {
  try {
    return hasMarketingConsent(window.localStorage);
  } catch {
    return false;
  }
}

/** Evento do Google (gtag): vale mesmo com o consentimento negado (o Consent Mode decide o que o Google guarda). */
export function trackGoogle(name: string, params: Record<string, unknown>): boolean {
  if (typeof window === "undefined" || !window.gtag) return false;

  window.gtag("event", name, params);

  return true;
}

/** Evento da Meta: só se o pixel foi carregado E o aceite de marketing continua valendo. `eventId` deduplica com a API de Conversões. */
export function trackMeta(name: string, params: Record<string, unknown>, eventId?: string): boolean {
  if (typeof window === "undefined" || !window.fbq || !marketingAllowed()) return false;
  // Página de produto sensível: nenhum evento da Meta (nem de outro produto adicionado nela).
  if (!isMetaPixelPath(window.location.pathname)) return false;

  if (eventId) window.fbq("track", name, params, { eventID: eventId });
  else window.fbq("track", name, params);

  return true;
}

/** Id do evento para deduplicar pixel × servidor (aleatório; nunca dado do visitante). */
function newMetaEventId(): string {
  try {
    return window.crypto.randomUUID();
  } catch {
    return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * ViewContent, AddToCart e InitiateCheckout (fase 2 da Meta, 16/11): dispara o pixel com um event_id e, SÓ se o pixel disparou
 * (aceite de marketing + página permitida), manda o mesmo evento para /api/meta/events (API de Conversões). O envio ao servidor
 * é "dispara e esquece" (keepalive, erro engolido): nunca atrasa nem quebra a sacola ou o checkout.
 */
export function trackMetaWithServer(name: "ViewContent" | "AddToCart" | "InitiateCheckout", params: Record<string, unknown>): boolean {
  const eventId = newMetaEventId();

  if (!trackMeta(name, params, eventId)) return false;

  try {
    void fetch("/api/meta/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: name, eventId, params, pageUrl: window.location.href, consent: true }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // sem rede/fetch: o pixel já foi
  }

  return true;
}
