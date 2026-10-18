"use client";

/**
 * Banner de cookies discreto no padrão da Bio: Aceitar / Recusar / Configurar com o MESMO destaque (mesmo tamanho,
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
  "min-h-[44px] flex-1 rounded-full border-2 border-[#55245f] bg-white px-2 text-[13px] font-extrabold sm:px-4 sm:text-sm text-[#55245f] transition hover:bg-[#f6eef7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55245f]";

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
      className="fixed inset-x-3 bottom-3 z-[200] mx-auto max-w-[560px] rounded-[24px] border border-[#eadfd9] bg-white p-4 text-[#422347] shadow-[0_18px_50px_rgba(61,35,65,0.22)] sm:inset-x-auto sm:left-5 sm:mx-0"
    >
      <p className="text-sm font-extrabold">Cookies na Bio Florais</p>
      <p className="mt-1 text-xs leading-relaxed text-[#6c5b69]">
        Usamos cookies necessários para o site funcionar. Os de <strong>marketing</strong> (medir se nossos anúncios geram visitas e
        compras) só entram com o seu aceite. Saiba mais na{" "}
        <a href="/cookies" className="font-bold underline">
          Política de Cookies
        </a>
        .
      </p>

      {settings && (
        <ul className="mt-3 space-y-2 text-xs" data-testid="cookie-categorias">
          <li className="flex items-start justify-between gap-3 rounded-2xl bg-[#fbf5f1] p-3">
            <span>
              <strong>Necessários</strong>
              <span className="block text-[#6c5b69]">Carrinho, segurança e funcionamento do site. Sempre ativos.</span>
            </span>
            <span className="shrink-0 font-extrabold text-[#6c5b69]">Sempre</span>
          </li>
          <li className="flex items-start justify-between gap-3 rounded-2xl bg-[#fbf5f1] p-3">
            <span>
              <strong>Análise</strong>
              <span className="block text-[#6c5b69]">Nossa medição de visitas não usa cookies nem dado pessoal.</span>
            </span>
            <span className="shrink-0 font-extrabold text-[#6c5b69]">Sem cookies</span>
          </li>
          <li className="flex items-start justify-between gap-3 rounded-2xl bg-[#fbf5f1] p-3">
            <span>
              <strong>Marketing</strong>
              <span className="block text-[#6c5b69]">Medição das compras vindas dos anúncios (ChatGPT Ads). Sem nome, e-mail ou documentos.</span>
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

      <div className="mt-3 flex gap-2">
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
