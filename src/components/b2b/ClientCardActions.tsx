"use client";

/**
 * Botões VISÍVEIS de cada cliente no painel: Nova oferta (principal) · Copiar link · WhatsApp · QR.
 * Nova oferta nunca fica escondida em texto pequeno. O link ativo é lido na hora (só do próprio vendedor).
 */

import Link from "next/link";
import { useState } from "react";

import QrCodeModal from "@/components/b2b/QrCodeModal";

const small = "inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm font-extrabold disabled:opacity-50";

export default function ClientCardActions({
  clientId,
  clientName,
  offerId,
  demo = false,
}: {
  clientId: string;
  clientName: string;
  /** Oferta ativa com link (null = ainda não tem). */
  offerId: string | null;
  demo?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  async function act(kind: "copy" | "whatsapp" | "qr") {
    if (!offerId) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/b2b/offers/link?offerId=${encodeURIComponent(offerId)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível abrir o link.");
        return;
      }

      if (kind === "qr") setQrUrl(String(data.url));
      else if (kind === "whatsapp") window.open(String(data.whatsappUrl), "_blank", "noopener");
      else {
        try {
          await navigator.clipboard.writeText(String(data.url));
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          setError("Não foi possível copiar. Abra o cliente e use o link da oferta.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <Link
        href={`/b2b/painel/cliente/${clientId}/oferta`}
        className={`${small} w-full bg-[#55245f] text-white`}
        data-testid="cliente-nova-oferta"
      >
        Nova oferta
      </Link>
      {offerId && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={busy} onClick={() => act("copy")} className={`${small} border border-[#55245f] text-[#55245f]`}>
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
          <button type="button" disabled={busy} onClick={() => act("whatsapp")} className={`${small} bg-[#1f9d55] text-white`}>
            WhatsApp
          </button>
          <button type="button" disabled={busy} onClick={() => act("qr")} className={`${small} bg-[#26352c] text-white`}>
            QR
          </button>
        </div>
      )}
      {error && <p className="text-xs font-bold text-red-700">{error}</p>}
      {qrUrl && <QrCodeModal url={qrUrl} clientName={clientName} demo={demo} onClose={() => setQrUrl(null)} />}
    </div>
  );
}
