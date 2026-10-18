"use client";

/**
 * Evento "Compra" (order_created) do pixel: UMA vez por pedido PAGO, na confirmação/acompanhamento. Pergunta ao servidor
 * (só devolve se o pedido está pago) e envia com o consentimento de marketing; marca como enviado para não repetir ao
 * recarregar. Sem consentimento, nada é enviado nem marcado.
 */

import { useEffect } from "react";

import { CONSENT_EVENT } from "@/lib/consent";
import { enablePixel, isPixelPath, trackPurchaseOnce, type PurchaseEvent } from "@/lib/pixel";

import { browserPixelEnv } from "./browser-env";

export default function PurchasePixel({ orderId, active = true }: { orderId: string; active?: boolean }) {
  useEffect(() => {
    if (!active || !orderId) return;

    let event: PurchaseEvent | null = null;
    let alive = true;
    let done = false;

    const attempt = () => {
      if (!event || done) return;
      const env = browserPixelEnv();
      // Garante o pixel ligado (idempotente; só liga com consentimento de marketing e em página permitida).
      if (isPixelPath(window.location.pathname)) enablePixel(env);
      const result = trackPurchaseOnce(env, event);
      if (result === "sent" || result === "duplicate") done = true;
    };

    // O pedido pode levar alguns segundos para constar como pago (webhook): tenta até 4 vezes, a cada 4 s.
    const timers: number[] = [];
    const load = (triesLeft: number) => {
      fetch(`/api/orders/pixel-event?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" })
        .then((response) => (response.status === 200 ? response.json() : null))
        .then((data: { event?: PurchaseEvent } | null) => {
          if (!alive) return;
          if (data?.event) {
            event = data.event;
            attempt();
          } else if (triesLeft > 0) {
            timers.push(window.setTimeout(() => load(triesLeft - 1), 4000));
          }
        })
        .catch(() => undefined);
    };
    load(3);

    // Aceite dado DEPOIS de abrir a página: tenta de novo (o pixel é ligado pelo ChatGptAdsPixel no mesmo evento).
    const onConsent = () => window.setTimeout(attempt, 50);
    window.addEventListener(CONSENT_EVENT, onConsent);

    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [orderId, active]);

  return null;
}
