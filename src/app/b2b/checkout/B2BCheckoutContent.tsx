"use client";

/**
 * BIO FLORAIS B2B — checkout.
 *
 * Nenhum valor é calculado aqui: subtotal, cupom, frete e o total final
 * de cada forma de pagamento vêm prontos de /api/b2b/shipping/quote
 * (mesma função do servidor que grava o pedido). O percentual de
 * desconto por método nunca é exibido — só o valor final.
 *
 * 1. POST /api/b2b/orders/create -> pedido "pending" travado no método.
 * 2. pix    -> /api/b2b/payments/lunium/pix (QR + polling de status)
 *    card   -> Card Brick -> /api/b2b/payments/mercadopago/card
 *    boleto -> /api/b2b/payments/boleto (solicitação, até 3x)
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import B2BMercadoPagoCardPayment from "@/components/payments/B2BMercadoPagoCardPayment";
import { useB2BCart } from "@/lib/b2b/cart-context";
import { formatB2BCents } from "@/lib/b2b/format";
import {
  B2B_MAX_INSTALLMENTS,
  B2B_MIN_INSTALLMENT_CENTS,
  resolveB2BAllowedInstallments,
  splitB2BInstallments,
  type B2BPaymentMethod,
} from "@/lib/b2b/pricing";

type ShippingOption = {
  serviceName: string;
  etaDays: number;
  priceCents: number;
  totalsByPaymentMethod: Record<B2BPaymentMethod, number>;
};

type Quote = {
  requestKey: string;
  couponCode: string | null;
  subtotalCents: number;
  couponDiscountCents: number;
  subtotalAfterCouponCents: number;
  bonusLines: Array<{ productId: string; qty: number }>;
  options: ShippingOption[];
};

type CreatedOrder = {
  id: string;
  paymentMethod: B2BPaymentMethod;
  installments: number;
  totalCents: number;
};

type PixData = {
  qrCode: string;
  qrImageUrl: string | null;
};

const METHOD_LABELS: Record<B2BPaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão de crédito",
  boleto: "Boleto",
};

const inputClass =
  "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#63326d]";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export default function B2BCheckoutContent() {
  const token = useSearchParams().get("b2b") ?? "";
  const cart = useB2BCart();

  const [personType, setPersonType] = useState<"pf" | "pj">("pj");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");

  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [serviceName, setServiceName] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<B2BPaymentMethod>("pix");
  const [boletoInstallments, setBoletoInstallments] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [finalMessage, setFinalMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const lines = cart.state.offerToken === token ? cart.state.lines : [];
  const itemsPayload = lines.map((line) => ({ productId: line.productId, qty: line.qty }));
  const cepDigits = onlyDigits(cep);
  const requestKey = JSON.stringify([token, itemsPayload, cepDigits, uf, appliedCoupon]);

  // ---- CEP -> endereço (conveniência; a UF é conferida no servidor)
  useEffect(() => {
    if (cepDigits.length !== 8) return;

    const controller = new AbortController();

    fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: unknown }) => {
        if (data.erro) return;
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setDistrict(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setUf(data.uf.toUpperCase());
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [cepDigits]);

  // ---- Cotação autoritativa
  const lastRequestKey = useRef("");

  const fetchQuote = useCallback(async () => {
    if (!token || itemsPayload.length === 0 || cepDigits.length !== 8 || uf.length !== 2) {
      return;
    }

    lastRequestKey.current = requestKey;
    setQuoting(true);
    setQuoteError("");

    try {
      const response = await fetch("/api/b2b/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          b2bToken: token,
          cep: cepDigits,
          state: uf,
          couponCode: appliedCoupon || null,
          items: itemsPayload,
        }),
      });

      const data = await response.json();

      if (lastRequestKey.current !== requestKey) return;

      if (!response.ok) {
        setQuote(null);
        setQuoteError(data.error ?? "Não foi possível calcular o frete.");
        return;
      }

      setQuote({ ...data, requestKey });
      setServiceName((current) =>
        data.options.some((option: ShippingOption) => option.serviceName === current)
          ? current
          : data.options[0]?.serviceName ?? ""
      );
    } catch {
      if (lastRequestKey.current === requestKey) {
        setQuote(null);
        setQuoteError("Não foi possível calcular o frete.");
      }
    } finally {
      if (lastRequestKey.current === requestKey) setQuoting(false);
    }
    // requestKey resume todas as entradas da cotação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => {
    if (order) return;
    const timer = window.setTimeout(fetchQuote, 400);
    return () => window.clearTimeout(timer);
  }, [fetchQuote, order]);

  const quoteIsCurrent = quote?.requestKey === requestKey;
  const chosen = quoteIsCurrent
    ? quote?.options.find((option) => option.serviceName === serviceName) ?? null
    : null;
  const totals = chosen?.totalsByPaymentMethod ?? null;
  const allowedBoletoInstallments = resolveB2BAllowedInstallments(totals?.boleto ?? 0);
  const effectiveBoletoInstallments = Math.min(boletoInstallments, allowedBoletoInstallments);

  // ---- Polling do Pix
  useEffect(() => {
    if (!order || order.paymentMethod !== "pix" || !pix || finalMessage) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}/status`, { cache: "no-store" });
        const data = await response.json();

        if (data?.paid) {
          setFinalMessage({ ok: true, text: "Pagamento Pix confirmado. Obrigado pelo pedido!" });
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [order, pix, finalMessage]);

  async function startPix(orderId: string) {
    /*
     * Mesma chave do checkout B2C: enquanto NEXT_PUBLIC_PIX_PROVIDER não
     * for "lunium", o Pix sai pelo Mercado Pago. As duas rotas B2B
     * devolvem o mesmo formato ({ pix: { qrCode, qrImageUrl } }).
     */
    const pixRoute =
      process.env.NEXT_PUBLIC_PIX_PROVIDER === "lunium"
        ? "/api/b2b/payments/lunium/pix"
        : "/api/b2b/payments/mercadopago/pix";

    const response = await fetch(pixRoute, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, b2bToken: token }),
    });

    const data = await response.json();

    if (!response.ok || !data?.pix?.qrCode) {
      setError(data?.error ?? "Não foi possível gerar o Pix.");
      return;
    }

    setPix({ qrCode: data.pix.qrCode, qrImageUrl: data.pix.qrImageUrl ?? null });
  }

  async function startBoleto(orderId: string, installments: number) {
    const response = await fetch("/api/b2b/payments/boleto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, b2bToken: token, installments }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data?.error ?? "Não foi possível registrar a solicitação de boleto.");
      return;
    }

    setFinalMessage({ ok: true, text: data.message });
  }

  async function handleConfirm() {
    setError("");

    if (!chosen || !totals) {
      setError("Informe o CEP e escolha o frete antes de continuar.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/b2b/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          b2bToken: token,
          customer: { personType, name, email, phone, cpf, cnpj, stateRegistration },
          address: { cep: cepDigits, street, number, complement, district, city, state: uf },
          items: itemsPayload,
          couponCode: appliedCoupon || null,
          paymentMethod,
          installments: paymentMethod === "boleto" ? effectiveBoletoInstallments : 1,
          shipping: { serviceName: chosen.serviceName },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível criar o pedido.");
        return;
      }

      const created: CreatedOrder = {
        id: data.order.id,
        paymentMethod: data.order.paymentMethod,
        installments: data.order.installments,
        totalCents: data.order.totalCents,
      };

      setOrder(created);
      cart.clear();

      if (created.paymentMethod === "pix") await startPix(created.id);
      if (created.paymentMethod === "boleto") await startBoleto(created.id, created.installments);
    } catch {
      setError("Não foi possível criar o pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------ render

  if (!token) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Link de oferta ausente. Abra o link enviado pelo seu representante.</p>
      </main>
    );
  }

  if (finalMessage) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <h1 className="font-serif text-3xl font-semibold text-[#55245f]">
          {finalMessage.ok ? "Pedido recebido" : "Atenção"}
        </h1>
        <p className="mx-auto mt-3 max-w-md">{finalMessage.text}</p>
        {order && (
          <p className="mt-2 text-sm text-[#8a7886]">
            Pedido {order.id.slice(0, 8).toUpperCase()} · {formatB2BCents(order.totalCents)}
          </p>
        )}
        <Link
          href={`/b2b/oferta/${encodeURIComponent(token)}`}
          className="mt-6 inline-block text-sm font-bold text-[#63326d] underline underline-offset-4"
        >
          Voltar à oferta
        </Link>
      </main>
    );
  }

  if (order) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
        <div className="mx-auto max-w-xl">
          <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Pagamento</h1>
          <p className="mt-1 text-sm text-[#8a7886]">
            Pedido {order.id.slice(0, 8).toUpperCase()} · {METHOD_LABELS[order.paymentMethod]} ·{" "}
            {formatB2BCents(order.totalCents)}
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
              {error}
            </p>
          )}

          <div className="mt-6">
            {order.paymentMethod === "card" && (
              <B2BMercadoPagoCardPayment
                orderId={order.id}
                b2bToken={token}
                amountCents={order.totalCents}
                payerEmail={email.trim().toLowerCase()}
                onStatusChange={(status) => {
                  if (status === "paid" || status === "authorized") {
                    setFinalMessage({ ok: true, text: "Pagamento aprovado. Obrigado pelo pedido!" });
                  } else if (status === "pending") {
                    setFinalMessage({
                      ok: true,
                      text: "Pagamento em análise pelo Mercado Pago. Avisaremos quando for aprovado.",
                    });
                  } else {
                    setError("Pagamento não aprovado. Confira os dados ou use outro cartão.");
                  }
                }}
              />
            )}

            {order.paymentMethod === "pix" && pix && (
              <section className="rounded-[20px] border border-[#eadfd9] bg-white p-5 text-center">
                <h2 className="text-lg font-bold">Pague com Pix</h2>
                {pix.qrImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pix.qrImageUrl} alt="QR Code Pix" className="mx-auto mt-4 h-56 w-56" />
                )}
                <textarea
                  readOnly
                  value={pix.qrCode}
                  className="mt-4 h-24 w-full rounded-xl border border-[#d9c7dc] p-2 text-xs"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pix.qrCode);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="mt-3 w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white"
                >
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </button>
                <p className="mt-3 text-xs text-[#8a7886]">
                  Aguardando confirmação do pagamento… esta tela atualiza sozinha.
                </p>
              </section>
            )}

            {order.paymentMethod === "pix" && !pix && !error && (
              <p className="text-sm">Gerando o Pix…</p>
            )}

            {order.paymentMethod === "pix" && !pix && error && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  void startPix(order.id);
                }}
                className="rounded-full bg-[#55245f] px-5 py-3 text-sm font-extrabold text-white"
              >
                Tentar gerar o Pix novamente
              </button>
            )}

            {order.paymentMethod === "boleto" && error && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  void startBoleto(order.id, order.installments);
                }}
                className="rounded-full bg-[#55245f] px-5 py-3 text-sm font-extrabold text-white"
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (cart.hydrated && lines.length === 0) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Seu pedido está vazio.</p>
        <Link
          href={`/b2b/oferta/${encodeURIComponent(token)}`}
          className="mt-4 inline-block text-sm font-bold text-[#63326d] underline underline-offset-4"
        >
          Escolher produtos
        </Link>
      </main>
    );
  }

  const bonusByProduct = new Map((quoteIsCurrent ? quote?.bonusLines ?? [] : []).map((b) => [b.productId, b.qty]));

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div>
            <Link
              href={`/b2b/carrinho?b2b=${encodeURIComponent(token)}`}
              className="text-sm font-bold text-[#63326d] underline underline-offset-4"
            >
              ← Voltar ao pedido
            </Link>
            <h1 className="mt-4 font-serif text-3xl font-semibold text-[#55245f]">Checkout B2B</h1>
          </div>

          <section className="space-y-3">
            <h2 className="font-bold">Dados do comprador</h2>
            <div className="flex gap-2">
              {(["pj", "pf"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPersonType(type)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${
                    personType === type
                      ? "border-[#55245f] bg-[#55245f] text-white"
                      : "border-[#d9c7dc] bg-white"
                  }`}
                >
                  {type === "pj" ? "Pessoa jurídica" : "Pessoa física"}
                </button>
              ))}
            </div>
            <input className={inputClass} placeholder={personType === "pj" ? "Razão social" : "Nome completo"} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputClass} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={inputClass} inputMode="tel" placeholder="Celular com DDD" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {personType === "pj" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} inputMode="numeric" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                <input className={inputClass} placeholder="Inscrição estadual" value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} />
              </div>
            ) : (
              <input className={inputClass} inputMode="numeric" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-bold">Endereço de entrega</h2>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_80px]">
              <input className={inputClass} inputMode="numeric" placeholder="CEP" value={cep} onChange={(e) => setCep(e.target.value)} />
              <input className={inputClass} placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className={inputClass} placeholder="UF" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
            </div>
            <input className={inputClass} placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <input className={inputClass} placeholder="Número" value={number} onChange={(e) => setNumber(e.target.value)} />
              <input className={inputClass} placeholder="Bairro" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
            <input className={inputClass} placeholder="Complemento (opcional)" value={complement} onChange={(e) => setComplement(e.target.value)} />
          </section>

          <section className="space-y-3">
            <h2 className="font-bold">Frete</h2>
            {quoting && <p className="text-sm text-[#8a7886]">Calculando frete…</p>}
            {!quoting && quoteError && <p className="text-sm text-red-700">{quoteError}</p>}
            {!quoting && !quoteError && !quoteIsCurrent && (
              <p className="text-sm text-[#8a7886]">Informe CEP e UF para calcular o frete.</p>
            )}
            {quoteIsCurrent &&
              quote?.options.map((option) => (
                <label
                  key={option.serviceName}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                    option.serviceName === serviceName ? "border-[#55245f] bg-white" : "border-[#d9c7dc] bg-white/60"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="shipping"
                      checked={option.serviceName === serviceName}
                      onChange={() => setServiceName(option.serviceName)}
                    />
                    {option.serviceName} · {option.etaDays} dia(s) úteis
                  </span>
                  <strong>{formatB2BCents(option.priceCents)}</strong>
                </label>
              ))}
          </section>

          <section className="space-y-3">
            <h2 className="font-bold">Cupom B2B (opcional)</h2>
            <div className="flex gap-2">
              <input className={inputClass} placeholder="Código do cupom" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
              <button
                type="button"
                onClick={() => setAppliedCoupon(couponInput.trim().toUpperCase())}
                className="rounded-xl border border-[#55245f] px-4 text-sm font-bold text-[#55245f]"
              >
                Aplicar
              </button>
            </div>
            {appliedCoupon && (
              <button type="button" onClick={() => { setAppliedCoupon(""); setCouponInput(""); }} className="text-xs font-bold text-[#a33]">
                Remover cupom {appliedCoupon}
              </button>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-bold">Forma de pagamento</h2>
            {(["pix", "card", "boleto"] as const).map((method) => (
              <label
                key={method}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                  method === paymentMethod ? "border-[#55245f] bg-white" : "border-[#d9c7dc] bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="payment" checked={method === paymentMethod} onChange={() => setPaymentMethod(method)} />
                  {METHOD_LABELS[method]}
                  {method !== "pix" && (
                    <span className="text-xs text-[#8a7886]">
                      até {B2B_MAX_INSTALLMENTS}x (parcela mín. {formatB2BCents(B2B_MIN_INSTALLMENT_CENTS)})
                    </span>
                  )}
                </span>
                <strong>{totals ? formatB2BCents(totals[method]) : "—"}</strong>
              </label>
            ))}

            {paymentMethod === "boleto" && totals && (
              <div className="rounded-xl border border-[#d9c7dc] bg-white p-3 text-sm">
                <p className="mb-2 font-bold">Parcelas do boleto</p>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => {
                    const { installmentAmountCents, lastInstallmentAmountCents } = splitB2BInstallments(totals.boleto, n);
                    const enabled = n <= allowedBoletoInstallments;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={!enabled}
                        onClick={() => setBoletoInstallments(n)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold disabled:opacity-40 ${
                          n === effectiveBoletoInstallments ? "border-[#55245f] bg-[#f6eef7]" : "border-[#d9c7dc]"
                        }`}
                      >
                        {n}x {formatB2BCents(installmentAmountCents)}
                        {lastInstallmentAmountCents !== installmentAmountCents && (
                          <span className="block font-normal">última {formatB2BCents(lastInstallmentAmountCents)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-[#8a7886]">
                  O boleto é emitido pela nossa equipe e enviado para o e-mail informado.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-[20px] border border-[#eadfd9] bg-white p-5 lg:sticky lg:top-6">
          <h2 className="font-bold">Resumo</h2>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-3">
                <span>
                  {line.qty}× {line.name}
                  {bonusByProduct.get(line.productId) ? (
                    <span className="block text-xs font-bold text-[#2f7a4a]">
                      + {bonusByProduct.get(line.productId)} grátis
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0">{formatB2BCents(line.priceCents * line.qty)}</span>
              </li>
            ))}
          </ul>

          {quoteIsCurrent && quote && (
            <div className="space-y-1 border-t border-[#eadfd9] pt-3 text-sm">
              <div className="flex justify-between"><span>Produtos</span><span>{formatB2BCents(quote.subtotalCents)}</span></div>
              {quote.couponDiscountCents > 0 && (
                <div className="flex justify-between text-[#2f7a4a]"><span>Cupom {quote.couponCode}</span><span>−{formatB2BCents(quote.couponDiscountCents)}</span></div>
              )}
              {chosen && (
                <div className="flex justify-between"><span>Frete</span><span>{formatB2BCents(chosen.priceCents)}</span></div>
              )}
            </div>
          )}

          <div className="flex items-end justify-between border-t border-[#eadfd9] pt-3">
            <span className="text-sm font-bold">Total no {METHOD_LABELS[paymentMethod]}</span>
            <span className="text-2xl font-extrabold text-[#55245f]">
              {totals ? formatB2BCents(totals[paymentMethod]) : "—"}
            </span>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>
          )}

          <button
            type="button"
            disabled={submitting || !chosen || quoting}
            onClick={handleConfirm}
            className="w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {submitting ? "Processando…" : "Confirmar pedido"}
          </button>
        </aside>
      </div>
    </main>
  );
}
