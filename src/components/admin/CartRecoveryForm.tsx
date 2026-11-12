"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CartRecoveryForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/cart-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: on }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "Não foi possível salvar.");
        return;
      }

      setMessage("Salvo.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="carrinho-abandonado-form">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
        Mostrar a caixa de aceite no checkout e enviar os lembretes da sacola
      </label>
      <button type="button" onClick={save} disabled={busy} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
        {busy ? "Salvando..." : "Salvar"}
      </button>
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
    </div>
  );
}
