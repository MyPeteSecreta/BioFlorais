"use client";

/** "Copiar link" e "Enviar para meu WhatsApp" (wa.me sem número fixo) do acompanhamento. */

import { useState } from "react";

export default function TrackShare({ path, number }: { path: string; number: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link:", url());
    }
  }

  function whatsapp() {
    const text = `Acompanhe meu pedido #${number} na Bio Florais: ${url()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="rounded-full border-2 border-[#55245f] px-4 py-2 text-sm font-extrabold text-[#55245f]">
        {copied ? "Link copiado ✓" : "Copiar link"}
      </button>
      <button type="button" onClick={whatsapp} className="rounded-full bg-[#1f9d55] px-4 py-2 text-sm font-extrabold text-white">
        Enviar para meu WhatsApp
      </button>
    </div>
  );
}
