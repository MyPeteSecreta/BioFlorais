"use client";

import { useState } from "react";

/**
 * Tela de pedido concluído: "Salve este link para comprar de novo" (Copiar e WhatsApp).
 * `url` = link permanente do lojista (loja pública /parceiros: oferta padrão dele, já ligada ao cadastro);
 * sem `url`, é o próprio link da oferta (token).
 */
export default function ReorderLink({ token, url: given }: { token: string; url?: string }) {
  const [copied, setCopied] = useState(false);
  const url = given ?? `${typeof window === "undefined" ? "" : window.location.origin}/b2b/oferta/${encodeURIComponent(token)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Meu link para comprar Bio Florais com preço B2B: ${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-sm rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm text-blue-950" data-testid="salve-link">
      <p className="font-extrabold">{given ? "Salve este link para comprar de novo" : "Para comprar de novo, use sempre este link"}</p>
      <p className="mt-1 break-all text-xs">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-extrabold text-white">
          {copied ? "Link copiado ✓" : "Copiar link"}
        </button>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-extrabold text-white">
          Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
