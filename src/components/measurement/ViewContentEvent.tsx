"use client";

/** ViewContent da Meta na página do produto (só com o pixel carregado e o aceite de marketing; tenta de novo se o aceite vier depois). */

import { useEffect } from "react";

import { CONSENT_EVENT } from "@/lib/consent";
import { metaViewContentEvent } from "@/lib/measurement";
import { trackMeta } from "@/lib/measurement-client";

export default function ViewContentEvent({ slug, name, priceCents }: { slug: string; name: string; priceCents: number | null }) {
  useEffect(() => {
    let sent = false;
    const timers: number[] = [];

    const send = () => {
      if (sent) return;

      const event = metaViewContentEvent({ slug, name, priceCents });
      sent = trackMeta(event.name, event.params);
    };

    // o pixel pode ainda estar carregando (consentimento dado nesta visita)
    send();
    timers.push(window.setTimeout(send, 1200));

    const onConsent = () => {
      timers.push(window.setTimeout(send, 800));
    };

    window.addEventListener(CONSENT_EVENT, onConsent);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [slug, name, priceCents]);

  return null;
}
