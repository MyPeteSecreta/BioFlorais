"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CardPayment,
  initMercadoPago,
} from "@mercadopago/sdk-react";

type Props = {
  orderId: string;
  amountCents: number;
  payerEmail: string;
  onStatusChange?: (status: string) => void;
};

type BrickData = {
  token?: string;
  payment_method_id?: string;
  installments?: number;
  payer?: {
    email?: string;
  };
};

const B2C_MIN_INSTALLMENT_CENTS = 5000;
const B2C_MAX_INSTALLMENTS = 3;

let initializedPublicKey: string | null = null;

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getB2CMaxInstallments(
  amountCents: number
) {
  if (amountCents <= 0) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      B2C_MAX_INSTALLMENTS,
      Math.floor(
        amountCents /
          B2C_MIN_INSTALLMENT_CENTS
      )
    )
  );
}

export default function MercadoPagoCardPayment({
  orderId,
  amountCents,
  payerEmail,
  onStatusChange,
}: Props) {
  const [error, setError] = useState("");
  const [processing, setProcessing] =
    useState(false);

  const publicKey =
    process.env
      .NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
      ?.trim() ?? "";

  useEffect(() => {
    if (
      !publicKey ||
      initializedPublicKey === publicKey
    ) {
      return;
    }

    initMercadoPago(publicKey, {
      locale: "pt-BR",
    });

    initializedPublicKey = publicKey;
  }, [publicKey]);

  const amount = useMemo(
    () => amountCents / 100,
    [amountCents]
  );

  const maxInstallments = useMemo(
    () =>
      getB2CMaxInstallments(
        amountCents
      ),
    [amountCents]
  );


  // BIO_INSTALLMENT_SELECTOR_V2
  // BIO_WIDE_CARD_PAYMENT_V1
  const [selectedInstallments, setSelectedInstallments] =
    useState(1);

  useEffect(() => {
    if (selectedInstallments > maxInstallments) {
      setSelectedInstallments(maxInstallments);
    }
  }, [maxInstallments, selectedInstallments]);

  const installmentOptions = useMemo(
    () =>
      [1, 2, 3].map((installments) => {
        const enabled =
          installments <= maxInstallments;

        return {
          installments,
          enabled,
          installmentCents: Math.ceil(
            amountCents / installments
          ),
          missingCents: Math.max(
            0,
            installments *
              B2C_MIN_INSTALLMENT_CENTS -
              amountCents
          ),
        };
      }),
    [amountCents, maxInstallments]
  );

  const installmentText =
    "Escolha abaixo a quantidade de parcelas.";

  if (!publicKey) {
    return (
      <div className="rounded-2xl border border-amber-900/10 bg-white p-5 text-sm text-[#26352c]/70 shadow-sm">
        Pagamento com cartão temporariamente indisponível.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#26352c]/10 bg-white shadow-[0_18px_50px_rgba(38,53,44,0.08)]">
      <header className="border-b border-[#26352c]/10 bg-[#f7f4ed] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b7445]">
              Pagamento seguro
            </p>

            <h3 className="mt-1 text-lg font-semibold text-[#26352c]">
              Cartão de crédito
            </h3>

            <p className="mt-1 text-sm text-[#26352c]/65">
              {installmentText}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-[#26352c]/55">
              Total do pedido
            </p>

            <p className="text-xl font-semibold text-[#26352c]">
              {formatBRL(amountCents)}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#26352c]">
                Escolha o parcelamento
              </p>
              <p className="mt-1 text-xs text-[#26352c]/55">
                Parcela mínima de R$ 50,00 • máximo de 3x
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {installmentOptions.map((option) => {
              const selected =
                selectedInstallments === option.installments;

              return (
                <button
                  key={option.installments}
                  type="button"
                  disabled={!option.enabled || processing}
                  onClick={() => {
                    if (!option.enabled) return;
                    setError("");
                    setSelectedInstallments(option.installments);
                  }}
                  aria-pressed={selected}
                  className={[
                    "min-w-0 rounded-xl border px-3 py-3 text-center transition",
                    option.enabled
                      ? "cursor-pointer"
                      : "cursor-not-allowed bg-[#f7f4ed]/60 opacity-45",
                    selected
                      ? "border-[#8b7445] bg-[#faf8f3] shadow-sm"
                      : "border-[#26352c]/10 bg-white",
                  ].join(" ")}
                >
                  <span className="block text-base font-semibold text-[#26352c]">
                    {option.installments}x
                  </span>

                  <span className="mt-1 block whitespace-nowrap text-xs text-[#26352c]/70">
                    {formatBRL(option.installmentCents)}
                  </span>
                </button>
              );
            })}
          </div>

          {installmentOptions
            .filter((option) => !option.enabled)
            .map((option) => (
              <p
                key={`unlock-${option.installments}`}
                className="mt-2 text-xs leading-5 text-[#8b7445]"
              >
                Faltam{" "}
                <strong>
                  {formatBRL(option.missingCents)}
                </strong>{" "}
                no pedido para liberar {option.installments}x.
              </p>
            ))}
        </div>
        <div className="mb-5 flex gap-3 rounded-2xl border border-[#8b7445]/15 bg-[#faf8f3] p-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#8b7445] shadow-sm"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
              />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-medium text-[#26352c]">
              Ambiente seguro
            </p>

            <p className="mt-0.5 text-xs leading-5 text-[#26352c]/60">
              Seus dados de cartão são processados com segurança
              pelo Mercado Pago. A Bio Florais não armazena o
              número completo do cartão nem o código de segurança.
            </p>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-900/10 bg-red-50 p-4 text-sm text-red-900"
          >
            {error}
          </div>
        ) : null}

        {processing ? (
          <div className="mb-5 rounded-2xl border border-[#26352c]/10 bg-[#f7f4ed] p-4 text-sm text-[#26352c]/75">
            Processando seu pagamento com segurança. Não feche esta página.
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#26352c]/10 bg-white p-3 sm:p-4">
          <CardPayment
            initialization={{
              amount,
              payer: {
                email: payerEmail,
              },
            }}
            customization={{
              paymentMethods: {
                minInstallments: 1,
                maxInstallments,
              },
            }}
            onSubmit={async (formData) => {
              setError("");
              setProcessing(true);

              try {
                const data =
                  formData as BrickData;

                if (
                  !data.token ||
                  !data.payment_method_id ||
                  !data.installments
                ) {
                  throw new Error(
                    "Não foi possível validar os dados do cartão."
                  );
                }

                if (
                  data.installments < 1 || data.installments > maxInstallments
                ) {
                  throw new Error(
                    "Parcelamento inválido para o valor deste pedido."
                  );
                }

                const response =
                  await fetch(
                    "/api/payments/mercadopago/card",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                      },
                      body: JSON.stringify({
                        orderId,
                        cardToken:
                          data.token,
                        paymentMethodId:
                          data.payment_method_id,
                        installments:
                          data.installments,
                        payerEmail:
                          data.payer?.email ||
                          payerEmail,
                        idempotencyKey:
                          crypto.randomUUID(),
                      }),
                    }
                  );

                const result =
                  await response.json();

                if (!response.ok) {
                  throw new Error(
                    result?.error ||
                      "Não foi possível processar o cartão."
                  );
                }

                const status =
                  result?.payment?.status ??
                  "pending";

                onStatusChange?.(
                  status
                );

                return result;
              } catch (submitError) {
                const message =
                  submitError instanceof Error
                    ? submitError.message
                    : "Não foi possível processar o cartão.";

                setError(message);
                throw submitError;
              } finally {
                setProcessing(false);
              }
            }}
            onReady={() => {
              setError("");
            }}
            onError={(brickError) => {
              console.error(
                "[mercadopago/card-brick]",
                brickError
              );

              setProcessing(false);

              setError(
                "Não foi possível carregar o formulário do cartão."
              );
            }}
          />
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-[#26352c]/50">
          Compra protegida • Processamento seguro pelo Mercado Pago
        </p>
      </div>
    </section>
  );
}
