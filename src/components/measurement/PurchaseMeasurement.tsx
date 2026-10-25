"use client";

/**
 * Evento de compra para Google (purchase) e Meta (Purchase) na confirmação do pedido PAGO.
 * Busca o valor e o id do pedido no servidor (nunca confia no navegador), dispara UMA vez por pedido e por serviço
 * (marca no navegador) e usa o id do pedido como transaction_id/event_id (deduplicação). O Google vale mesmo com o consentimento
 * negado (o Consent Mode decide o que é guardado); a Meta só com o aceite de marketing, inclusive se ele vier depois.
 */

import { useEffect } from "react";

import { isPixelPath } from "@/lib/ads-tag";
import { CONSENT_EVENT } from "@/lib/consent";
import { googlePurchaseEvent, googleTagIds, metaPixelId, metaPurchaseEvent, purchaseSentKey, type PurchasePayload } from "@/lib/measurement";
import { trackGoogle, trackMeta } from "@/lib/measurement-client";

function wasSent(key: string) {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markSent(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // sem armazenamento: o Google e a Meta deduplicam pelo id do pedido
  }
}

export default function PurchaseMeasurement({ orderId, active = true }: { orderId: string; active?: boolean }) {
  useEffect(() => {
    if (!active || !orderId || !isPixelPath(window.location.pathname)) return;

    const wantGoogle = googleTagIds().length > 0;
    const wantMeta = metaPixelId() !== null;

    if (!wantGoogle && !wantMeta) return;

    let alive = true;
    let order: PurchasePayload | null = null;
    const timers: number[] = [];

    const send = () => {
      if (!order) return;

      if (wantGoogle && !wasSent(purchaseSentKey("google", orderId))) {
        const event = googlePurchaseEvent(order);
        if (trackGoogle(event.name, event.params)) markSent(purchaseSentKey("google", orderId));
      }

      if (wantMeta && !wasSent(purchaseSentKey("meta", orderId))) {
        const event = metaPurchaseEvent(order);
        if (trackMeta(event.name, event.params, event.eventId)) markSent(purchaseSentKey("meta", orderId));
      }
    };

    const load = (triesLeft: number) => {
      if (!alive || order) return;

      fetch("/api/orders/purchase-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
        cache: "no-store",
      })
        .then((response) => (response.status === 200 ? response.json() : null))
        .then((data: { order?: PurchasePayload } | null) => {
          if (!alive) return;

          if (data?.order) {
            order = data.order;
            // dá tempo de o gtag/pixel terminarem de instalar
            timers.push(window.setTimeout(send, 1000));
            timers.push(window.setTimeout(send, 4000));
          } else if (triesLeft > 0) {
            // o webhook do Pix/cartão pode demorar
            timers.push(window.setTimeout(() => load(triesLeft - 1), 4000));
          }
        })
        .catch(() => undefined);
    };

    load(3);

    // o aceite de marketing pode vir depois (banner na mesma visita)
    const onConsent = () => {
      timers.push(window.setTimeout(send, 800));
    };

    window.addEventListener(CONSENT_EVENT, onConsent);

    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [orderId, active]);

  return null;
}
