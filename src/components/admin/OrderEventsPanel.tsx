"use client";

/**
 * Admin do pedido: "Marcar em separação", "Marcar enviado" (transportadora +
 * rastreio + link) e "Marcar entregue", com histórico (data e quem fez).
 * É o que alimenta a página "Acompanhe seu pedido" do cliente.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type EventRow = {
  event: string;
  carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

const LABEL: Record<string, string> = { separating: "Em separação", shipped: "Enviado", delivered: "Entregue" };
const field = "w-full rounded-xl border border-[#e5dccf] bg-white px-3 py-2 text-sm";

export default function OrderEventsPanel({
  orderId,
  paymentApproved,
  fulfillmentStatus,
  initialCarrier,
  initialTracking,
}: {
  orderId: string;
  paymentApproved: boolean;
  fulfillmentStatus: string;
  initialCarrier: string;
  initialTracking: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [shipping, setShipping] = useState(false);
  const [carrier, setCarrier] = useState(initialCarrier);
  const [tracking, setTracking] = useState(initialTracking);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders/${orderId}/events`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setEvents(data.events ?? []);
  }, [orderId]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function send(event: "separating" | "shipped" | "delivered", extra: Record<string, string> = {}) {
    setBusy(true);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, ...extra }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResult({ ok: false, text: data.error ?? "Erro ao registrar." });
        return;
      }

      setResult({ ok: true, text: `Registrado: ${LABEL[event]}.` });
      setShipping(false);
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function submitShipped(e: FormEvent) {
    e.preventDefault();
    void send("shipped", { carrier, trackingCode: tracking, trackingUrl: url });
  }

  const btn = "rounded-full px-5 py-2.5 text-sm font-extrabold disabled:opacity-40";

  return (
    <div className="mt-8 rounded-3xl border border-[#e5dccf] bg-white p-5">
      <h2 className="text-lg font-extrabold text-[#26352c]">Andamento para o cliente</h2>
      <p className="mt-1 text-sm text-[#26352c]/70">
        O cliente acompanha estes passos na página &quot;Acompanhe seu pedido&quot;.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={!paymentApproved || busy} onClick={() => send("separating")} className={`${btn} border-2 border-[#26352c] text-[#26352c]`}>
          Marcar em separação
        </button>
        <button type="button" disabled={!paymentApproved || busy} onClick={() => setShipping((value) => !value)} className={`${btn} bg-[#26352c] text-white`}>
          Marcar enviado
        </button>
        <button
          type="button"
          disabled={!paymentApproved || busy || !["shipped", "delivered"].includes(fulfillmentStatus)}
          onClick={() => send("delivered")}
          className={`${btn} bg-[#1f6b3a] text-white`}
        >
          Marcar entregue
        </button>
      </div>
      {!paymentApproved && (
        <p className="mt-2 text-xs font-bold text-amber-800">Disponível depois que o pagamento for confirmado.</p>
      )}

      {shipping && (
        <form onSubmit={submitShipped} className="mt-4 grid gap-3 rounded-2xl bg-[#faf8f3] p-4 sm:grid-cols-3">
          <label className="text-xs font-bold">
            Transportadora
            <input className={field} required value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </label>
          <label className="text-xs font-bold">
            Código de rastreio
            <input className={field} required value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </label>
          <label className="text-xs font-bold">
            Link de rastreio (opcional)
            <input className={field} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className={`${btn} bg-[#26352c] text-white`}>
              {busy ? "Salvando…" : "Confirmar envio"}
            </button>
          </div>
        </form>
      )}

      {result && (
        <p
          role="alert"
          className={`mt-3 rounded-xl p-3 text-sm font-bold ${result.ok ? "bg-[#e3f5e9] text-[#1f6b3a]" : "bg-red-100 text-red-800"}`}
        >
          {result.ok ? "✓ " : "✕ "}
          {result.text}
        </p>
      )}

      <h3 className="mt-5 text-sm font-extrabold">Histórico</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {events.length === 0 && <li className="text-[#26352c]/60">Nenhum registro ainda.</li>}
        {events.map((event, index) => (
          <li key={index}>
            <strong>{LABEL[event.event] ?? event.event}</strong> ·{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(`${event.created_at}Z`))}
            {" · "}por {event.created_by ?? "admin"}
            {event.carrier ? ` · ${event.carrier}` : ""}
            {event.tracking_code ? ` · ${event.tracking_code}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
