"use client";

/**
 * L2 — "Minhas ofertas padrão": lista de modelos do vendedor e "Gerar link com este modelo": escolhe o
 * cliente (novo, só o nome, ou existente), CONFERE (avisos de promoção indisponível/desativada para
 * aquele cliente) e só então gera a oferta ativa com Copiar, WhatsApp e QR Code.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import LinkSharePanel from "@/components/b2b/LinkSharePanel";

export type TemplateView = {
  id: string;
  name: string;
  /** Texto por linha: "Adulto · 3 por 2 · 2 compras" ou "Pet · preço B2B normal". */
  summary: string[];
};

type Evaluation = {
  lines: Array<{ id: string; name: string; included: boolean; promotion: { label: string; eligibility: string } | null; warning: string | null }>;
  warnings: string[];
};

const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-3 text-base";

function TemplateCard({
  template,
  clients,
  demo,
}: {
  template: TemplateView;
  clients: Array<{ id: string; displayName: string }>;
  demo: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [result, setResult] = useState<{ url: string; whatsappUrl: string; clientName: string } | null>(null);

  const target = clientId ? { clientId } : { clientName };
  const ready = clientId || clientName.trim().length >= 2;

  async function call(preview: boolean) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/b2b/offers/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, ...target, preview }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível usar este modelo.");
        if (data.evaluation) setEvaluation(data.evaluation);
        return;
      }

      setEvaluation(data.evaluation ?? null);

      if (!preview) {
        setResult({ url: data.url, whatsappUrl: data.whatsappUrl, clientName: data.clientName });
        router.refresh();
      }
    } catch {
      setError("Não foi possível usar este modelo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Excluir o modelo "${template.name}"? As ofertas já geradas não mudam.`)) return;

    const response = await fetch(`/api/b2b/offer-templates?id=${encodeURIComponent(template.id)}`, { method: "DELETE" });

    if (response.ok) router.refresh();
    else setError("Não foi possível excluir o modelo.");
  }

  return (
    <li className="rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm" data-testid="modelo-oferta">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold text-[#422347]">{template.name}</p>
          <ul className="mt-2 space-y-0.5 text-sm text-[#746471]">
            {template.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/b2b/painel/modelos/${template.id}`} className="rounded-full border border-[#55245f] px-4 py-2 text-xs font-extrabold text-[#55245f]">
            Editar
          </Link>
          <button type="button" onClick={remove} className="rounded-full border border-[#b33] px-4 py-2 text-xs font-extrabold text-[#b33]">
            Excluir
          </button>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-full bg-[#55245f] px-6 py-3.5 text-sm font-extrabold text-white sm:w-auto"
        >
          Gerar link com minha oferta padrão
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-2xl bg-[#fbf6fc] p-4">
          {!result && (
            <>
              {clients.length > 0 && (
                <select
                  className={input}
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setEvaluation(null);
                  }}
                  aria-label="Cliente existente"
                >
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
                  onChange={(event) => {
                    setClientName(event.target.value);
                    setEvaluation(null);
                  }}
                />
              )}

              {!evaluation ? (
                <button
                  type="button"
                  disabled={busy || !ready}
                  onClick={() => call(true)}
                  className="w-full rounded-full bg-[#55245f] px-6 py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {busy ? "Conferindo…" : "Conferir a oferta"}
                </button>
              ) : (
                <div className="space-y-3">
                  <ul className="space-y-1 text-sm" data-testid="conferencia">
                    {evaluation.lines.map((line) => (
                      <li key={line.id} className={line.warning ? "font-bold text-[#8a5a00]" : ""}>
                        {line.included ? "✓" : "✕"} {line.name}
                        {line.promotion ? ` · ${line.promotion.label} · ${line.promotion.eligibility}` : line.included ? " · preço B2B normal" : ""}
                      </li>
                    ))}
                  </ul>
                  {evaluation.warnings.length > 0 && (
                    <div role="alert" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                      <p>Atenção antes de gerar:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 font-semibold">
                        {evaluation.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call(false)}
                    className="w-full rounded-full bg-[#1f6b3a] px-6 py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {busy ? "Gerando…" : evaluation.warnings.length > 0 ? "Gerar link mesmo assim" : "Gerar link"}
                  </button>
                </div>
              )}
            </>
          )}

          {result && <LinkSharePanel url={result.url} whatsappUrl={result.whatsappUrl} clientName={result.clientName} demo={demo} />}
          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function TemplatesPanel({
  templates,
  clients,
  demo = false,
}: {
  templates: TemplateView[];
  clients: Array<{ id: string; displayName: string }>;
  demo?: boolean;
}) {
  if (templates.length === 0) {
    return (
      <p className="rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
        Você ainda não tem ofertas padrão. Crie a primeira: escolha as linhas e a promoção de cada uma.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} clients={clients} demo={demo} />
      ))}
    </ul>
  );
}
