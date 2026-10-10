"use client";

/** Detalhe do pedido: "Marcar como teste e arquivar" (com confirmação; pago real pede confirmação extra). */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { archiveOrdersAsTest } from "./archive-orders";

export default function ArchiveOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function archive() {
    setBusy(true);
    setMessage("");

    try {
      const outcome = await archiveOrdersAsTest([orderId]);

      if (outcome.cancelled) return;

      setMessage(outcome.message);

      if (outcome.archived > 0) router.push("/admin/pedidos");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={busy}
        onClick={archive}
        className="rounded-full border-2 border-[#b33] px-6 py-3 text-sm font-extrabold text-[#b33] disabled:opacity-50"
      >
        {busy ? "Arquivando…" : "Marcar como teste e arquivar"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm font-bold text-stone-700">
          {message}
        </p>
      )}
    </div>
  );
}
