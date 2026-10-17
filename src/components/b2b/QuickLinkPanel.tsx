"use client";

/**
 * L1 — "Link padrão (preço B2B, todas as linhas)": na loja, em 10 segundos. Só o nome do cliente (ou um
 * cliente que já existe). Gera a oferta ativa com todas as linhas B2B publicadas, sem promoção, e mostra
 * na hora Copiar, WhatsApp e "Mostrar QR Code".
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import LinkSharePanel from "@/components/b2b/LinkSharePanel";

type Result = { url: string; whatsappUrl: string; clientName: string; lines: string[] };

export default function QuickLinkPanel({
  clients,
  demo = false,
}: {
  clients: Array<{ id: string; displayName: string }>;
  demo?: boolean;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);

    try {
      const response = await fetch("/api/b2b/offers/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientId ? { clientId } : { clientName }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível gerar o link padrão.");
        return;
      }

      setResult({ url: data.url, whatsappUrl: data.whatsappUrl, clientName: data.clientName, lines: data.lines ?? [] });
      setClientName("");
      setClientId("");
      router.refresh();
    } catch {
      setError("Não foi possível gerar o link padrão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-3 text-base";

  return (
    <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5" data-testid="link-padrao">
      <h3 className="text-lg font-extrabold text-[#422347]">Link com o nome do cliente</h3>
      <p className="mt-1 text-sm text-[#746471]">
        <strong>Quando usar:</strong> o cliente só quer ver a tabela e comprar. Digite o nome dele: o link sai na hora e ele abre
        vendo &quot;Olá, {"{loja}"}&quot;.
      </p>

      <form onSubmit={generate} className="mt-4 space-y-3">
        {clients.length > 0 && (
          <select className={input} value={clientId} onChange={(event) => setClientId(event.target.value)} aria-label="Cliente existente">
            <option value="">Cliente novo</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
        )}

        {!clientId && (
          <input
            className={input}
            placeholder="Nome do cliente"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            required
            minLength={2}
          />
        )}

        <button
          type="submit"
          disabled={busy || (!clientId && clientName.trim().length < 2)}
          className="min-h-[48px] w-full rounded-full bg-[#55245f] px-6 py-3 text-base font-extrabold text-white shadow disabled:opacity-50"
        >
          {busy ? "Gerando…" : "Gerar link"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-bold text-[#26352c]">
            Link de <strong>{result.clientName}</strong> pronto ({result.lines.length} linha(s), preço B2B normal).
          </p>
          <LinkSharePanel url={result.url} whatsappUrl={result.whatsappUrl} clientName={result.clientName} demo={demo} />
        </div>
      )}
    </section>
  );
}
