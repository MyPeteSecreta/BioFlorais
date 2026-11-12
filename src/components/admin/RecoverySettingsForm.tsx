"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RecoverySettingsForm({ enabled, percent }: { enabled: boolean; percent: number }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pct, setPct] = useState(String(percent));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/recovery-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: on, percent: Number(pct) }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: { percent: number } };

      if (!response.ok) {
        setMessage(data.error ?? "Não foi possível salvar.");
        return;
      }

      setPct(String(data.settings?.percent ?? pct));
      setMessage("Salvo.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="recuperacao-form">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
        Enviar a oferta de desconto 2 dias depois do pedido não pago
      </label>
      <label className="block text-sm font-bold">
        Desconto (%)
        <input
          type="number"
          min={5}
          max={30}
          step={1}
          value={pct}
          onChange={(event) => setPct(event.target.value)}
          className="ml-2 w-20 rounded-xl border border-[#e5dccf] px-3 py-1.5"
        />
        <span className="ml-2 text-xs font-normal text-[#6c5b69]">de 5% a 30%</span>
      </label>
      <button type="button" onClick={save} disabled={busy} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
        {busy ? "Salvando..." : "Salvar"}
      </button>
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
    </div>
  );
}
