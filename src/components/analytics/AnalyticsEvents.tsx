"use client";

/**
 * Eventos do Vercel Analytics por página: chegada (uma vez por sessão do navegador), ver_produto e checkout.
 * (sacola é disparado no CartProvider ao adicionar item.) Só nas páginas do B2C e do lojista: nunca admin nem área do vendedor.
 * Fica DEPOIS do AttributionCapture no layout, para o cookie bio_origem já existir na primeira visita.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { isPixelPath } from "@/lib/ads-tag";
import { pageEventFor, trackEvent } from "@/lib/analytics-events";

const ARRIVAL_KEY = "bio_chegada_v1";

export default function AnalyticsEvents() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPixelPath(pathname)) return;

    let first = false;

    try {
      if (window.sessionStorage.getItem(ARRIVAL_KEY) === null) {
        window.sessionStorage.setItem(ARRIVAL_KEY, "1");
        first = true;
      }
    } catch {
      first = false;
    }

    if (first) void trackEvent("chegada");

    const event = pageEventFor(pathname);
    if (event) void trackEvent(event);
  }, [pathname]);

  return null;
}
