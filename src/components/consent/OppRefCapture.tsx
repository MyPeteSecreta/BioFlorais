"use client";

/**
 * Captura do oppref (clique no anúncio do ChatGPT) no cookie próprio bio_oppref — SÓ com consentimento de marketing,
 * 30 dias, e só nas páginas permitidas (B2C e páginas do lojista; nunca /admin nem área do vendedor). Sem escolha ainda:
 * guarda o oppref da página de entrada só na sessão até a decisão. Retirou/recusou: apaga. Não mexe na URL.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { consentChoiceOf, isPixelPath, syncOppref } from "@/lib/ads-tag";
import { CONSENT_EVENT } from "@/lib/consent";

import { browserOppRefEnv } from "./browser-env";

export default function OppRefCapture() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      const env = browserOppRefEnv();

      if (!isPixelPath(pathname)) {
        // Página interna: nada é lido nem gravado (o cookie existente só é apagado se o consentimento for retirado).
        return;
      }

      syncOppref(env, consentChoiceOf(env.storage));
    };

    sync();
    window.addEventListener(CONSENT_EVENT, sync);

    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [pathname]);

  return null;
}
