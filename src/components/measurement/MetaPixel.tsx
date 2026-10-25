"use client";

/**
 * Pixel da Meta: ID em NEXT_PUBLIC_META_PIXEL_ID; sem ID, nada carrega. SÓ carrega depois do aceite de marketing do banner
 * (sem aceite não há script nem requisição para a Meta). PageView a cada página. Ao retirar o aceite, revoga o consentimento do pixel.
 * Nunca no admin, na área do vendedor nem em /api.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { isPixelPath } from "@/lib/ads-tag";
import { CONSENT_EVENT, hasMarketingConsent } from "@/lib/consent";
import { metaPixelId } from "@/lib/measurement";
import { installMetaPixel, trackMeta } from "@/lib/measurement-client";

export default function MetaPixel() {
  const pathname = usePathname();
  const pixelId = metaPixelId();
  const pathRef = useRef(pathname);
  const started = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Liga (ou desliga) conforme a escolha do banner.
  useEffect(() => {
    if (!pixelId) return;

    const sync = () => {
      let consent = false;

      try {
        consent = hasMarketingConsent(window.localStorage);
      } catch {
        consent = false;
      }

      if (consent && isPixelPath(pathRef.current)) {
        if (!started.current) {
          started.current = true;
          installMetaPixel(pixelId);
          window.fbq?.("consent", "grant");
          trackMeta("PageView", {});
        }
      } else if (!consent && started.current) {
        window.fbq?.("consent", "revoke");
      }
    };

    sync();
    window.addEventListener(CONSENT_EVENT, sync);

    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [pixelId]);

  // PageView nas navegações seguintes (a primeira já saiu ao ligar).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    if (pixelId && started.current && isPixelPath(pathname)) trackMeta("PageView", {});
  }, [pixelId, pathname]);

  return null;
}
