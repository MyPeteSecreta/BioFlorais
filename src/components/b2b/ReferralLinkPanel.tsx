"use client";

/**
 * "Meu link de captação" (painel do vendedor): /parceiros?v=<código> com Copiar, WhatsApp e QR Code para
 * imprimir no flyer/cartão. Todo lojista que se cadastrar por esse link fica vinculado a este vendedor e
 * já recebe o link padrão (preço B2B).
 */

import { useState } from "react";

import QrCodeModal from "@/components/b2b/QrCodeModal";

export default function ReferralLinkPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Conheça as condições B2B da Bio Florais e faça seu cadastro: ${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-6 max-w-3xl rounded-[24px] border border-[#eadfd9] bg-white p-5" data-testid="meu-link-captacao">
      <h2 className="text-lg font-extrabold text-[#422347]">Meu link de captação</h2>
      <p className="mt-1 text-sm text-[#746471]">
        Coloque no seu flyer ou cartão. Quem se cadastrar por ele fica na sua carteira e já recebe o link com os preços B2B.
      </p>
      <input readOnly value={url} onFocus={(event) => event.target.select()} className="mt-3 w-full rounded-xl border border-[#eadfd9] bg-[#fbf7f4] px-3 py-2 text-xs" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-full bg-[#55245f] px-4 py-2 text-xs font-extrabold text-white">
          {copied ? "Copiado ✓" : "Copiar link"}
        </button>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-extrabold text-white">
          Enviar pelo WhatsApp
        </a>
        <button type="button" onClick={() => setShowQr(true)} className="rounded-full bg-[#26352c] px-4 py-2 text-xs font-extrabold text-white">
          Mostrar QR Code
        </button>
      </div>
      {showQr && <QrCodeModal url={url} clientName={null} onClose={() => setShowQr(false)} />}
    </section>
  );
}
