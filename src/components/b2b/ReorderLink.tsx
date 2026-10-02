"use client";

import { useState } from "react";

/** Tela de pedido concluído: o link da oferta é permanente; use-o para recomprar. */
export default function ReorderLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/b2b/oferta/${encodeURIComponent(token)}`;

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
    <div className="mx-auto mt-6 max-w-sm rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm text-blue-950">
      <p className="font-extrabold">Para comprar de novo, use sempre este link</p>
      <p className="mt-1 break-all text-xs">{url}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-xs font-extrabold text-white"
      >
        {copied ? "Link copiado ✓" : "Copiar link"}
      </button>
    </div>
  );
}
