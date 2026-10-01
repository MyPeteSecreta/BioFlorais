"use client";

import { useState } from "react";

/** Link do cliente (aparece só uma vez): Copiar + Enviar pelo WhatsApp. */
export default function LinkSharePanel({ url, whatsappUrl }: { url: string; whatsappUrl: string }) {
  const [copied, setCopied] = useState(false);

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
      </div>
    </div>
  );
}
