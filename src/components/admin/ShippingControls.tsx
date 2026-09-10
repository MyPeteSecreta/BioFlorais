"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ShippingControls({
  orderId,
  initialServiceName,
  initialTrackingCode,
  fulfillmentStatus,
}: {
  orderId: string;
  initialServiceName: string;
  initialTrackingCode: string;
  fulfillmentStatus: string;
}) {
  const router = useRouter();
  const [serviceName, setServiceName] = useState(initialServiceName);
  const [trackingCode, setTrackingCode] = useState(initialTrackingCode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isShipped =
    fulfillmentStatus === "shipped" ||
    fulfillmentStatus === "completed";

  async function save(markAsShipped: boolean) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/shipment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName,
            trackingCode,
            markAsShipped,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.error ?? "Não foi possível salvar.");
        return;
      }

      setMessage(
        markAsShipped
          ? "Pedido marcado como enviado."
          : "Dados de transporte salvos."
      );

      router.refresh();
    } catch {
      setMessage("Erro ao atualizar a expedição.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-7 border-t pt-6">
      <p className="font-extrabold">Expedição e rastreio</p>

      <p className="mt-2 text-sm text-gray-500">
        Informe o serviço de transporte e o código de rastreio.
        O pedido só será marcado como enviado ao clicar em Confirmar envio.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-bold">
            Transportadora / serviço
          </label>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="Ex.: Jadlog — Package"
            className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-bold">
            Código de rastreio
          </label>
          <input
            type="text"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="Código de rastreamento"
            className="mt-2 w-full rounded-xl border px-4 py-3 font-mono text-sm"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(false)}
          className="rounded-full border px-6 py-3 text-sm font-extrabold disabled:opacity-50"
        >
          Salvar transporte
        </button>

        {!isShipped && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="rounded-full bg-black px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Confirmar envio
          </button>
        )}

        {isShipped && (
          <span className="rounded-full bg-emerald-100 px-5 py-3 text-sm font-extrabold">
            ✓ Pedido enviado
          </span>
        )}
      </div>

      {message && (
        <p className="mt-3 text-sm font-bold">{message}</p>
      )}
    </div>
  );
}
