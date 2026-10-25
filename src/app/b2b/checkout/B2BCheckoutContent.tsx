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
import ReorderLink from "@/components/b2b/ReorderLink";
import TrackOrderCard from "@/components/TrackOrderCard";
import AdsPurchaseTag from "@/components/consent/AdsPurchaseTag";
import PurchaseMeasurement from "@/components/measurement/PurchaseMeasurement";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import B2BMercadoPagoCardPayment from "@/components/payments/B2BMercadoPagoCardPayment";
import { cartLineUnitCents, useB2BCart } from "@/lib/b2b/cart-context";
import PrintOrderButton from "@/components/b2b/PrintOrderButton";
import QtyStepper from "@/components/b2b/QtyStepper";
import { formatB2BCents } from "@/lib/b2b/format";
import { buildReviewSheet } from "@/lib/b2b/order-sheet";
import QuoteActions from "@/components/b2b/QuoteActions";
import { continueQuotePath, printQuotePath, tokenFromOfferUrl } from "@/lib/b2b/quote-links";
import { clearQuoteDraft, readQuoteDraft } from "@/lib/b2b/quote-draft";
import CheckoutBenefitsBar from "@/components/checkout/CheckoutBenefitsBar";
import CheckoutTopStrip from "@/components/checkout/CheckoutTopStrip";
import { buildCheckoutBenefits, buildCheckoutTopStrip } from "@/lib/checkout/benefits";
import { B2B_FREIGHT_FLAT_THRESHOLD_CENTS, B2B_MIN_ORDER_CENTS, B2B_PAYMENT_METHOD_DISCOUNT_PERCENT } from "@/lib/b2b/pricing";
import { COMPLEMENT_HELP, ORDER_NOTE_MAX, validateComplement } from "@/lib/order-note";
import { buildCardPayLinkPath, launchStorageKey } from "@/lib/b2b/launch-constants";
import {
  B2B_MAX_INSTALLMENTS,
  B2B_MIN_INSTALLMENT_CENTS,
  buildB2BBoletoSchedule,
  formatB2BDueDate,
  resolveB2BAllowedInstallments,
  splitB2BInstallments,
  type B2BBoletoInstallment,
  type B2BPaymentMethod,
} from "@/lib/b2b/pricing";

function BoletoScheduleList({ schedule }: { schedule: B2BBoletoInstallment[] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {schedule.map((item) => (
        <li key={item.installment} className="flex justify-between gap-3">
          <span>
            {item.installment}ª parcela · vence {formatB2BDueDate(item.dueDate)}
          </span>
          <strong>{formatB2BCents(item.amountCents)}</strong>
        </li>
      ))}
    </ul>
  );
}

type ShippingOption = {
  serviceName: string;
  etaDays: number;
  priceCents: number;
  totalsByPaymentMethod: Record<B2BPaymentMethod, number>;
};

type Quote = {
  requestKey: string;
  /** Só no "Lançar pedido": comissão estimada do vendedor (o cliente nunca recebe). */
  commission?: { estimatedCents: number; configured: boolean } | null;
  couponCode: string | null;
  subtotalCents: number;
  couponDiscountCents: number;
  subtotalAfterCouponCents: number;
  bonusLines: Array<{ productId: string; qty: number }>;
  discountLines?: Array<{ productId: string; percent: number; listUnitPriceCents: number; unitPriceCents: number }>;
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
  const [orderNote, setOrderNote] = useState("");
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
  // Orçamento (pedido sem pagamento): salvar, reabrir, ajustar e converter em pedido.
  const searchParams = useSearchParams();
  const quoteParam = searchParams.get("orcamento") ?? "";
  const launchParam = searchParams.get("lancar") === "1";
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteNotice, setQuoteNotice] = useState("");
  const [savedQuote, setSavedQuote] = useState<{ id: string; expiresAt: string | null; validityDays: number; totalCents: number } | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const quoteLoaded = useRef(false);
  const [storeLink, setStoreLink] = useState<string | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [finalMessage, setFinalMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [boletoSchedule, setBoletoSchedule] = useState<B2BBoletoInstallment[] | null>(null);

  // "Lançar pedido": a loja abriu com ?lancar=1 (marca por token na aba); o servidor valida pela sessão do vendedor.
  const [launched, setLaunched] = useState(false);
  const [payLink, setPayLink] = useState("");
  const [payLinkCopied, setPayLinkCopied] = useState(false);

  useEffect(() => {
    try {
      // Marca vinda do sessionStorage (só existe no navegador): lida depois da montagem.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLaunched(Boolean(token) && window.sessionStorage.getItem(launchStorageKey(token)) === "1");
    } catch {
      setLaunched(false);
    }
  }, [token]);

  // Lançamento: dados do cliente da oferta pré-preenchem o comprador (só o vendedor dono recebe).
  useEffect(() => {
    if (!launched || !token) return;
    let cancelled = false;

    fetch("/api/b2b/launch/buyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b2bToken: token }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { buyer?: { name: string; email: string; phone: string; personType: "pf" | "pj"; document: string } } | null) => {
        if (cancelled || !data?.buyer) return;
        const buyer = data.buyer;
        setPersonType(buyer.personType);
        setName(buyer.name);
        setEmail(buyer.email);
        setPhone(buyer.phone);
        if (buyer.personType === "pj") setCnpj(buyer.document);
        else setCpf(buyer.document);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [launched, token]);

  useEffect(() => {
    if (!quoteParam || !token || !cart.hydrated || quoteLoaded.current) return;

    quoteLoaded.current = true;

    if (launchParam) {
      try {
        window.sessionStorage.setItem(launchStorageKey(token), "1");
      } catch {
        // sem sessionStorage: o servidor ainda valida a sessão do vendedor
      }

      setLaunched(true);
    }

    fetch(`/api/b2b/orders/quote?b2b=${encodeURIComponent(token)}&id=${encodeURIComponent(quoteParam)}${launchParam ? "&lancar=1" : ""}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) {
          setQuoteNotice(data.error ?? "Não foi possível abrir o orçamento.");
          return;
        }

        cart.setOfferToken(token);
        cart.load(data.lines ?? [], data.displays ?? []);

        if (data.customer) {
          setPersonType(data.customer.personType === "pj" ? "pj" : "pf");
          setName(data.customer.name);
          setEmail(data.customer.email);
          setPhone(data.customer.phone);
          setCpf(data.customer.cpf);
          setCnpj(data.customer.cnpj);
          setStateRegistration(data.customer.stateRegistration);
        }

        if (data.address) {
          setCep(data.address.cep);
          setStreet(data.address.street);
          setNumber(data.address.number);
          setComplement(data.address.complement);
          setDistrict(data.address.district);
          setCity(data.address.city);
          setUf(data.address.state);
        }

        setOrderNote(data.quote?.orderNote ?? "");

        if (data.quote?.couponCode) {
          setCouponInput(data.quote.couponCode);
          setAppliedCoupon(data.quote.couponCode);
        }

        const until = data.quote?.expiresAt ? new Date(data.quote.expiresAt).toLocaleDateString("pt-BR") : null;

        if (data.quote?.expired) {
          // Vencido: abre para conferir (preços recalculados), mas não é convertido; salve um novo orçamento ou feche o pedido.
          setQuoteNotice(`Este orçamento venceu em ${until ?? "—"}. Os preços foram recalculados: salve um novo orçamento ou feche o pedido.`);
        } else {
          setQuoteId(String(data.quote.id));
          setQuoteNotice(`Orçamento reaberto${until ? ` (válido até ${until})` : ""}. Ajuste o que precisar e escolha a forma de pagamento para virar pedido. Os preços foram recalculados.`);
        }
      })
      .catch(() => setQuoteNotice("Não foi possível abrir o orçamento."));
    // Roda uma vez, depois da hidratação da sacola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteParam, token, cart.hydrated]);

  // "Continuar compra": a sacola já foi restaurada na loja; aqui entram os dados, o endereço e as observações do orçamento.
  const draftApplied = useRef(false);

  useEffect(() => {
    if (quoteParam || !token || !cart.hydrated || draftApplied.current) return;

    draftApplied.current = true;

    let draft = null;

    try {
      draft = readQuoteDraft(window.sessionStorage, token);
    } catch {
      draft = null;
    }

    if (!draft) return;

    if (draft.customer) {
      setPersonType(draft.customer.personType === "pj" ? "pj" : "pf");
      setName(draft.customer.name);
      setEmail(draft.customer.email);
      setPhone(draft.customer.phone);
      setCpf(draft.customer.cpf);
      setCnpj(draft.customer.cnpj);
      setStateRegistration(draft.customer.stateRegistration);
    }

    if (draft.address) {
      setCep(draft.address.cep);
      setStreet(draft.address.street);
      setNumber(draft.address.number);
      setComplement(draft.address.complement);
      setDistrict(draft.address.district);
      setCity(draft.address.city);
      setUf(draft.address.state);
    }

    setOrderNote(draft.orderNote);

    if (draft.couponCode) {
      setCouponInput(draft.couponCode);
      setAppliedCoupon(draft.couponCode);
    }

    setQuoteId(draft.quoteId);
    setQuoteNotice(draft.notice);
  }, [quoteParam, token, cart.hydrated]);

  const lines = cart.state.offerToken === token ? cart.state.lines : [];
  const itemsPayload = lines.map((line) => ({ productId: line.productId, qty: line.qty }));
  // Displays do kit (brinde R$ 0,00): o servidor exige o kit completo.
  const displays = cart.state.offerToken === token ? cart.state.displays : [];
  const displayKeys = displays.map((display) => display.key);
  const cepDigits = onlyDigits(cep);
  const requestKey = JSON.stringify([token, itemsPayload, cepDigits, uf, appliedCoupon, launched, displayKeys]);

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
          displays: displayKeys,
          launched,
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
  const complementCheck = validateComplement(complement);
  const complementError = complementCheck.ok ? "" : complementCheck.error;

  const chosen = quoteIsCurrent
    ? quote?.options.find((option) => option.serviceName === serviceName) ?? null
    : null;
  const totals = chosen?.totalsByPaymentMethod ?? null;

  // Faixa de benefícios (genérica, da configuração real do B2B: frete especial e desconto Pix/cartão; nunca "frete grátis").
  const checkoutTopStrip = buildCheckoutTopStrip({
    kind: "b2b",
    specialFreightThresholdCents: B2B_FREIGHT_FLAT_THRESHOLD_CENTS,
    paymentDiscountPercent: B2B_PAYMENT_METHOD_DISCOUNT_PERCENT,
  });
  const checkoutBenefits = buildCheckoutBenefits({
    kind: "b2b",
    subtotalCents: quoteIsCurrent && quote ? quote.subtotalAfterCouponCents : cart.subtotalCents,
    specialFreightThresholdCents: B2B_FREIGHT_FLAT_THRESHOLD_CENTS,
    paymentDiscountPercent: B2B_PAYMENT_METHOD_DISCOUNT_PERCENT,
  });
  // Pessoa física: só Pix e cartão (o servidor também recusa boleto para PF).
  const availableMethods: readonly B2BPaymentMethod[] =
    personType === "pf" ? ["pix", "card"] : ["pix", "card", "boleto"];
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

    setBoletoSchedule(Array.isArray(data?.boleto?.schedule) ? data.boleto.schedule : null);
    setFinalMessage({ ok: true, text: data.message });
  }

  /** Salva o pedido SEM forma de pagamento (orçamento): não reserva, não vai ao Omie, não gera comissão. */
  async function handleSaveQuote() {
    setError("");

    if (!chosen || !totals) {
      setError("Informe o CEP e escolha o frete antes de salvar o orçamento.");
      return;
    }

    if (complementError) {
      setError(complementError);
      return;
    }

    setSavingQuote(true);

    try {
      const response = await fetch("/api/b2b/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          b2bToken: token,
          customer: { personType, name, email, phone, cpf, cnpj, stateRegistration },
          address: { cep: cepDigits, street, number, complement, district, city, state: uf },
          orderNote,
          items: itemsPayload,
          couponCode: appliedCoupon || null,
          asQuote: true,
          shipping: { serviceName: chosen.serviceName },
          displays: displayKeys,
          launched,
          ...(quoteId ? { quoteId } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível salvar o orçamento.");
        return;
      }

      setStoreLink(typeof data.storeLink === "string" ? data.storeLink : null);
      setSavedQuote({ id: data.quote.id, expiresAt: data.quote.expiresAt ?? null, validityDays: Number(data.quote.validityDays ?? 15), totalCents: Number(data.quote.totalCents ?? 0) });
      cart.clear();
      try {
        clearQuoteDraft(window.sessionStorage, token);
      } catch {
        // sem armazenamento
      }
    } catch {
      setError("Não foi possível salvar o orçamento. Tente novamente.");
    } finally {
      setSavingQuote(false);
    }
  }

  async function handleConfirm() {
    setError("");

    if (!chosen || !totals) {
      setError("Informe o CEP e escolha o frete antes de continuar.");
      return;
    }

    if (complementError) {
      setError(complementError);
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
          orderNote,
          items: itemsPayload,
          couponCode: appliedCoupon || null,
          paymentMethod,
          installments: paymentMethod === "boleto" ? effectiveBoletoInstallments : 1,
          shipping: { serviceName: chosen.serviceName },
          displays: displayKeys,
          launched,
          ...(quoteId ? { quoteId } : {}),
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
      if (launched && created.paymentMethod === "card") {
        setPayLink(`${window.location.origin}${buildCardPayLinkPath(created.id, token)}`);
      }
      setStoreLink(typeof data.storeLink === "string" ? data.storeLink : null);
      cart.clear();
      try {
        clearQuoteDraft(window.sessionStorage, token);
      } catch {
        // sem armazenamento
      }

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

  if (savedQuote) {
    // Dentro do link pessoal tudo volta para a loja DESTE cliente; vindo do link geral (/parceiros), usa o link pessoal que a loja devolveu.
    const linkToken = (storeLink ? tokenFromOfferUrl(storeLink) : "") || token;

    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-16 text-center text-[#422347]" data-testid="orcamento-salvo">
        <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Orçamento salvo</h1>
        <p className="mt-3 text-sm">
          Orçamento {savedQuote.id.slice(0, 8).toUpperCase()} · {formatB2BCents(savedQuote.totalCents)}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#746471]">
          {savedQuote.expiresAt ? `Válido até ${new Date(savedQuote.expiresAt).toLocaleDateString("pt-BR")} (${savedQuote.validityDays} dias). ` : ""}
          Não reserva produtos e ainda não é um pedido: ele aparece em “Meus pedidos” do link e pode ser reaberto, ajustado e fechado com a forma de pagamento.
        </p>
        <div className="mx-auto mt-6 max-w-sm text-left">
          <QuoteActions
            continueHref={continueQuotePath(linkToken, savedQuote.id, launched)}
            printHref={printQuotePath(savedQuote.id, linkToken)}
            phone={phone}
            who={name}
            sendToClient={launched}
          />
          <p className="mt-4 text-center">
            <Link href={`/b2b/oferta/${encodeURIComponent(linkToken)}/pedidos`} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
              Ver meus pedidos e orçamentos
            </Link>
          </p>
          {storeLink && !launched ? <ReorderLink token={linkToken} url={storeLink} /> : null}
        </div>
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
        {boletoSchedule && boletoSchedule.length > 0 && (
          <div className="mx-auto mt-4 max-w-sm rounded-xl border border-[#eadfd9] bg-white p-4 text-left text-sm">
            <p className="mb-2 font-bold">Vencimentos do boleto</p>
            <BoletoScheduleList schedule={boletoSchedule} />
          </div>
        )}
        {order && (
          <p className="mt-2 text-sm text-[#8a7886]">
            Pedido {order.id.slice(0, 8).toUpperCase()} · {formatB2BCents(order.totalCents)}
          </p>
        )}
        {order && <TrackOrderCard orderId={order.id} />}
        {order && (
          <Link href={`/b2b/oferta/${encodeURIComponent(token)}/pedidos/${order.id}/imprimir`} className="mt-4 inline-block rounded-full border-2 border-[#55245f] px-5 py-2.5 text-sm font-extrabold text-[#55245f]" data-testid="imprimir-pedido-criado">
            Imprimir / salvar PDF do pedido
          </Link>
        )}
        {order && finalMessage.ok && <AdsPurchaseTag orderId={order.id} />}
        {order && finalMessage.ok && <PurchaseMeasurement orderId={order.id} />}
        {/* Loja pública: o link permanente do lojista (oferta padrão dele); nos demais, o próprio link da oferta. */}
        {storeLink ? <ReorderLink token={token} url={storeLink} /> : <ReorderLink token={token} />}
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

          <TrackOrderCard orderId={order.id} />
          <Link href={`/b2b/oferta/${encodeURIComponent(token)}/pedidos/${order.id}/imprimir`} className="mt-3 inline-block text-sm font-bold text-[#63326d] underline underline-offset-4" data-testid="imprimir-pedido-criado">
            Imprimir / salvar PDF do pedido
          </Link>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
              {error}
            </p>
          )}

          <div className="mt-6">
            {order.paymentMethod === "card" && launched && payLink && (
              <section className="rounded-[20px] border border-[#eadfd9] bg-white p-5" data-testid="link-pagamento-cartao">
                <h2 className="text-lg font-bold">Link de pagamento no cartão</h2>
                <p className="mt-1 text-sm text-[#746471]">
                  Envie ao cliente: ele paga no próprio celular. O pedido fica aguardando até o pagamento ser aprovado.
                </p>
                <textarea readOnly value={payLink} className="mt-3 h-20 w-full rounded-xl border border-[#d9c7dc] p-2 text-xs" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(payLink);
                        setPayLinkCopied(true);
                      } catch {
                        setPayLinkCopied(false);
                      }
                    }}
                    className="rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white"
                  >
                    {payLinkCopied ? "Link copiado" : "Copiar link"}
                  </button>
                  <a
                    href={`https://wa.me/${onlyDigits(phone).startsWith("55") ? onlyDigits(phone) : `55${onlyDigits(phone)}`}?text=${encodeURIComponent(
                      `Olá! Segue o link para pagar seu pedido (${formatB2BCents(order.totalCents)}) no cartão: ${payLink}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border-2 border-[#55245f] py-3 text-center text-sm font-extrabold text-[#55245f]"
                  >
                    Enviar por WhatsApp
                  </a>
                </div>
              </section>
            )}

            {order.paymentMethod === "card" && !launched && (
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
                {launched && (
                  <a
                    href={`https://wa.me/${onlyDigits(phone).startsWith("55") ? onlyDigits(phone) : `55${onlyDigits(phone)}`}?text=${encodeURIComponent(
                      `Olá! Segue o Pix copia e cola do seu pedido (${formatB2BCents(order.totalCents)}):\n${pix.qrCode}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block rounded-full border-2 border-[#55245f] py-3 text-center text-sm font-extrabold text-[#55245f]"
                    data-testid="pix-whatsapp"
                  >
                    Enviar Pix por WhatsApp
                  </a>
                )}
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

  // Folha da revisão (imprimir / PDF) montada do que está na tela; o servidor recalcula tudo ao confirmar.
  const reviewSheet = buildReviewSheet({
    lines: lines.map((line) => ({ name: line.name, qty: line.qty, priceCents: line.priceCents, discountPercent: line.discountPercent ?? null })),
    lineIds: lines.map((line) => line.productId),
    discountLines: quoteIsCurrent ? quote?.discountLines : undefined,
    bonusByProduct: quoteIsCurrent ? new Map((quote?.bonusLines ?? []).map((bonus) => [bonus.productId, bonus.qty])) : undefined,
    displays: displays.map((display) => `1× ${display.name} (brinde)`),
    buyer: { name, document: personType === "pj" ? cnpj : cpf, email, phone },
    address: { street, number, complement, district, city, state: uf, cep: cepDigits },
    couponCode: quoteIsCurrent ? quote?.couponCode ?? null : null,
    subtotalCents: quoteIsCurrent && quote ? quote.subtotalCents : cart.subtotalCents,
    couponDiscountCents: quoteIsCurrent && quote ? quote.couponDiscountCents : 0,
    shipping: chosen ? { serviceName: chosen.serviceName, priceCents: chosen.priceCents } : null,
    totalsByPaymentMethod: totals,
    paymentMethod,
    installments: paymentMethod === "boleto" ? effectiveBoletoInstallments : 1,
    note: orderNote,
  });

  const discountByProduct = new Map((quoteIsCurrent ? quote?.discountLines ?? [] : []).map((d) => [d.productId, d]));
  const bonusByProduct = new Map((quoteIsCurrent ? quote?.bonusLines ?? [] : []).map((b) => [b.productId, b.qty]));

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      {quoteNotice && (
        <p role="status" data-testid="aviso-orcamento" className="mx-auto mb-6 max-w-5xl rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          {quoteNotice}
        </p>
      )}
      <CheckoutTopStrip parts={checkoutTopStrip} className="mx-auto mb-6 max-w-5xl" />
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
            {launched && (
              <p className="mt-3 rounded-xl bg-[#f6eef7] p-3 text-sm font-bold text-[#55245f]" data-testid="checkout-lancamento">
                Pedido lançado por você. Confira os dados do cliente, o endereço de entrega e a forma de pagamento.
                {quoteIsCurrent && quote?.commission?.configured && (
                  <span className="mt-1 block text-xs font-extrabold text-[#2f7a4a]" data-testid="comissao-estimada">
                    Sua comissão estimada neste pedido: {formatB2BCents(quote.commission.estimatedCents)} (só você vê).
                  </span>
                )}
              </p>
            )}
          </div>

          <section className="space-y-3">
            <h2 className="font-bold">Dados do comprador</h2>
            <div className="flex gap-2">
              {(["pj", "pf"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setPersonType(type);
                    // Pessoa física paga só com Pix ou cartão.
                    if (type === "pf" && paymentMethod === "boleto") setPaymentMethod("pix");
                  }}
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
            <input
              className={inputClass}
              placeholder="Complemento (opcional)"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              aria-describedby="complemento-ajuda"
              data-testid="b2b-complemento"
            />
            {complementError ? (
              <p className="text-xs font-semibold text-red-700" role="alert">{complementError}</p>
            ) : (
              <p id="complemento-ajuda" className="text-xs text-[#8a7886]">Apto, sala, bloco. {COMPLEMENT_HELP}</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">Observações do pedido</h2>
            <textarea
              className={`${inputClass} min-h-[84px] resize-y`}
              placeholder="Horário de entrega, ponto de referência, instruções (opcional)"
              maxLength={ORDER_NOTE_MAX}
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              data-testid="b2b-observacoes"
            />
            <p className="text-right text-xs text-[#8a7886]">{orderNote.length}/{ORDER_NOTE_MAX}</p>
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
            {availableMethods.map((method) => (
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

            {personType === "pf" && (
              <p className="text-xs text-[#8a7886]">Boleto disponível apenas para pessoa jurídica.</p>
            )}

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
                <BoletoScheduleList
                  schedule={buildB2BBoletoSchedule(totals.boleto, effectiveBoletoInstallments, new Date())}
                />
                <p className="mt-2 text-xs text-[#8a7886]">
                  Vencimentos em 28, 42 e 56 dias contados da data do pedido. O boleto é
                  emitido pela nossa equipe e enviado para o e-mail informado.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-[20px] border border-[#eadfd9] bg-white p-5 lg:sticky lg:top-6">
          <h2 className="font-bold">Resumo</h2>
          <CheckoutBenefitsBar benefits={checkoutBenefits} />
          {cart.notice && (
            <p role="alert" data-testid="aviso-display" className="flex items-start justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
              <span>{cart.notice}</span>
              <button type="button" onClick={cart.dismissNotice} className="shrink-0 font-extrabold underline">OK</button>
            </p>
          )}
          {cart.subtotalCents < B2B_MIN_ORDER_CENTS && (
            <p role="status" data-testid="aviso-minimo" className="rounded-xl bg-[#fff4e5] p-3 text-xs font-semibold text-[#8a5a12]">
              Faltam {formatB2BCents(B2B_MIN_ORDER_CENTS - cart.subtotalCents)} para atingir o pedido mínimo de {formatB2BCents(B2B_MIN_ORDER_CENTS)}.
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-3" data-testid="linha-resumo">
                <span className="min-w-0">
                  <span className="block">{line.name}</span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <QtyStepper qty={line.qty} label={line.name} onChange={(qty) => cart.setQty(line.productId, qty)} />
                    <button type="button" onClick={() => cart.removeItem(line.productId)} className="text-xs font-bold text-[#a33]">
                      Remover
                    </button>
                  </span>
                  {bonusByProduct.get(line.productId) ? (
                    <span className="block text-xs font-bold text-[#2f7a4a]">
                      + {bonusByProduct.get(line.productId)} grátis
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  {discountByProduct.get(line.productId) ? (
                    <>
                      <span className="block text-xs text-[#8a7886] line-through">
                        {formatB2BCents(discountByProduct.get(line.productId)!.listUnitPriceCents * line.qty)}
                      </span>
                      {formatB2BCents(discountByProduct.get(line.productId)!.unitPriceCents * line.qty)}
                      <span className="block text-xs font-bold text-blue-700">
                        −{String(discountByProduct.get(line.productId)!.percent).replace(".", ",")}%
                      </span>
                    </>
                  ) : (
                    formatB2BCents(cartLineUnitCents(line) * line.qty)
                  )}
                </span>
              </li>
            ))}
            {displays.map((display, index) => (
              <li key={`${display.key}-${index}`} className="flex justify-between gap-3" data-testid="linha-display">
                <span>
                  1× {display.name} <span className="font-bold text-[#2f7a4a]">(brinde)</span>
                </span>
                <span className="shrink-0 text-right font-bold text-[#2f7a4a]">{formatB2BCents(0)}</span>
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

          <CheckoutBenefitsBar benefits={checkoutBenefits} variant="compact" />

          <button
            type="button"
            disabled={submitting || !chosen || quoting || cart.subtotalCents < B2B_MIN_ORDER_CENTS}
            onClick={handleConfirm}
            className="w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {submitting ? "Processando…" : quoteId ? "Confirmar pedido (do orçamento)" : "Confirmar pedido"}
          </button>

          <button
            type="button"
            disabled={savingQuote || submitting || !chosen || quoting || cart.subtotalCents < B2B_MIN_ORDER_CENTS}
            onClick={handleSaveQuote}
            className="w-full rounded-full border-2 border-[#55245f] py-3 text-sm font-extrabold text-[#55245f] disabled:opacity-50"
            data-testid="salvar-orcamento"
          >
            {savingQuote ? "Salvando…" : "Salvar como orçamento"}
          </button>
          <p className="text-center text-xs leading-5 text-[#746471]">
            Orçamento: sem escolher o pagamento, sem reservar produtos. Fica em “Meus pedidos” (validade informada ao salvar) e você reabre, ajusta e fecha depois.
          </p>

          <PrintOrderButton
            sheet={reviewSheet}
            label="Imprimir / salvar PDF da revisão"
            className="w-full rounded-full border border-[#d9c7dc] py-2.5 text-sm font-bold text-[#55245f] transition hover:bg-[#f6eef7]"
          />

          <p className="text-center text-xs leading-5 text-[#746471]" data-testid="lgpd">
            Seus dados serão usados para contato comercial, conforme nossa{" "}
            <Link href="/privacidade" className="font-bold text-[#63326d] underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </aside>
      </div>
    </main>
  );
}
