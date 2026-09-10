"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EDITABLE_OPTIONS = [
  { value: "paid_to_prepare", label: "A preparar" },
  { value: "separating", label: "Em separação" },
  { value: "ready_to_ship", label: "Pronto para envio" },
  { value: "cancelled", label: "Cancelado" },
];

function statusLabel(status: string) {
  switch (status) {
    case "awaiting_payment": return "Aguardando pagamento";
    case "paid_to_prepare": return "A preparar";
    case "separating": return "Em separação";
    case "ready_to_ship": return "Pronto para envio";
    case "shipped": return "Enviado";
    case "completed": return "Concluído";
    case "cancelled": return "Cancelado";
    default: return status;
  }
}

export default function FulfillmentControls({
  orderId,
  currentStatus,
  paymentApproved,
}: {
  orderId: string;
  currentStatus: string;
  paymentApproved: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const locked =
    currentStatus === "shipped" ||
    currentStatus === "completed";

  async function saveStatus() {
    if (locked) return;

    if (!paymentApproved && status !== "cancelled") {
      setMessage("Pedido ainda não está pago.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/fulfillment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.error ?? "Não foi possível atualizar.");
        return;
      }

      setMessage("Status atualizado.");
      router.refresh();
    } catch {
      setMessage("Erro ao atualizar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5">
      <label className="text-sm font-bold">
        Andamento operacional
      </label>

      {locked ? (
        <div className="mt-2">
          <div className="inline-flex rounded-full bg-emerald-100 px-5 py-3 text-sm font-extrabold">
            {statusLabel(currentStatus)}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Este pedido já entrou no fluxo de envio e não pode voltar para uma etapa anterior.
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm font-bold"
          >
            {!paymentApproved && (
              <option value="awaiting_payment">
                Aguardando pagamento
              </option>
            )}

            {EDITABLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={saveStatus}
            disabled={saving}
            className="rounded-full bg-black px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Atualizar andamento"}
          </button>
        </div>
      )}

      {message && (
        <p className="mt-2 text-sm font-bold">{message}</p>
      )}
    </div>
  );
}
