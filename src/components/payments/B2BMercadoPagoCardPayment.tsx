"use client";

/**
 * BIO FLORAIS B2B — cartão (Mercado Pago Card Brick).
 * Mesmo brick do B2C, com a regra B2B: até 3x, parcela mínima R$ 500.
 * Posta em /api/b2b/payments/mercadopago/card com o token da oferta.
 */

import { useEffect, useMemo, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

import { formatB2BCents } from "@/lib/b2b/format";
import {
  B2B_MIN_INSTALLMENT_CENTS,
  resolveB2BAllowedInstallments,
} from "@/lib/b2b/pricing";

type Props = {
  orderId: string;
  b2bToken: string;
  amountCents: number;
  payerEmail: string;
  onStatusChange: (status: string) => void;
};

type BrickData = {
  token?: string;
  payment_method_id?: string;
  installments?: number;
};

let initializedPublicKey: string | null = null;

export default function B2BMercadoPagoCardPayment({
  orderId,
  b2bToken,
  amountCents,
  payerEmail,
  onStatusChange,
}: Props) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ?? "";

  useEffect(() => {
    if (!publicKey || initializedPublicKey === publicKey) return;
    initMercadoPago(publicKey, { locale: "pt-BR" });
    initializedPublicKey = publicKey;
  }, [publicKey]);

  const maxInstallments = useMemo(
    () => resolveB2BAllowedInstallments(amountCents),
    [amountCents]
  );

  if (!publicKey) {
    return (
      <div className="rounded-2xl border border-[#eadfd9] bg-white p-5 text-sm">
        Pagamento com cartão temporariamente indisponível.
      </div>
    );
  }

  return (
    <section className="rounded-[20px] border border-[#eadfd9] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#422347]">Cartão de crédito</h2>
          <p className="mt-1 text-xs text-[#8a7886]">
            Até {maxInstallments}x · parcela mínima de {formatB2BCents(B2B_MIN_INSTALLMENT_CENTS)}
          </p>
        </div>
        <p className="text-right text-xl font-extrabold text-[#55245f]">
          {formatB2BCents(amountCents)}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {processing && (
        <p className="mt-4 rounded-xl bg-[#fbf5f1] p-3 text-sm">
          Processando o pagamento. Não feche esta página.
        </p>
      )}

      <div className="mt-4">
        <CardPayment
          initialization={{ amount: amountCents / 100, payer: { email: payerEmail } }}
          customization={{
            paymentMethods: { minInstallments: 1, maxInstallments },
          }}
          onSubmit={async (formData) => {
            setError("");
            setProcessing(true);

            try {
              const data = formData as BrickData;

              if (!data.token || !data.payment_method_id || !data.installments) {
                throw new Error("Não foi possível validar os dados do cartão.");
              }

              if (data.installments < 1 || data.installments > maxInstallments) {
                throw new Error("Parcelamento inválido para o valor deste pedido.");
              }

              const response = await fetch("/api/b2b/payments/mercadopago/card", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  b2bToken,
                  cardToken: data.token,
                  paymentMethodId: data.payment_method_id,
                  installments: data.installments,
                }),
              });

              const result = await response.json();

              if (!response.ok) {
                throw new Error(result?.error || "Não foi possível processar o cartão.");
              }

              onStatusChange(result?.payment?.status ?? "pending");
            } catch (submitError) {
              setError(
                submitError instanceof Error
                  ? submitError.message
                  : "Não foi possível processar o cartão."
              );
              throw submitError;
            } finally {
              setProcessing(false);
            }
          }}
          onError={(brickError) => {
            console.error("[b2b/mercadopago/card-brick]", brickError);
            setProcessing(false);
            setError("Não foi possível carregar o formulário do cartão.");
          }}
        />
      </div>
    </section>
  );
}
