"use client";

/**
 * Banner de cookies discreto no padrão da Bio (1ª camada curta, sem citar anúncios): Aceitar / Recusar / Configurar com o MESMO destaque (mesmo tamanho,
 * mesma cor), padrão RECUSADO. Categorias: necessários (sempre), análise (nossa medição é sem cookies) e marketing
 * (medição de anúncios — só com aceite). A escolha fica salva e pode ser mudada em "Configurar cookies".
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CONSENT_EVENT, OPEN_SETTINGS_EVENT, readConsent, writeConsent } from "@/lib/consent";
import { isPixelPath } from "@/lib/ads-tag";

import { browserOppRefEnv } from "./browser-env";

// Os botões de escolha têm EXATAMENTE a mesma classe: mesmo destaque.
const button =
  "min-h-[40px] flex-1 rounded-full border-2 border-[#55245f] bg-white px-2 text-[13px] font-extrabold sm:px-4 sm:text-sm text-[#55245f] transition hover:bg-[#f6eef7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55245f]";

export default function CookieBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = readConsent(browserOppRefEnv().storage);
    // Efeito único na montagem: lê a escolha salva (só existe no navegador).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarketing(saved?.marketing === true);
    setOpen(saved === null);

    const reopen = () => {
      setMarketing(readConsent(browserOppRefEnv().storage)?.marketing === true);
      setSettings(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);

    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
  }, []);

  function save(value: boolean) {
    writeConsent(browserOppRefEnv().storage, value);
    setMarketing(value);
    setOpen(false);
    setSettings(false);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  // Só aparece onde o pixel pode rodar (B2C e páginas do lojista); nunca no admin nem na área do vendedor.
  if (!open || !isPixelPath(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      data-testid="cookie-banner"
      className="fixed inset-x-2 bottom-2 z-[200] mx-auto max-w-[440px] rounded-[20px] border border-[#eadfd9] bg-white p-3 text-[#422347] shadow-[0_12px_36px_rgba(61,35,65,0.18)] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:mx-0"
    >
      {!settings && (
        <p className="text-[13px] leading-snug text-[#6c5b69]">
          Usamos cookies para o site funcionar e melhorar sua experiência.{" "}
          <a href="/cookies" className="font-bold text-[#55245f] underline">
            Saiba mais
          </a>
        </p>
      )}

      {settings && (
        <ul className="space-y-2 text-xs" data-testid="cookie-categorias">
          <li className="flex items-start justify-between gap-3 rounded-2xl bg-[#fbf5f1] p-2.5">
            <span>
              <strong>Necessários</strong>
              <span className="block text-[#6c5b69]">Para o site funcionar.</span>
            </span>
            <span className="shrink-0 font-extrabold text-[#6c5b69]">Sempre</span>
          </li>
          <li className="flex items-start justify-between gap-3 rounded-2xl bg-[#fbf5f1] p-3">
            <span>
              <strong>Análise</strong>
              <span className="block text-[#6c5b69]">Para entender como o site é usado.</span>
            </span>
            <span className="shrink-0 font-extrabold text-[#6c5b69]">Sempre</span>
          </li>
          <li className="flex items-start justify-between gap-3 rounded-2xl bg-[#fbf5f1] p-3">
            <span>
              <strong>Marketing</strong>
              <span className="block text-[#6c5b69]">Para medir nossas campanhas.</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={marketing}
              aria-label="Cookies de marketing"
              onClick={() => setMarketing((value) => !value)}
              className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-[#55245f] transition ${marketing ? "bg-[#55245f]" : "bg-white"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${marketing ? "left-[22px] bg-white" : "left-0.5 bg-[#55245f]"}`} />
            </button>
          </li>
        </ul>
      )}
      {settings && (
        <p className="mt-2 text-[11px] text-[#6c5b69]">
          Detalhes na{" "}
          <a href="/cookies" className="font-bold text-[#55245f] underline">
            Política de Cookies
          </a>{" "}
          e na{" "}
          <a href="/privacidade" className="font-bold text-[#55245f] underline">
            Política de Privacidade
          </a>
          .
        </p>
      )}

      <div className={`flex gap-2 ${settings ? "mt-3" : "mt-2.5"}`}>
        {settings ? (
          <>
            <button type="button" className={button} onClick={() => save(marketing)} data-testid="cookie-salvar">
              Salvar
            </button>
            <button type="button" className={button} onClick={() => save(false)}>
              Recusar
            </button>
            <button type="button" className={button} onClick={() => save(true)}>
              Aceitar
            </button>
          </>
        ) : (
          <>
            <button type="button" className={button} onClick={() => save(true)} data-testid="cookie-aceitar">
              Aceitar
            </button>
            <button type="button" className={button} onClick={() => save(false)} data-testid="cookie-recusar">
              Recusar
            </button>
            <button type="button" className={button} onClick={() => setSettings(true)} data-testid="cookie-configurar">
              Configurar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
