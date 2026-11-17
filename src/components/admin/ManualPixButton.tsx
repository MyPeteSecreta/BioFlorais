"use client";

/** Admin do pedido: baixa manual de Pix recebido fora do site (transferência ou cobrança direta). Regras em src/lib/admin/manual-pix.ts. */

import { useRouter } from "next/navigation";
import { useState } from "react";

const toCents = (value: string) => {
  const clean = value.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const number = Number(clean);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
};

export default function ManualPixButton({ orderId, totalCents }: { orderId: string; totalCents: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [by, setBy] = useState("");
  const [amount, setAmount] = useState((totalCents / 100).toFixed(2).replace(".", ","));
  const [receivedOn, setReceivedOn] = useState(() => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Confirmar a baixa: Pix de R$ ${amount} recebido em ${receivedOn.split("-").reverse().join("/")}? O pedido vira PAGO e vai para a separação.`)) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/manual-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by, amountCents: toCents(amount), receivedOn, reference }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "Não foi possível dar a baixa.");
        return;
      }

      setMessage("Baixa registrada: pedido pago.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border border-[#d9cbd6] bg-white px-3 py-2 text-sm";

  return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4" data-testid="baixa-pix-manual">
      <p className="text-sm font-bold text-emerald-950">Pix recebido fora do site?</p>
      <p className="mt-1 text-xs text-emerald-900">
        Use só quando o dinheiro já caiu na conta (transferência ou cobrança direta). Fica registrado quem, quando, o valor e o comprovante.
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-full bg-[#26352c] px-5 py-2.5 text-sm font-extrabold text-white" data-testid="baixa-pix-abrir">
          Dar baixa: Pix recebido fora do site
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-emerald-950">
            Quem está dando a baixa
            <input required value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} className={field} placeholder="Seu nome" />
          </label>
          <label className="text-xs font-bold text-emerald-950">
            Valor recebido (R$)
            <input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </label>
          <label className="text-xs font-bold text-emerald-950">
            Data do recebimento
            <input required type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={field} />
          </label>
          <label className="text-xs font-bold text-emerald-950">
            Referência do comprovante
            <input required value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={field} placeholder="ID do Pix (E2E) ou banco + horário" />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-full bg-[#26352c] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50" data-testid="baixa-pix-confirmar">
              {busy ? "Registrando..." : "Registrar a baixa"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[#26352c] px-5 py-2.5 text-sm font-bold text-[#26352c]">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {message ? <p role="status" className="mt-2 text-sm font-bold text-emerald-950">{message}</p> : null}
    </div>
  );
}
