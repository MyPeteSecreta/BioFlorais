"use client";

/**
 * Ações de um ORÇAMENTO (Rodada 19b), as mesmas em todo lugar onde ele aparece (Meus pedidos, tela após salvar, painel do
 * representante, admin): o botão PRINCIPAL é "Continuar compra"; Imprimir, WhatsApp e Copiar link ficam secundários.
 * Links relativos viram absolutos pelo endereço do site na hora do clique/WhatsApp.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { quoteWhatsAppUrl } from "@/lib/b2b/quote-links";

const PRIMARY = "rounded-full bg-[#55245f] px-5 py-2.5 text-center text-sm font-extrabold text-white";
const SECONDARY = "rounded-full border-2 border-[#55245f] px-4 py-2 text-center text-xs font-extrabold text-[#55245f] hover:bg-[#f6eef7]";

export default function QuoteActions({
  continueHref,
  printHref,
  phone,
  who,
  className = "",
}: {
  /** Caminho (ou URL) da loja com ?orcamento=<id>. */
  continueHref: string;
  printHref: string | null;
  phone?: string | null;
  who?: string | null;
  className?: string;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // O link compartilhado nunca leva o modo "lançar": é o link do lojista.
  const shareUrl = `${/^https?:/i.test(continueHref) ? "" : origin}${continueHref}`.replace(/([?&])lancar=1&?/, "$1").replace(/[?&]$/, "");

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid="acoes-orcamento">
      <Link href={continueHref} className={PRIMARY} data-testid="continuar-compra">
        Continuar compra
      </Link>
      <div className="flex flex-wrap gap-2">
        {printHref && (
          <Link href={printHref} className={SECONDARY} data-testid="orcamento-imprimir">
            Imprimir / PDF
          </Link>
        )}
        {origin && (
          <a href={quoteWhatsAppUrl(shareUrl, phone, who)} target="_blank" rel="noopener noreferrer" className={SECONDARY} data-testid="orcamento-whatsapp">
            WhatsApp
          </a>
        )}
        <button
          type="button"
          className={SECONDARY}
          data-testid="orcamento-copiar"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
