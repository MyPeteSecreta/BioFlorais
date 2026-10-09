"use client";

/**
 * Fim da revisão obrigatória: "Gerar link para o cliente" ativa a oferta
 * e mostra o link uma única vez (Copiar / WhatsApp).
 */

import Link from "next/link";
import { useState } from "react";

import LinkSharePanel from "@/components/b2b/LinkSharePanel";

export default function ReviewActions({
  clientId,
  offerId,
  blocked,
  clientName,
}: {
  clientId: string;
  offerId: string;
  blocked: boolean;
  clientName?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; whatsappUrl: string } | null>(null);

  async function activate() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/b2b/offers/${offerId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Erro ao gerar o link.");
        return;
      }

      setLink({ url: data.url, whatsappUrl: data.whatsappUrl });
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <LinkSharePanel url={link.url} whatsappUrl={link.whatsappUrl} clientName={clientName} />
        <div className="text-center">
          <Link href={`/b2b/painel/cliente/${clientId}`} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
            Voltar ao cliente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-3">
      {error && <p className="w-full rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/b2b/painel/cliente/${clientId}/oferta?offerId=${offerId}`}
          className="rounded-full border-2 border-[#55245f] px-6 py-3.5 text-center text-sm font-extrabold text-[#55245f]"
        >
          ← Voltar e editar
        </Link>
        <button
          type="button"
          onClick={activate}
          disabled={busy || blocked}
          className="rounded-full bg-[#55245f] px-8 py-3.5 text-sm font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Gerando…" : "Gerar link para o cliente"}
        </button>
      </div>
    </div>
  );
}
