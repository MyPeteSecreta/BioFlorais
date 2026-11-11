"use client";

/** Admin do pedido: libera para separação um pedido B2B no boleto a prazo que ficou parado aguardando pagamento. */

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReleaseBoletoButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function release() {
    if (!window.confirm("Liberar este pedido para separação? O boleto a prazo continua em Boletos a receber.")) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/release-boleto`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "Não foi possível liberar.");
        return;
      }

      setMessage("Liberado para separação.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4" data-testid="liberar-boleto">
      <p className="text-sm font-bold text-amber-950">Boleto a prazo: este pedido está parado aguardando pagamento.</p>
      <p className="mt-1 text-xs text-amber-900">No boleto a prazo a mercadoria é separada e enviada antes do pagamento; as parcelas ficam em Boletos a receber.</p>
      <button type="button" onClick={release} disabled={busy} className="mt-3 rounded-full bg-[#26352c] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50" data-testid="liberar-boleto-botao">
        {busy ? "Liberando..." : "Liberar para separação (boleto a prazo)"}
      </button>
      {message ? <p role="status" className="mt-2 text-sm font-bold text-amber-950">{message}</p> : null}
    </div>
  );
}
