"use client";

/** Oferta já revisada/ativa: gerar novo link (revoga o anterior) ou revogar. */

import { useRouter } from "next/navigation";
import { useState } from "react";

import LinkSharePanel from "./LinkSharePanel";

export default function OfferLinkActions({
  offerId,
  hasActiveLink,
}: {
  offerId: string;
  hasActiveLink: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; whatsappUrl: string } | null>(null);

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
      {link && <LinkSharePanel url={link.url} whatsappUrl={link.whatsappUrl} />}
    </div>
  );
}
