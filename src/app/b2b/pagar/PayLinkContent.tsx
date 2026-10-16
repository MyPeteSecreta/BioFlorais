"use client";

/**
 * BIO FLORAIS B2B — LINK DE PAGAMENTO do pedido no cartão (pedido lançado pelo vendedor).
 * O vendedor nunca digita o cartão do cliente: envia este link e o cliente paga no próprio celular.
 * Autorização = token da oferta do cliente conferido no servidor contra o pedido (pay-info e rota do cartão).
 */

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import B2BMercadoPagoCardPayment from "@/components/payments/B2BMercadoPagoCardPayment";
import { formatB2BCents } from "@/lib/b2b/format";

type PayInfo = { id: string; number: string; paid: boolean; status: string; totalCents: number; paymentMethod: string | null; payerEmail: string };

export default function PayLinkContent() {
  const params = useSearchParams();
  const orderId = params.get("pedido") ?? "";
  const token = params.get("b2b") ?? "";
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!orderId || !token) return;
    let cancelled = false;

    fetch(`/api/b2b/orders/pay-info?pedido=${encodeURIComponent(orderId)}&b2b=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) setError(data?.error ?? "Não foi possível abrir este pedido.");
        else setInfo(data.order as PayInfo);
      })
      .catch(() => !cancelled && setError("Não foi possível abrir este pedido."));

    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  if (!orderId || !token) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Link de pagamento incompleto. Peça um novo link ao seu representante.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto max-w-xl">
        <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Pagamento do pedido</h1>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}

        {info && (
          <>
            <p className="mt-1 text-sm text-[#8a7886]">
              Pedido {info.number} · {formatB2BCents(info.totalCents)}
            </p>

            {info.paid || done?.ok ? (
              <p role="status" className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900" data-testid="pagamento-confirmado">
                {done?.text ?? "Este pedido já está pago. Obrigado!"}
              </p>
            ) : info.paymentMethod !== "card" || info.status !== "pending" ? (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950">
                Este pedido não aceita pagamento por este link. Fale com o seu representante.
              </p>
            ) : (
              <div className="mt-5">
                <B2BMercadoPagoCardPayment
                  orderId={info.id}
                  b2bToken={token}
                  amountCents={info.totalCents}
                  payerEmail={info.payerEmail}
                  onStatusChange={(status) => {
                    if (status === "paid" || status === "authorized") {
                      setDone({ ok: true, text: "Pagamento aprovado. Obrigado pelo pedido!" });
                    } else if (status === "pending") {
                      setDone({ ok: true, text: "Pagamento em análise pelo Mercado Pago. Avisaremos quando for aprovado." });
                    } else {
                      setError("Pagamento não aprovado. Confira os dados ou use outro cartão.");
                    }
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
