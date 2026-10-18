"use client";

/**
 * Pixel do ChatGPT Ads: só carrega com o aceite de cookies de MARKETING e só nas páginas permitidas (B2C e páginas do
 * lojista: /b2b/oferta, carrinho, checkout, /parceiros). Em /admin e na área do vendedor nada é carregado; se o
 * visitante retirar o consentimento, oaiq("consent", false) apaga os cookies e para os eventos.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { CONSENT_EVENT, hasMarketingConsent } from "@/lib/consent";
import { disablePixel, enablePixel, isPixelPath } from "@/lib/pixel";

import { browserPixelEnv } from "./browser-env";

export default function ChatGptAdsPixel() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      const env = browserPixelEnv();

      if (isPixelPath(pathname) && hasMarketingConsent(env.storage)) enablePixel(env);
      else disablePixel(env);
    };

    sync();
    window.addEventListener(CONSENT_EVENT, sync);

    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [pathname]);

  return null;
}
