"use client";

import { useState } from "react";

/**
 * Mostra um link gerado uma única vez (convite / redefinição) com
 * "Copiar" e "Enviar pelo WhatsApp". Não há envio de e-mail.
 */
export default function ShareLink({
  title,
  url,
  whatsappUrl,
  expiresAt,
  onClose,
}: {
  title: string;
  url: string;
  whatsappUrl: string;
  expiresAt?: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl border border-[#c9b37e] bg-[#fffaf0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#342737]">{title}</p>
          <p className="mt-0.5 text-xs text-[#8a6d2b]">
            Este link aparece só agora. Copie ou envie antes de fechar.
            {expiresAt ? ` Válido até ${new Date(expiresAt).toLocaleString("pt-BR")}.` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-bold text-[#7b6a77] underline">
          Fechar
        </button>
      </div>

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
          className="rounded-full bg-[#342737] px-4 py-2 text-xs font-extrabold text-white"
        >
          {copied ? "Copiado ✓" : "Copiar"}
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
