"use client";

/**
 * Google tag (gtag) com Consent Mode v2. ID em NEXT_PUBLIC_GOOGLE_TAG_ID (G-… e/ou AW-…, separados por vírgula); sem ID, nada carrega.
 * Padrão NEGADO para tudo até o aceite do banner; a escolha guardada e as mudanças depois (evento do banner) atualizam o consentimento.
 * page_view manual a cada página (navegação do app), com o endereço já sem tokens. Nunca no admin, na área do vendedor nem em /api.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { isPixelPath } from "@/lib/ads-tag";
import { CONSENT_EVENT, readConsent } from "@/lib/consent";
import { GOOGLE_CONSENT_DEFAULT, googleConsentFromChoice, googleTagIds, safePageLocation } from "@/lib/measurement";
import { ensureGtagStub, loadScript, trackGoogle } from "@/lib/measurement-client";

export default function GoogleTag() {
  const pathname = usePathname();
  const started = useRef(false);
  const ids = googleTagIds();
  const allowed = ids.length > 0 && isPixelPath(pathname);

  useEffect(() => {
    if (!allowed || started.current) return;
    started.current = true;

    const gtag = ensureGtagStub();

    // 1) padrão negado ANTES de qualquer tag; 2) escolha já guardada (volta de visita); 3) config sem page_view automático.
    gtag("consent", "default", { ...GOOGLE_CONSENT_DEFAULT, wait_for_update: 500 });

    try {
      const saved = readConsent(window.localStorage);
      if (saved) gtag("consent", "update", googleConsentFromChoice(saved));
    } catch {
      // sem armazenamento: continua negado
    }

    gtag("js", new Date());
    for (const id of ids) gtag("config", id, { send_page_view: false });

    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`);

    // o listener vive enquanto a página viver (o componente fica no layout)
    window.addEventListener(CONSENT_EVENT, () => {
      try {
        window.gtag?.("consent", "update", googleConsentFromChoice(readConsent(window.localStorage)));
      } catch {
        // sem armazenamento
      }
    });
  }, [allowed, ids]);

  useEffect(() => {
    if (!allowed) return;

    // um page_view por página navegada (o primeiro espera o efeito acima instalar o gtag)
    const timer = window.setTimeout(() => {
      trackGoogle("page_view", {
        page_location: safePageLocation(window.location.href),
        page_path: safePageLocation(window.location.pathname),
        page_title: document.title,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [allowed, pathname]);

  return null;
}
