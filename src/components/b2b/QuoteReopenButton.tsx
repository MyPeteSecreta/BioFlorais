"use client";

/**
 * Painel do vendedor: reabrir ou imprimir um ORÇAMENTO do cliente. Busca o link ativo da oferta (GET, sem gerar link novo),
 * extrai o token e abre o checkout em modo lançamento (?lancar=1) com o orçamento carregado, ou a folha de impressão.
 */

import { useState } from "react";

import { launchStorageKey } from "@/lib/b2b/launch-constants";

export default function QuoteReopenButton({ offerId, quoteId, mode, className }: { offerId: string; quoteId: string; mode: "open" | "print"; className: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/b2b/offers/link?offerId=${encodeURIComponent(offerId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error ?? "Não foi possível abrir o link da oferta.");
        return;
      }

      const token = decodeURIComponent(new URL(String(data.url), window.location.origin).pathname.split("/").filter(Boolean).pop() ?? "");

      if (!token) {
        setError("Link da oferta inválido.");
        return;
      }

      if (mode === "print") {
        window.location.href = `/b2b/oferta/${encodeURIComponent(token)}/pedidos/${quoteId}/imprimir`;
        return;
      }

      try {
        window.sessionStorage.setItem(launchStorageKey(token), "1");
      } catch {
        // o servidor valida a sessão do vendedor de qualquer forma
      }

      window.location.href = `/b2b/checkout?b2b=${encodeURIComponent(token)}&orcamento=${quoteId}&lancar=1`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={go} disabled={busy} className={className} data-testid={mode === "open" ? "reabrir-orcamento" : "imprimir-orcamento-vendedor"}>
        {busy ? "Abrindo…" : mode === "open" ? "Reabrir e escolher o pagamento" : "Imprimir / PDF"}
      </button>
      {error && <span className="mt-1 text-xs font-semibold text-red-700">{error}</span>}
    </span>
  );
}
