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
    <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5" data-testid="meu-link-captacao">
      <h3 className="text-lg font-extrabold text-[#422347]">Link geral para divulgar</h3>
      <p className="mt-1 text-sm text-[#746471]">
        <strong>Quando usar:</strong> flyer, cartão, Instagram, grupo de WhatsApp ou lojista que você ainda não conhece. Não leva
        nome: o lojista se identifica na hora de comprar e fica na sua carteira.
      </p>
      <input readOnly value={url} onFocus={(event) => event.target.select()} className="mt-3 w-full rounded-xl border border-[#eadfd9] bg-[#fbf7f4] px-3 py-2 text-xs" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center rounded-full bg-[#55245f] px-5 text-sm font-extrabold text-white">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full bg-[#1f9d55] px-5 text-sm font-extrabold text-white">
          WhatsApp
        </a>
        <button type="button" onClick={() => setShowQr(true)} className="inline-flex min-h-[44px] items-center rounded-full bg-[#26352c] px-5 text-sm font-extrabold text-white">
          QR Code
        </button>
      </div>
      {showQr && <QrCodeModal url={url} clientName={null} onClose={() => setShowQr(false)} />}
    </section>
  );
}
