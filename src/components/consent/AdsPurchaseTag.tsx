"use client";

/**
 * Image Tag do evento "Compra" (ChatGPT Ads): um <img> 1x1 UMA vez por pedido PAGO, só com consentimento de marketing.
 * O servidor decide (pedido pago, não boleto, ainda não enviado) e entrega a URL; o <img> não roda nenhum script de
 * terceiros. O pedido só é marcado como "tag enviada" quando a imagem CARREGA (onLoad); se um navegador/extensão
 * bloquear (onError) nada é marcado e tentamos de novo (poucas vezes; a próxima visita também reoferece, com o mesmo
 * event_id). Tenta algumas vezes (o webhook do cartão pode demorar) e de novo se o aceite vier depois.
 */

import { useEffect, useState } from "react";

import { isPixelPath } from "@/lib/ads-tag";
import { CONSENT_EVENT, hasMarketingConsent } from "@/lib/consent";

export default function AdsPurchaseTag({ orderId, active = true }: { orderId: string; active?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  // Nº de nova tentativa depois de uma imagem bloqueada (onError): re-renderiza a tag.
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!active || !orderId) return;

    let alive = true;
    let done = false;
    const timers: number[] = [];

    const claim = (triesLeft: number) => {
      if (done || !alive) return;

      let allowed = false;
      try {
        allowed = hasMarketingConsent(window.localStorage) && isPixelPath(window.location.pathname);
      } catch {
        allowed = false;
      }

      // Sem consentimento de marketing: nenhuma requisição (o servidor nem é consultado).
      if (!allowed) return;

      fetch("/api/orders/ads-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
        cache: "no-store",
      })
        .then((response) => (response.status === 200 ? response.json() : null))
        .then((data: { src?: string } | null) => {
          if (!alive) return;
          if (data?.src) {
            done = true;
            setSrc(data.src);
          } else if (triesLeft > 0) {
            timers.push(window.setTimeout(() => claim(triesLeft - 1), 4000));
          }
        })
        .catch(() => undefined);
    };

    claim(3);

    const onConsent = () => window.setTimeout(() => claim(0), 50);
    window.addEventListener(CONSENT_EVENT, onConsent);

    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [orderId, active, retry]);

  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={`${src}-${retry}`}
      src={src}
      width={1}
      height={1}
      style={{ display: "none" }}
      alt=""
      data-testid="ads-tag"
      // Só agora o servidor marca "tag enviada": a imagem realmente carregou.
      onLoad={() => {
        void fetch("/api/orders/ads-tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, sent: true }),
          cache: "no-store",
        }).catch(() => undefined);
      }}
      // Bloqueada (extensão/rede): NÃO marca; libera uma nova tentativa (no máximo 2), com o mesmo event_id.
      onError={() => {
        setSrc(null);
        if (retry < 2) window.setTimeout(() => setRetry((value) => value + 1), 5000);
      }}
    />
  );
}
