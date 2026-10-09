"use client";

/** Oferta já revisada/ativa: gerar novo link (revoga o anterior) ou revogar. */

import { useRouter } from "next/navigation";
import { useState } from "react";

import LinkSharePanel from "./LinkSharePanel";
import QrCodeModal from "./QrCodeModal";

export default function OfferLinkActions({
  offerId,
  hasActiveLink,
  clientName,
}: {
  offerId: string;
  hasActiveLink: boolean;
  clientName?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<{ url: string; whatsappUrl: string } | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  async function copyCurrent(whatsapp: boolean, qr = false) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/b2b/offers/link?offerId=${encodeURIComponent(offerId)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Erro.");
        return;
      }

      if (qr) {
        setQrUrl(data.url);
      } else if (whatsapp) {
        window.open(data.whatsappUrl, "_blank", "noopener");
      } else {
        try {
          await navigator.clipboard.writeText(data.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          setLink({ url: data.url, whatsappUrl: data.whatsappUrl });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function call(method: "POST" | "DELETE") {
    if (method === "POST" && hasActiveLink && !window.confirm("Gerar um novo link? O link atual deixa de funcionar.")) return;
    if (method === "DELETE" && !window.confirm("Revogar o link? O cliente deixa de acessar a oferta.")) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/b2b/offers/link", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Erro.");
        return;
      }

      setLink(method === "POST" ? { url: data.url, whatsappUrl: data.whatsappUrl } : null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => call("POST")}
          className="rounded-full bg-[#55245f] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
        >
          {hasActiveLink ? "Gerar novo link" : "Gerar link"}
        </button>
        {hasActiveLink && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => copyCurrent(false)}
              className="rounded-full border border-[#55245f] px-4 py-2 text-xs font-extrabold text-[#55245f] disabled:opacity-50"
            >
              {copied ? "Link copiado ✓" : "Copiar link da oferta"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => copyCurrent(true)}
              className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
            >
              Enviar por WhatsApp
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => copyCurrent(false, true)}
              className="rounded-full bg-[#26352c] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
            >
              Mostrar QR Code
            </button>
          </>
        )}
        {hasActiveLink && (
          <button
            type="button"
            disabled={busy}
            onClick={() => call("DELETE")}
            className="rounded-full border border-[#b33] px-4 py-2 text-xs font-extrabold text-[#b33] disabled:opacity-50"
          >
            Revogar link
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {link && <LinkSharePanel url={link.url} whatsappUrl={link.whatsappUrl} clientName={clientName} />}
      {qrUrl && <QrCodeModal url={qrUrl} clientName={clientName} onClose={() => setQrUrl(null)} />}
    </div>
  );
}
