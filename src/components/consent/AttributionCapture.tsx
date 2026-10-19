"use client";

/**
 * Captura da origem da venda (utm_source, utm_medium, utm_campaign e domínio do referrer) no cookie próprio bio_origem:
 * first-touch, 30 dias, sem dado pessoal e sem depender do aceite de marketing. Só nas páginas do B2C e do lojista
 * (nunca /admin nem área do vendedor). Não mexe na URL.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { isPixelPath } from "@/lib/ads-tag";
import { captureAttribution } from "@/lib/attribution";

export default function AttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPixelPath(pathname)) return;

    try {
      captureAttribution({
        search: window.location.search,
        referrer: document.referrer,
        hostname: window.location.hostname,
        doc: document,
        secure: window.location.protocol === "https:",
      });
    } catch {
      // cookies bloqueados: sem origem (o pedido segue normal)
    }
  }, [pathname]);

  return null;
}
