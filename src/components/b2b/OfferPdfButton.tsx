"use client";

/**
 * "Baixar PDF" da oferta do lojista + o texto pronto para mandar junto do link (item 14b, 11/11). Abre /b2b/oferta/<token>/pdf,
 * que já chama a impressão ("Salvar como PDF"). Só aparece para link de oferta (/b2b/oferta/<token>).
 */

import { useState } from "react";

import { OFFER_SHARE_TEXT } from "@/lib/b2b/offer-pdf";

/** Endereço do PDF a partir do link da oferta; null se o link não for de oferta. */
export function offerPdfHref(offerUrl: string): string | null {
  const match = /^(.*\/b2b\/oferta\/[^/?#]+)/.exec(offerUrl);

  return match ? `${match[1]}/pdf` : null;
}

export default function OfferPdfButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const href = offerPdfHref(url);

  if (!href) return null;

  return (
    <div className="mt-3 rounded-2xl border border-[#eadfd9] bg-white p-3" data-testid="oferta-pdf">
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[#55245f] px-4 text-center text-sm font-extrabold text-white"
          data-testid="baixar-pdf-oferta"
        >
          Baixar PDF da oferta
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${OFFER_SHARE_TEXT}\n${url}`);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border-2 border-[#55245f] px-4 text-center text-sm font-extrabold text-[#55245f]"
          data-testid="copiar-texto-oferta"
        >
          {copied ? "Texto copiado ✓" : "Copiar texto + link"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#746471]">{OFFER_SHARE_TEXT}</p>
    </div>
  );
}
