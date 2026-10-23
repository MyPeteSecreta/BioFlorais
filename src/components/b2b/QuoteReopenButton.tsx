"use client";

/**
 * Painel do representante: ações de um ORÇAMENTO do cliente (Rodada 19b). Botão PRINCIPAL "Continuar compra" (restaura a
 * sacola na loja em modo lançamento e segue ao checkout); Imprimir, WhatsApp e Copiar link ficam secundários.
 * O link da loja vem do link ATIVO da oferta (GET, sem gerar link novo); o link compartilhado é o do lojista (sem modo lançar).
 */

import Link from "next/link";
import { useState } from "react";

import { launchStorageKey } from "@/lib/b2b/launch-constants";
import { continueQuotePath, printQuotePath, quoteWhatsAppUrl, tokenFromOfferUrl } from "@/lib/b2b/quote-links";

const PRIMARY = "rounded-full bg-[#55245f] px-5 py-2.5 text-center text-sm font-extrabold text-white disabled:opacity-60";
const SECONDARY = "rounded-full border-2 border-[#55245f] px-4 py-2 text-center text-xs font-extrabold text-[#55245f] hover:bg-[#f6eef7] disabled:opacity-60";

export default function QuoteReopenButton({ offerId, quoteId, phone, who }: { offerId: string; quoteId: string; phone?: string | null; who?: string | null }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadToken(): Promise<string | null> {
    const response = await fetch(`/api/b2b/offers/link?offerId=${encodeURIComponent(offerId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      setError(data.error ?? "Não foi possível abrir o link da oferta.");

      return null;
    }

    const token = tokenFromOfferUrl(String(data.url), window.location.origin);

    if (!token) {
      setError("Link da oferta inválido.");

      return null;
    }

    return token;
  }

  async function run(action: "continue" | "whatsapp" | "copy") {
    setBusy(action);
    setError("");

    try {
      const token = await loadToken();
      if (!token) return;

      if (action === "continue") {
        try {
          window.sessionStorage.setItem(launchStorageKey(token), "1");
        } catch {
          // o servidor valida a sessão do representante de qualquer forma
        }

        window.location.href = continueQuotePath(token, quoteId, true);

        return;
      }

      const url = `${window.location.origin}${continueQuotePath(token, quoteId, false)}`;

      if (action === "whatsapp") {
        window.open(quoteWhatsAppUrl(url, phone, who), "_blank", "noopener,noreferrer");

        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        setError("Não foi possível copiar. Use o WhatsApp.");
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2" data-testid="acoes-orcamento-vendedor">
      <button type="button" onClick={() => run("continue")} disabled={busy !== ""} className={PRIMARY} data-testid="continuar-compra">
        {busy === "continue" ? "Abrindo…" : "Continuar compra"}
      </button>
      <Link href={printQuotePath(quoteId)} className={SECONDARY + " self-start"} data-testid="imprimir-orcamento-vendedor">
        Imprimir / PDF
      </Link>
      <div className="rounded-2xl border border-[#d9c7dc] bg-white p-3" data-testid="enviar-cliente-pagar">
        <p className="mb-2 text-xs font-extrabold text-[#55245f]">
          Enviar para o cliente pagar
          <span className="block font-normal text-[#6c5b69]">Ele abre o link, confere o orçamento e paga por Pix ou cartão.</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run("whatsapp")} disabled={busy !== ""} className={SECONDARY} data-testid="orcamento-whatsapp">
            WhatsApp
          </button>
          <button type="button" onClick={() => run("copy")} disabled={busy !== ""} className={SECONDARY} data-testid="orcamento-copiar">
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </div>
      </div>
      {error && <span className="text-xs font-semibold text-red-700">{error}</span>}
    </div>
  );
}
