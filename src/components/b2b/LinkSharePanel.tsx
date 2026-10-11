"use client";

import { useState } from "react";

import QrCodeModal from "@/components/b2b/QrCodeModal";

/** Link do cliente (aparece só uma vez): Copiar + Enviar pelo WhatsApp. */
export default function LinkSharePanel({
  url,
  whatsappUrl,
  clientName,
  demo = false,
}: {
  url: string;
  whatsappUrl: string;
  clientName?: string | null;
  /** Modo demonstração: link fictício, aviso e "Abrir como cliente". */
  demo?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="rounded-2xl border border-[#c9b37e] bg-[#fffaf0] p-4">
      <p className="text-sm font-extrabold">Link do cliente</p>
      <p className="mt-0.5 text-xs text-[#8a6d2b]">Ele aparece só agora. Copie ou envie antes de sair da página.</p>
      <input
        readOnly
        value={url}
        onFocus={(event) => event.target.select()}
        className="mt-3 w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-xs"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded-full bg-[#55245f] px-4 py-2 text-xs font-extrabold text-white"
        >
          {copied ? "Copiado ✓" : "Copiar link"}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-extrabold text-white"
        >
          Enviar pelo WhatsApp
        </a>
        <button type="button" onClick={() => setShowQr(true)} className="rounded-full bg-[#26352c] px-4 py-2 text-xs font-extrabold text-white">Mostrar QR Code</button>
      </div>
      {demo && (
        <>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-full bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-[#2b1836]"
          >
            Abrir como cliente
          </a>
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Este é um link FICTÍCIO de demonstração. Abra para ver exatamente o site que o seu cliente receberia.
          </p>
        </>
      )}
      {showQr && <QrCodeModal url={url} clientName={clientName} demo={demo} onClose={() => setShowQr(false)} />}
    </div>
  );
}
