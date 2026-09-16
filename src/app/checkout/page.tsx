"use client";

import MercadoPagoCardPayment from "@/components/payments/MercadoPagoCardPayment";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useCart,
} from "@/components/cart/CartProvider";

interface QuoteItem {
  productSlug: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

interface OfferBreakdown {
  code?: string;
  label?: string;
  discountCents: number;
}

interface ShippingOption {
  serviceName: string;
  priceCents: number;
  etaDays: number;
}

interface AppliedCoupon {
  code: string;
  discountType: string;
  discountValue: number;
  discountCents: number;
  couponType: "normal" | "partner";
  partnerId: string | null;
  commissionPercent: number | null;
}
interface Quote {
  items: QuoteItem[];
  grossSubtotalCents: number;
  offerDiscountCents: number;
  promotionDiscountCents: number;
  couponDiscountCents: number;
  creditUsedCents: number;
  shippingOriginalCents: number;
  shippingSubsidyCents: number;
  freeShippingDiscountCents: number;
  totalCents: number;
  offerBreakdown: OfferBreakdown[];
}

function formatDocument(value: string) {
  const digits =
    value
      .replace(/\D/g, "")
      .slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(
        /(\d{3})(\d)/,
        "$1.$2"
      )
      .replace(
        /(\d{3})(\d)/,
        "$1.$2"
      )
      .replace(
        /(\d{3})(\d{1,2})$/,
        "$1-$2"
      );
  }

  return digits
    .replace(
      /^(\d{2})(\d)/,
      "$1.$2"
    )
    .replace(
      /^(\d{2})\.(\d{3})(\d)/,
      "$1.$2.$3"
    )
    .replace(
      /\.(\d{3})(\d)/,
      ".$1/$2"
    )
    .replace(
      /(\d{4})(\d)/,
      "$1-$2"
    );
}
function formatMoney(cents: number) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(cents / 100);
}

export default function CheckoutPage() {
  const {
    items,
    offers,
    clearCart,
  } = useCart();

  const [
    quote,
    setQuote,
  ] =
    useState<Quote | null>(null);

  // BIO_CHECKOUT_DRAFT_V3
  const [checkoutDraftRestored, setCheckoutDraftRestored] =
    useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<"pix" | "card">("pix");

  const [cardOrderTotalCents, setCardOrderTotalCents] =
    useState<number | null>(null);

  const [cardPayerEmail, setCardPayerEmail] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    searchingCep,
    setSearchingCep,
  ] = useState(false);

  const [
    cepError,
    setCepError,
  ] = useState("");

  const [
    shippingOptions,
    setShippingOptions,
  ] = useState<ShippingOption[]>([]);

  const [
    selectedShipping,
    setSelectedShipping,
  ] = useState<ShippingOption | null>(null);

  const [
    loadingShipping,
    setLoadingShipping,
  ] = useState(false);

  const [
    shippingError,
    setShippingError,
  ] = useState("");

  const [
    calculatedCep,
    setCalculatedCep,
  ] = useState("");

  const [
    couponCode,
    setCouponCode,
  ] = useState("");

  const [
    partnerCouponCode,
    setPartnerCouponCode,
  ] = useState("");

  const [
    appliedCoupon,
    setAppliedCoupon,
  ] = useState<AppliedCoupon | null>(null);

  const [
    appliedPartnerCoupon,
    setAppliedPartnerCoupon,
  ] = useState<AppliedCoupon | null>(null);

  const [
    couponError,
    setCouponError,
  ] = useState("");

  const [
    partnerCouponError,
    setPartnerCouponError,
  ] = useState("");

  const [
    loadingCoupon,
    setLoadingCoupon,
  ] = useState(false);

  const [
    loadingPartnerCoupon,
    setLoadingPartnerCoupon,
  ] = useState(false);

  const [
    creatingOrder,
    setCreatingOrder,
  ] = useState(false);

  const [
    orderError,
    setOrderError,
  ] = useState("");

  const [
    pendingOrderId,
    setPendingOrderId,
  ] = useState<string | null>(null);

  const [
    pendingOrderStatus,
    setPendingOrderStatus,
  ] = useState<string | null>(null);
  const [
    pixPayment,
    setPixPayment,
  ] = useState<{
    paymentId: string;
    status: string;
    expiresAt: string | null;
    qrCode: string;
    qrImageUrl: string | null;
  } | null>(null);

  const [
    loadingPix,
    setLoadingPix,
  ] = useState(false);

  const [
    pixError,
    setPixError,
  ] = useState("");

  const [
    pixCopied,
    setPixCopied,
  ] = useState(false);

  const [
    pixRetryNonce,
    setPixRetryNonce,
  ] = useState(0);

  // BIO_CHECKOUT_DRAFT_RESTORE_V3
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(
        "bio-checkout-draft"
      );

      if (!raw) {
        setCheckoutDraftRestored(true);
        return;
      }

      const draft = JSON.parse(raw) as {
        fields?: Record<string, string>;
        paymentMethod?: "pix" | "card";
        shippingOptions?: ShippingOption[];
        selectedShipping?: ShippingOption | null;
        calculatedCep?: string;
        appliedCoupon?: AppliedCoupon | null;
        appliedPartnerCoupon?: AppliedCoupon | null;
      };

      if (
        draft.paymentMethod === "pix" ||
        draft.paymentMethod === "card"
      ) {
        setPaymentMethod(draft.paymentMethod);
      }

      if (Array.isArray(draft.shippingOptions)) {
        setShippingOptions(draft.shippingOptions);
      }

      setSelectedShipping(
        draft.selectedShipping ?? null
      );

      if (typeof draft.calculatedCep === "string") {
        setCalculatedCep(draft.calculatedCep);
      }

      setAppliedCoupon(
        draft.appliedCoupon ?? null
      );

      setAppliedPartnerCoupon(
        draft.appliedPartnerCoupon ?? null
      );

      window.setTimeout(() => {
        const form = document.getElementById(
          "bio-checkout-form"
        ) as HTMLFormElement | null;

        if (form && draft.fields) {
          for (const [name, value] of Object.entries(draft.fields)) {
            const element = form.elements.namedItem(name);

            if (
              element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement ||
              element instanceof HTMLSelectElement
            ) {
              element.value = value ?? "";
            }
          }
        }

        setCheckoutDraftRestored(true);
      }, 0);
    } catch {
      window.sessionStorage.removeItem(
        "bio-checkout-draft"
      );
      setCheckoutDraftRestored(true);
    }
  }, []);
  // BIO_PENDING_CART_SNAPSHOT
  const [pendingCartRequestKey, setPendingCartRequestKey] =
    useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(
        "bio-payment-pending"
      );

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as {
        orderId?: string;
        paymentMethod?: "pix" | "card";
        cardOrderTotalCents?: number;
        cardPayerEmail?: string;
        cartRequestKey?: string;
      };

      if (parsed.orderId) {
        setPendingOrderId(parsed.orderId);
      }

      if (
        typeof parsed.cartRequestKey === "string" &&
        parsed.cartRequestKey
      ) {
        setPendingCartRequestKey(parsed.cartRequestKey);
      }

      if (
        parsed.paymentMethod === "pix" ||
        parsed.paymentMethod === "card"
      ) {
        setPaymentMethod(parsed.paymentMethod);
      }

      if (
        parsed.paymentMethod === "card" &&
        Number.isFinite(parsed.cardOrderTotalCents) &&
        Number(parsed.cardOrderTotalCents) > 0 &&
        typeof parsed.cardPayerEmail === "string" &&
        parsed.cardPayerEmail.trim()
      ) {
        setCardOrderTotalCents(
          Number(parsed.cardOrderTotalCents)
        );
        setCardPayerEmail(
          parsed.cardPayerEmail.trim()
        );
      }
    } catch {
      window.sessionStorage.removeItem(
        "bio-payment-pending"
      );
    }
  }, []);
  // BIO_LEGACY_CARD_PENDING_GUARD
  useEffect(() => {
    if (
      !pendingOrderId ||
      paymentMethod !== "card" ||
      pendingOrderStatus === "paid" ||
      pendingCartRequestKey
    ) {
      return;
    }

    // Pending de cartÃ£o anterior ao snapshot do carrinho:
    // nÃ£o reutilizar contra a compra atual.
    window.sessionStorage.removeItem(
      "bio-payment-pending"
    );

    setPendingOrderId(null);
    setPendingOrderStatus(null);
    setCardOrderTotalCents(null);
    setCardPayerEmail("");
    setOrderError("");
  }, [
    pendingOrderId,
    pendingOrderStatus,
    paymentMethod,
    pendingCartRequestKey,
  ]);

  useEffect(() => {
    if (!pendingOrderId) {
      return;
    }

    let cancelled = false;

    async function checkOrderStatus() {
      try {
        const response = await fetch(
          `/api/orders/${pendingOrderId}/status`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          status?: string;
          paid?: boolean;
        };

        if (cancelled) {
          return;
        }

        if (data.status) {
          setPendingOrderStatus(data.status);
        }

        if (data.paid) {
          setPendingOrderStatus("paid");

          // BIO_PAID_CHECKOUT_FINALIZATION
          // Mantem a confirmacao visivel nesta tela,
          // mas encerra a persistencia do pedido pago
          // e libera a sacola para uma nova compra.
          window.sessionStorage.removeItem(
            "bio-payment-pending"
          );

          setPendingCartRequestKey(null);
          clearCart();
          sessionStorage.removeItem("bio-checkout-draft");
        }
      } catch {
        // Falha temporÃ¡ria de consulta nÃ£o altera o pedido.
      }
    }

    void checkOrderStatus();

    const interval = window.setInterval(
      checkOrderStatus,
      3000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingOrderId, clearCart]);
  useEffect(() => {
    if (
      !pendingOrderId ||
      paymentMethod !== "pix" ||
      pendingOrderStatus === "paid"
    ) {
      return;
    }

    let cancelled = false;

    async function loadPixPayment() {
      setLoadingPix(true);
      setPixError("");

      try {
        const response = await fetch(
          "/api/payments/lunium/pix",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              orderId:
                pendingOrderId,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ??
              "NÃ£o foi possÃ­vel gerar o Pix."
          );
        }

        if (
          !data?.paymentId ||
          !data?.pix?.qrCode
        ) {
          throw new Error(
            "A cobranÃ§a Pix foi criada sem os dados necessÃ¡rios."
          );
        }

        if (cancelled) {
          return;
        }

        setPixPayment({
          paymentId:
            data.paymentId,

          status:
            data.status ??
            "pending",

          expiresAt:
            data.expiresAt ??
            null,

          qrCode:
            data.pix.qrCode,

          qrImageUrl:
            data.pix.qrImageUrl ??
            null,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPixError(
          error instanceof Error
            ? error.message
            : "NÃ£o foi possÃ­vel carregar o Pix."
        );
      } finally {
        if (!cancelled) {
          setLoadingPix(false);
        }
      }
    }

    void loadPixPayment();

    return () => {
      cancelled = true;
    };
  }, [
    pendingOrderId,
    paymentMethod,
    pendingOrderStatus,
    pixRetryNonce,
  ]);
  // BIO_CARD_AUTO_SCROLL_V1
  useEffect(() => {
    if (
      !pendingOrderId ||
      paymentMethod !== "card" ||
      pendingOrderStatus === "paid" ||
      !cardOrderTotalCents ||
      !cardPayerEmail
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      document
        .getElementById("bio-card-payment-section")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    pendingOrderId,
    paymentMethod,
    pendingOrderStatus,
    cardOrderTotalCents,
    cardPayerEmail,
  ]);
  // BIO_CHECKOUT_DRAFT_SAVE_V3
  const saveCheckoutDraft = () => {
    try {
      const form = document.getElementById(
        "bio-checkout-form"
      ) as HTMLFormElement | null;

      const fields: Record<string, string> = {};

      if (form) {
        const data = new FormData(form);

        for (const [name, value] of data.entries()) {
          if (typeof value === "string") {
            fields[name] = value;
          }
        }
      }

      window.sessionStorage.setItem(
        "bio-checkout-draft",
        JSON.stringify({
          fields,
          paymentMethod,
          shippingOptions,
          selectedShipping,
          calculatedCep,
          appliedCoupon,
          appliedPartnerCoupon,
        })
      );
    } catch {
      // Storage nao pode bloquear o checkout.
    }
  };
  // BIO_CONTINUE_SHOPPING_CARD_V1
  const continueShoppingFromCard = () => {
    if (
      paymentMethod !== "card" ||
      pendingOrderStatus === "paid"
    ) {
      return;
    }

    try {
      window.sessionStorage.removeItem(
        "bio-payment-pending"
      );
    } catch {
      // sessionStorage indisponivel nao pode bloquear a navegacao.
    }

    setPendingOrderId(null);
    setPendingOrderStatus(null);
    setCardOrderTotalCents(null);
    setCardPayerEmail(null);

    saveCheckoutDraft();

    // BIO_CONTINUE_SHOPPING_SAVE_DRAFT_V3
    window.location.href = "/carrinho";
  };
  const requestKey =
    useMemo(
      () =>
        JSON.stringify({
          items: items.map(
            (item) => ({
              productSlug:
                item.productSlug,
              qty:
                item.qty,
            })
          ),
          offers: offers.map(
            (offer) => ({
              code:
                offer.code,
              productSlugs:
                offer.productSlugs,
              qty:
                offer.qty,
            })
          ),
        }),
      [
        items,
        offers,
      ]
    );

  // BIO_CHECKOUT_DRAFT_AUTOSAVE_V3
  useEffect(() => {
    if (!checkoutDraftRestored) {
      return;
    }

    saveCheckoutDraft();
  }, [
    checkoutDraftRestored,
    paymentMethod,
    shippingOptions,
    selectedShipping,
    calculatedCep,
    appliedCoupon,
    appliedPartnerCoupon,
  ]);
  // BIO_PENDING_ORDER_CART_GUARD
  useEffect(() => {
    if (
      !pendingOrderId ||
      paymentMethod !== "card" ||
      pendingOrderStatus === "paid" ||
      !pendingCartRequestKey
    ) {
      return;
    }

    if (pendingCartRequestKey === requestKey) {
      return;
    }

    // Carrinho alterado: nÃ£o reutilizar pedido antigo.
    window.sessionStorage.removeItem("bio-payment-pending");
    setPendingOrderId(null);
    setPendingOrderStatus(null);
    setPendingCartRequestKey(null);
    setCardOrderTotalCents(null);
    setCardPayerEmail("");
    setOrderError("");
  }, [
    pendingOrderId,
    pendingOrderStatus,
    paymentMethod,
    pendingCartRequestKey,
    requestKey,
  ]);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }

    let active = true;

    async function loadQuote() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/cart/quote",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                requestKey,
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "NÃ£o foi possÃ­vel calcular o pedido."
          );
        }

        if (active) {
          setQuote(
            data as Quote
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "NÃ£o foi possÃ­vel calcular o pedido."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadQuote();

    return () => {
      active = false;
    };
  }, [
    items.length,
    requestKey,
  ]);

  if (items.length === 0 && pendingOrderStatus !== "paid") {
    return (
      <main className="min-h-screen bg-[#f8f5ee] px-5 py-16 text-[#26352c]">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-[32px] border border-[#26352c]/10 bg-white p-8 text-center shadow-sm md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#26352c]/50">
              Checkout
            </p>

            <h1 className="mt-3 text-3xl font-medium">
              Sua sacola estÃ¡ vazia
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#26352c]/65">
              Escolha seus produtos Bio Florais antes de continuar.
            </p>

            <Link
              href="/"
              className="mt-7 inline-flex rounded-full bg-[#26352c] px-7 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              Ver produtos
            </Link>
          </section>
        </div>
      </main>
    );
  }

  async function loadShipping(
    cep: string
  ) {
    setLoadingShipping(true);
    setShippingError("");
    setShippingOptions([]);
    setSelectedShipping(null);

    try {
      const response = await fetch(
        "/api/shipping/quote",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            cepDestino: cep,
            items: items.map(
              (item) => ({
                productSlug:
                  item.productSlug,
                qty: item.qty,
              })
            ),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "NÃ£o foi possÃ­vel calcular o frete."
        );
      }

      const rawOptions: ShippingOption[] =
        Array.isArray(data.options)
          ? data.options
          : [];

      const options: ShippingOption[] =
        rawOptions
          .map(
            (option): ShippingOption => ({
              ...option,
              serviceName:
                option.serviceName
                  .replace(
                    /\s*\u2014\s*/g,
                    " \u2014 "
                  )
                  .replace(
                    /\s*â€”\s*/g,
                    " â€” "
                  )
                  .trim(),
            })
          )
          .sort(
            (
              a: ShippingOption,
              b: ShippingOption
            ) =>
              a.priceCents -
              b.priceCents
          );

      if (options.length === 0) {
        throw new Error(
          "Nenhuma opÃ§Ã£o de entrega disponÃ­vel para este CEP."
        );
      }

      setShippingOptions(options);
      setSelectedShipping(options[0]);
      setCalculatedCep(cep);
    } catch (err) {
      setCalculatedCep("");
      setShippingError(
        err instanceof Error
          ? err.message
          : "NÃ£o foi possÃ­vel calcular o frete."
      );
    } finally {
      setLoadingShipping(false);
    }
  }



  async function handleCepBlur(
    event: React.FocusEvent<HTMLInputElement>
  ) {
    const input =
      event.currentTarget;

    const form =
      input.form;

    const cep =
      input.value.replace(
        /\D/g,
        ""
      );

    if (cep.length !== 8) {
      setCepError(
        "Digite um CEP com 8 nÃºmeros."
      );
      return;
    }

    if (!form) {
      setCepError(
        "NÃ£o foi possÃ­vel localizar o formulÃ¡rio."
      );
      return;
    }

    setSearchingCep(true);
    setCepError("");

    try {
      const response =
        await fetch(
          `https://viacep.com.br/ws/${cep}/json/`,
          {
            cache: "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Erro na consulta do CEP."
        );
      }

      const data =
        await response.json();

      if (data.erro) {
        setCepError(
          "CEP nÃ£o encontrado."
        );
        return;
      }

      const setValue = (
        name: string,
        value: string
      ) => {
        const field =
          form.elements.namedItem(
            name
          ) as HTMLInputElement | null;

        if (!field) {
          return;
        }

        field.value =
          value ?? "";

        field.dispatchEvent(
          new Event(
            "input",
            {
              bubbles: true,
            }
          )
        );

        field.dispatchEvent(
          new Event(
            "change",
            {
              bubbles: true,
            }
          )
        );
      };

      setValue(
        "street",
        data.logradouro ?? ""
      );

      setValue(
        "neighborhood",
        data.bairro ?? ""
      );

      setValue(
        "city",
        data.localidade ?? ""
      );

      setValue(
        "state",
        data.uf ?? ""
      );

      await loadShipping(cep);
    } catch {
      setCepError(
        "NÃ£o foi possÃ­vel consultar o CEP. VocÃª pode preencher o endereÃ§o manualmente."
      );
    } finally {
      setSearchingCep(false);
    }
  }

  async function validateCommercialCoupon(
    code: string,
    subtotalCents: number
  ): Promise<AppliedCoupon> {
    const response = await fetch(
      "/api/coupons/validate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          subtotalCents,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ??
          "N\u00e3o foi poss\u00edvel validar o cupom."
      );
    }

    return {
      code: data.coupon.code,
      discountType: data.coupon.discountType,
      discountValue: data.coupon.discountValue,
      discountCents: data.discountCents,
      couponType: "normal",
      partnerId: null,
      commissionPercent: null,
    };
  }

  async function validatePartnerCouponUi(
    code: string,
    subtotalCents: number
  ): Promise<AppliedCoupon> {
    const response = await fetch(
      "/api/partners/validate-coupon",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          subtotalCents,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ??
          "N\u00e3o foi poss\u00edvel validar o cupom UGC/parceira."
      );
    }

    return {
      code: data.coupon.code,
      discountType: data.coupon.discountType,
      discountValue: data.coupon.discountValue,
      discountCents: data.discountCents,
      couponType: "partner",
      partnerId: data.coupon.partnerId ?? null,
      commissionPercent:
        data.coupon.commissionPercent ?? null,
    };
  }

  async function handleApplyCommercialCoupon() {
    const code =
      couponCode.trim().toUpperCase();

    if (!code || !quote) return;

    if (appliedCoupon) {
      setCouponError(
        "J\u00e1 existe um cupom comercial aplicado."
      );
      return;
    }

    setLoadingCoupon(true);
    setCouponError("");

    try {
      const validation =
        await validateCommercialCoupon(
          code,
          quote.totalCents
        );

      setAppliedCoupon(validation);

      if (appliedPartnerCoupon) {
        const partnerBaseCents =
          Math.max(
            0,
            quote.totalCents -
              validation.discountCents
          );

        const recalculatedPartner =
          await validatePartnerCouponUi(
            appliedPartnerCoupon.code,
            partnerBaseCents
          );

        setAppliedPartnerCoupon(
          recalculatedPartner
        );
      }

      setCouponCode("");
    } catch (err) {
      setCouponError(
        err instanceof Error
          ? err.message
          : "N\u00e3o foi poss\u00edvel aplicar o cupom."
      );
    } finally {
      setLoadingCoupon(false);
    }
  }

  async function handleApplyPartnerCoupon() {
    const code =
      partnerCouponCode.trim().toUpperCase();

    if (!code || !quote) return;

    if (appliedPartnerCoupon) {
      setPartnerCouponError(
        "J\u00e1 existe um cupom UGC/parceira aplicado."
      );
      return;
    }

    setLoadingPartnerCoupon(true);
    setPartnerCouponError("");

    try {
      const partnerBaseCents =
        Math.max(
          0,
          quote.totalCents -
            (appliedCoupon?.discountCents ?? 0)
        );

      const validation =
        await validatePartnerCouponUi(
          code,
          partnerBaseCents
        );

      setAppliedPartnerCoupon(validation);
      setPartnerCouponCode("");
    } catch (err) {
      setPartnerCouponError(
        err instanceof Error
          ? err.message
          : "N\u00e3o foi poss\u00edvel aplicar o cupom UGC/parceira."
      );
    } finally {
      setLoadingPartnerCoupon(false);
    }
  }

  function removeCommercialCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
  }

  function removePartnerCoupon() {
    setAppliedPartnerCoupon(null);
    setPartnerCouponError("");
  }

  const merchandiseTotalCents =
    quote?.totalCents ?? 0;

  const hasFreeShipping =
    merchandiseTotalCents >= 10000;

  const freeShippingThresholdCents = 10000;
  const freeShippingRemainingCents =
    Math.max(
      0,
      freeShippingThresholdCents -
        merchandiseTotalCents
    );
  const freeShippingProgress =
    Math.min(
      100,
      Math.max(
        0,
        (merchandiseTotalCents /
          freeShippingThresholdCents) *
          100
      )
    );

  // Custo real da transportadora.
  const shippingCostCents =
    selectedShipping?.priceCents ?? 0;

  const cheapestShippingCents =
    shippingOptions.length > 0
      ? Math.min(
          ...shippingOptions.map(
            (option) =>
              option.priceCents
          )
        )
      : 0;

  const isCheapestShipping =
    Boolean(selectedShipping) &&
    shippingCostCents ===
      cheapestShippingCents;

  const shippingBenefitCents =
    selectedShipping
      ? hasFreeShipping
        ? isCheapestShipping
          // Acima de R$100:
          // menor modalidade 100% gratis.
          ? shippingCostCents

          // Modalidades superiores:
          // beneficio = 50% do menor frete.
          : Math.round(
              cheapestShippingCents *
                0.5
            )

        // Abaixo de R$100:
        // subsidio normal de 25%.
        : Math.round(
            shippingCostCents *
              0.25
          )
      : 0;

  const customerShippingCents =
    selectedShipping
      ? Math.max(
          0,
          shippingCostCents -
            shippingBenefitCents
        )
      : 0;

  const couponDiscountCents =
    appliedCoupon?.discountCents ?? 0;

  const partnerCouponDiscountCents =
    appliedPartnerCoupon?.discountCents ?? 0;

  const merchandiseAfterCouponsCents =
    Math.max(
      0,
      merchandiseTotalCents -
        couponDiscountCents -
        partnerCouponDiscountCents
    );

  const checkoutTotalCents =
    merchandiseAfterCouponsCents +
    customerShippingCents;

  const inputClass =
    "mt-2 w-full rounded-2xl border border-[#26352c]/15 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#26352c]/35 focus:border-[#26352c]/40";

  return (
    <main className="min-h-screen bg-[#f8f5ee] px-5 py-10 text-[#26352c] md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#26352c]/50">
              Bio Florais
            </p>

            <h1 className="mt-2 text-3xl font-medium md:text-4xl">
              Finalizar compra
            </h1>

            <p className="mt-3 text-sm text-[#26352c]/60">
              Preencha seus dados para entrega e pagamento.
            </p>
          </div>

          <Link
            href="/carrinho"
            // BIO_BACK_TO_CART_SAVE_DRAFT_V3
            onClick={() => {
              saveCheckoutDraft();
            }}
            className="text-sm font-medium underline underline-offset-4"
          >
            Voltar para a sacola
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <form
            id="bio-checkout-form"
            className="space-y-6"
            // BIO_CHECKOUT_DRAFT_FORM_AUTOSAVE_V3
            onInput={() => {
              window.setTimeout(saveCheckoutDraft, 0);
            }}
            onChange={() => {
              window.setTimeout(saveCheckoutDraft, 0);
            }}
            onSubmit={async (event) => {
              event.preventDefault();

              const form =
                event.currentTarget;

              if (!form.reportValidity()) {
                return;
              }

              setOrderError("");

              const formData =
                new FormData(form);

              const readField = (
                name: string
              ) =>
                String(
                  formData.get(name) ?? ""
                ).trim();

              const cep =
                readField(
                  "postalCode"
                ).replace(
                  /\D/g,
                  ""
                );

              if (cep.length !== 8) {
                setCepError(
                  "Informe um CEP valido antes de continuar."
                );

                const cepField =
                  form.elements.namedItem(
                    "postalCode"
                  ) as HTMLInputElement | null;

                cepField?.focus();
                return;
              }

              if (!selectedShipping) {
                setOrderError(
                  "Selecione uma modalidade de entrega."
                );

                document
                  .getElementById(
                    "bio-delivery-section"
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });

                return;
              }

              setCreatingOrder(true);

              try {

                const response =
                  await fetch(
                    "/api/orders/create",
                    {
                      method: "POST",

                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      body: JSON.stringify({
                        customer: {
                          name:
                            readField("name"),

                          email:
                            readField("email"),

                          phone:
                            readField("phone"),

                          personType:
                            readField("document")
                              .replace(/\D/g, "")
                              .length === 14
                              ? "pj"
                              : "pf",

                          cpf:
                            readField("document")
                              .replace(/\D/g, "")
                              .length === 11
                              ? readField("document")
                              : "",

                          cnpj:
                            readField("document")
                              .replace(/\D/g, "")
                              .length === 14
                              ? readField("document")
                              : "",

                          stateRegistration:
                            readField("document")
                              .replace(/\D/g, "")
                              .length === 14
                              ? readField("secondaryDocument")
                              : "",
                        },

                        address: {
                          cep:
                            cep,

                          street:
                            readField(
                              "street"
                            ),

                          number:
                            readField(
                              "number"
                            ),

                          complement:
                            readField(
                              "complement"
                            ),

                          district:
                            readField(
                              "neighborhood"
                            ),

                          city:
                            readField(
                              "city"
                            ),

                          state:
                            readField(
                              "state"
                            ),
                        },

                        items:
                          items.map(
                            (item) => ({
                              productSlug:
                                item.productSlug,

                              qty:
                                item.qty,
                            })
                          ),

                        offers:
                          offers.map(
                            (offer) => ({
                              code:
                                offer.code,

                              productSlugs:
                                offer.productSlugs,
                            })
                          ),

                        couponCode:
                          appliedCoupon?.code ??
                          null,

                        partnerCouponCode:
                          appliedPartnerCoupon?.code ??
                          null,

                        /*
                         * O navegador envia apenas
                         * a modalidade escolhida.
                         * O servidor recalcula o preco.
                         */
                        // BIO_PAYMENT_METHOD_TO_ORDER_V1
                         paymentMethod,
                        shippingServiceName:
                          selectedShipping.serviceName,
                      }),
                    }
                  );

                const data =
                  await response.json();

                if (!response.ok) {
                  throw new Error(
                    data?.error ??
                      "Nao foi possivel criar o pedido."
                  );
                }

                const orderId =
                  data?.order?.id;

                if (!orderId) {
                  throw new Error(
                    "Pedido criado sem identificador."
                  );
                }

                const cardEmail =
                  paymentMethod === "card"
                    ? String(readField("email") ?? "").trim()
                    : "";

                const cardTotal =
                  paymentMethod === "card"
                    ? Number(data.order.totalCents)
                    : null;

                window.sessionStorage.setItem(
                  "bio-payment-pending",
                  JSON.stringify({
                    orderId: data.order.id,
                    paymentMethod,
                    ...(paymentMethod === "card"
                      ? {
                          cardOrderTotalCents: cardTotal,
                          cardPayerEmail: cardEmail,
                          cartRequestKey: requestKey,
                        }
                      : {}),
                  })
                );

                setPendingOrderId(data.order.id);
                setPendingOrderStatus(
                  data.order.status ?? (paymentMethod === "card" ? "checkout_pending" : "pending")
                );

                if (paymentMethod === "card") {
                  setCardOrderTotalCents(cardTotal);
                  setCardPayerEmail(cardEmail);
                  setPendingCartRequestKey(requestKey);
                }

                setOrderError("");

              }
              catch (err) {

                setOrderError(
                  err instanceof Error
                    ? err.message
                    : "Nao foi possivel criar o pedido."
                );

              }
              finally {
                setCreatingOrder(false);
              }
            }}
          >
            <section className="rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#26352c]/45">
                    Etapa 1
                  </p>

                  <h2 className="mt-1 text-xl font-medium">
                    Seus dados
                  </h2>
                </div>              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-medium md:col-span-2">
                  Nome completo
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    className={inputClass}
                    placeholder="Seu nome completo"
                  />
                </label>

                <label className="text-sm font-medium">
                  E-mail
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={inputClass}
                    placeholder="voce@email.com"
                  />
                </label>

                <label className="text-sm font-medium">
                  Telefone
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    className={inputClass}
                    placeholder="(11) 99999-9999"
                  />
                </label>

                <label className="text-sm font-medium">
                  CPF ou CNPJ
                  <input
                    name="document"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    maxLength={18}
                    onChange={(event) => {
                      event.currentTarget.value =
                        formatDocument(
                          event.currentTarget.value
                        );
                    }}
                    className={inputClass}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  />
                </label>

                <label className="text-sm font-medium">
                  RG ou InscriÃ§Ã£o Estadual
                  <input
                    name="secondaryDocument"
                    className={inputClass}
                    placeholder="RG ou InscriÃ§Ã£o Estadual"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#26352c]/45">
                Etapa 2
              </p>

              <h2 className="mt-1 text-xl font-medium">
                EndereÃ§o de entrega
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-medium">
                  CEP
                  <input
                    name="postalCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    required
                    onBlur={handleCepBlur}
                    className={inputClass}
                    placeholder="00000-000"
                  />

                  {searchingCep ? (
                    <span className="mt-2 block text-xs text-[#26352c]/50">
                      Buscando endereÃ§o...
                    </span>
                  ) : null}

                  {cepError ? (
                    <span className="mt-2 block text-xs text-red-700">
                      {cepError}
                    </span>
                  ) : null}
                </label>

                <div className="hidden md:block" />

                <label className="text-sm font-medium md:col-span-2">
                  EndereÃ§o
                  <input
                    name="street"
                    autoComplete="address-line1"
                    required
                    className={inputClass}
                    placeholder="Rua, avenida..."
                  />
                </label>

                <label className="text-sm font-medium">
                  NÃºmero
                  <input
                    name="number"
                    onBlur={() => {
                      window.setTimeout(() => {
                        window.scrollBy({
                          top: 180,
                          behavior: "smooth",
                        });
                      }, 80);
                    }}
                    required
                    className={inputClass}
                    placeholder="123"
                  />
                </label>

                <label className="text-sm font-medium">
                  Complemento
                  <input
                    name="complement"
                    autoComplete="address-line2"
                    className={inputClass}
                    placeholder="Apto, bloco..."
                  />
                </label>

                <label className="text-sm font-medium">
                  Bairro
                  <input
                    name="neighborhood"
                    required
                    className={inputClass}
                    placeholder="Bairro"
                  />
                </label>

                <label className="text-sm font-medium">
                  Cidade
                  <input
                    name="city"
                    autoComplete="address-level2"
                    required
                    className={inputClass}
                    placeholder="Cidade"
                  />
                </label>

                <label className="text-sm font-medium">
                  Estado
                  <input
                    name="state"
                    autoComplete="address-level1"
                    required
                    maxLength={2}
                    className={inputClass}
                    placeholder="SP"
                  />
                </label>
              </div>
            </section>

            <section
              id="bio-delivery-section"
              className="rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm md:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#26352c]/45">
                Etapa 3
              </p>

              <h2 className="mt-1 text-xl font-medium">
                Entrega e benefÃ­cios
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-[#26352c]/10 bg-[#f8f5ee] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Frete
                      </p>

                      {calculatedCep ? (
                        <p className="mt-1 text-xs text-[#26352c]/45">
                          CEP{" "}
                          {calculatedCep.slice(0, 5)}
                          -
                          {calculatedCep.slice(5)}
                        </p>
                      ) : null}
                    </div>

                    {hasFreeShipping ? (
                      <span className="rounded-full bg-[#46644f]/10 px-3 py-1 text-[11px] font-semibold text-[#46644f]">
                        Frete grÃ¡tis
                      </span>
                    ) : null}
                  </div>

                  {hasFreeShipping ? (
                    <div className="mt-3 rounded-2xl border border-[#46644f]/15 bg-[#f3f6f1] p-4">
                      <p className="text-xs font-medium text-[#46644f]">
                        VocÃª ganhou frete grÃ¡tis{" "}
                        <span aria-hidden="true">
                          âœ“
                        </span>
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-[#26352c]/55">
                        Na modalidade econÃ´mica.
                      </p>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#46644f]/10">
                        <div className="h-full w-full rounded-full bg-[#46644f]" />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-[#46644f]/15 bg-[#f3f6f1] p-4">
                      <p className="text-xs font-medium text-[#26352c]">
                        Faltam{" "}
                        <strong className="font-semibold text-[#46644f]">
                          {formatMoney(
                            freeShippingRemainingCents
                          )}
                        </strong>{" "}
                        para vocÃª ganhar frete grÃ¡tis.
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-[#26352c]/55">
                        Enquanto isso, a Bio Florais subsidia 25% do seu frete.
                      </p>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#46644f]/10">
                        <div
                          className="h-full rounded-full bg-[#46644f] transition-[width] duration-300 ease-out"
                          style={{
                            width: `${freeShippingProgress}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {loadingShipping ? (
                    <p className="mt-4 text-xs text-[#26352c]/55">
                      Consultando opÃ§Ãµes de entrega...
                    </p>
                  ) : null}

                  {shippingError ? (
                    <p className="mt-4 text-xs leading-5 text-red-700">
                      {shippingError}
                    </p>
                  ) : null}

                  {!loadingShipping &&
                  !shippingError &&
                  shippingOptions.length === 0 ? (
                    <p className="mt-4 text-xs leading-5 text-[#26352c]/55">
                      Informe seu CEP para calcular as opÃ§Ãµes de entrega.
                    </p>
                  ) : null}

                  {shippingOptions.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {shippingOptions.map(
                        (option) => {
                          const selected =
                            selectedShipping?.serviceName ===
                              option.serviceName &&
                            selectedShipping?.priceCents ===
                              option.priceCents;

                          return (
                            <button
                              key={`${option.serviceName}-${option.priceCents}`}
                              type="button"
                              onClick={() =>
                                setSelectedShipping(option)
                              }
                              className={`w-full rounded-2xl border p-3 text-left transition ${
                                selected
                                  ? "border-[#26352c]/45 bg-white"
                                  : "border-[#26352c]/10 bg-white/60 hover:border-[#26352c]/25"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-xs font-medium">
                                    {option.serviceName}
                                  </p>

                                  <p className="mt-1 text-[11px] text-[#26352c]/50">
                                    Prazo estimado:{" "}
                                    {option.etaDays}{" "}
                                    {option.etaDays === 1
                                      ? "dia Ãºtil"
                                      : "dias Ãºteis"}
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  {(() => {
                                    const optionBenefitCents =
                                      hasFreeShipping
                                        ? option.priceCents ===
                                          cheapestShippingCents
                                          ? option.priceCents
                                          : Math.round(
                                              cheapestShippingCents *
                                                0.5
                                            )
                                        : Math.round(
                                            option.priceCents *
                                              0.25
                                          );

                                    const optionCustomerCents =
                                      Math.max(
                                        0,
                                        option.priceCents -
                                          optionBenefitCents
                                      );

                                    return (
                                      <>
                                        <p className="text-[10px] text-[#26352c]/45">
                                          PreÃ§o cheio{" "}
                                          <span className="font-medium text-[#26352c]/65">
                                            {formatMoney(
                                              option.priceCents
                                            )}
                                          </span>
                                        </p>

                                        <p className="mt-0.5 text-[10px] text-[#46644f]">
                                          BenefÃ­cio Bio{" "}
                                          <span className="font-medium">
                                            âˆ’{" "}
                                            {formatMoney(
                                              optionBenefitCents
                                            )}
                                          </span>
                                        </p>

                                        <p className="mt-1 text-xs font-semibold text-[#26352c]">
                                          VocÃª paga{" "}
                                          {optionCustomerCents ===
                                          0 ? (
                                            <span className="text-[#46644f]">
                                              GrÃ¡tis
                                            </span>
                                          ) : (
                                            formatMoney(
                                              optionCustomerCents
                                            )
                                          )}
                                        </p>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  ) : null}


                </div>

                <div className="rounded-2xl border border-[#26352c]/10 bg-[#f8f5ee] p-5">
                  <label className="text-sm font-medium">
                    Cupom de desconto
                  </label>

                  <div className="mt-2 flex gap-2">
                    <input
                      name="coupon"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(
                          event.target.value
                        );
                        setCouponError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleApplyCommercialCoupon();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-full border border-[#26352c]/15 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="Digite seu cupom"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        void handleApplyCommercialCoupon()
                      }
                      disabled={
                        loadingCoupon ||
                        !couponCode.trim() ||
                        !quote
                      }
                      className="rounded-full border border-[#26352c]/20 px-5 py-3 text-xs font-medium transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loadingCoupon
                        ? "Validando..."
                        : "Aplicar"}
                    </button>
                  </div>

                  {couponError ? (
                    <p className="mt-2 text-xs leading-5 text-red-700">
                      {couponError}
                    </p>
                  ) : null}

                  {appliedCoupon ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-xs">
                      <div>
                        <strong className="block font-medium">
                          {appliedCoupon.code}
                        </strong>
                        <span className="text-[#26352c]/55">
                          Cupom comercial Â· âˆ’{" "}
                          {formatMoney(
                            appliedCoupon.discountCents
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={removeCommercialCoupon}
                        className="text-[#26352c]/55 underline underline-offset-2"
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-[#26352c]/10 pt-4">
                    <label className="text-sm font-medium">
                      Cupom UGC/parceira
                    </label>

                    <p className="mt-1 text-[11px] leading-5 text-[#26352c]/45">
                      Recebeu um c\u00f3digo de uma parceira? Digite aqui.
                    </p>

                    <div className="mt-2 flex gap-2">
                      <input
                        name="partnerCoupon"
                        value={partnerCouponCode}
                        onChange={(event) => {
                          setPartnerCouponCode(
                            event.target.value
                          );
                          setPartnerCouponError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleApplyPartnerCoupon();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-full border border-[#26352c]/15 bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Digite o cupom da parceira"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void handleApplyPartnerCoupon()
                        }
                        disabled={
                          loadingPartnerCoupon ||
                          !partnerCouponCode.trim() ||
                          !quote
                        }
                        className="rounded-full border border-[#26352c]/20 px-5 py-3 text-xs font-medium transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loadingPartnerCoupon
                          ? "Validando..."
                          : "Aplicar"}
                      </button>
                    </div>

                    {partnerCouponError ? (
                      <p className="mt-2 text-xs leading-5 text-red-700">
                        {partnerCouponError}
                      </p>
                    ) : null}
                  </div>

                  {appliedPartnerCoupon ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-xs">
                      <div>
                        <strong className="block font-medium">
                          {appliedPartnerCoupon.code}
                        </strong>
                        <span className="text-[#26352c]/55">
                          Cupom UGC/parceira Â· âˆ’{" "}
                          {formatMoney(
                            appliedPartnerCoupon.discountCents
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={removePartnerCoupon}
                        className="text-[#26352c]/55 underline underline-offset-2"
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}

                  <p className="mt-3 text-[11px] leading-5 text-[#26352c]/45">
                    VocÃª pode usar 1 cupom comercial e 1 cupom de parceira/UGC no mesmo pedido.
                  </p>
                </div>
              </div>
            </section>

            <section
              id="bio-payment-section"
              className="rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#26352c]/45">
                    Etapa 4
                  </p>

                  <h2 className="mt-1 text-xl font-medium">
                    Pagamento
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#26352c]/60">
                    Escolha como deseja pagar o seu pedido.
                  </p>
                </div>

                <span className="rounded-full bg-[#f2f4ef] px-3 py-1.5 text-xs font-medium text-[#46644f]">
                  Pagamento seguro
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  aria-pressed={paymentMethod === "pix"}
                  className={`relative min-h-36 rounded-2xl border p-5 text-left transition ${
                    paymentMethod === "pix"
                      ? "border-[#46644f] bg-[#f5f7f2] shadow-sm"
                      : "border-[#26352c]/10 bg-white hover:border-[#46644f]/50"
                  }`}
                >
                  {paymentMethod === "pix" ? (
                    <span className="absolute right-4 top-4 rounded-full bg-[#46644f] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                      Selecionado
                    </span>
                  ) : null}

                  <div className="text-2xl">âš¡</div>

                  <p className="mt-4 font-medium">
                    Pix
                  </p>

                  <p className="mt-1 max-w-xs text-sm leading-5 text-[#26352c]/55">
                    Pagamento Ã  vista com QR Code e Pix Copia e Cola.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  aria-pressed={paymentMethod === "card"}
                  className={`relative min-h-36 rounded-2xl border p-5 text-left transition ${
                    paymentMethod === "card"
                      ? "border-[#46644f] bg-[#f5f7f2] shadow-sm"
                      : "border-[#26352c]/10 bg-white hover:border-[#46644f]/50"
                  }`}
                >
                  {paymentMethod === "card" ? (
                    <span className="absolute right-4 top-4 rounded-full bg-[#46644f] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                      Selecionado
                    </span>
                  ) : null}

                  <div className="text-2xl">ðŸ’³</div>

                  <p className="mt-4 font-medium">
                    CartÃ£o de crÃ©dito
                  </p>

                  <p className="mt-1 max-w-xs text-sm leading-5 text-[#26352c]/55">
                    Pagamento com cartÃ£o de crÃ©dito. Consulte as opÃ§Ãµes de parcelamento na prÃ³xima etapa.
                  </p>
                </button>
              </div>
            </section>
          </form>

          <aside className="h-fit rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-medium">
              Resumo do pedido
            </h2>

            {orderError ? (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-5 text-red-900">
                {orderError}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-900">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {quote?.items.map(
                (item) => (
                  <div
                    key={item.productSlug}
                    className="flex justify-between gap-5 text-sm"
                  >
                    <span className="text-[#26352c]/70">
                      {item.qty}Ã—{" "}
                      {item.name}
                    </span>

                    <strong className="shrink-0 font-medium">
                      {formatMoney(
                        item.unitPriceCents *
                          item.qty
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>

            {couponDiscountCents > 0 ? (
              <div className="mb-3 flex justify-between gap-5 text-sm text-[#46644f]">
                <span>Cupom comercial</span>
                <strong className="font-medium">
                  âˆ’ {formatMoney(couponDiscountCents)}
                </strong>
              </div>
            ) : null}

            {partnerCouponDiscountCents > 0 ? (
              <div className="mb-3 flex justify-between gap-5 text-sm text-[#46644f]">
                <span>Cupom UGC/parceira</span>
                <strong className="font-medium">
                  âˆ’ {formatMoney(partnerCouponDiscountCents)}
                </strong>
              </div>
            ) : null}
            <div className="my-6 h-px bg-[#26352c]/10" />

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-5">
                <span className="text-[#26352c]/60">
                  Subtotal
                </span>

                <strong className="font-medium">
                  {quote
                    ? formatMoney(
                        quote.grossSubtotalCents
                      )
                    : loading
                      ? "Calculando..."
                      : "â€”"}
                </strong>
              </div>

              {quote?.offerBreakdown?.map(
                (offer, index) => (
                  <div
                    key={
                      offer.code ??
                      index
                    }
                    className="flex justify-between gap-5 text-[#46644f]"
                  >
                    <span>
                      {offer.label ||
                        "Desconto de combo"}
                    </span>

                    <strong className="font-medium">
                      âˆ’{" "}
                      {formatMoney(
                        offer.discountCents
                      )}
                    </strong>
                  </div>
                )
              )}

              <div className="flex justify-between gap-5 text-[#26352c]/55">
                <span>
                  Entrega

                  {selectedShipping ? (
                    <span className="mt-0.5 block text-[10px]">
                      {selectedShipping.serviceName}
                    </span>
                  ) : null}
                </span>

                <span
                  className={
                    hasFreeShipping &&
                    selectedShipping
                      ? "font-medium text-[#46644f]"
                      : ""
                  }
                >
                  {loadingShipping
                    ? "Calculando..."
                    : selectedShipping
                      ? customerShippingCents === 0
                        ? "GrÃ¡tis"
                        : formatMoney(
                            customerShippingCents
                          )
                      : "A calcular"}
                </span>
              </div>
            </div>

            {couponDiscountCents > 0 ? (
              <div className="mb-3 flex justify-between gap-5 text-sm text-[#46644f]">
                <span>Cupom comercial</span>
                <strong className="font-medium">
                  âˆ’ {formatMoney(couponDiscountCents)}
                </strong>
              </div>
            ) : null}

            {partnerCouponDiscountCents > 0 ? (
              <div className="mb-3 flex justify-between gap-5 text-sm text-[#46644f]">
                <span>Cupom UGC/parceira</span>
                <strong className="font-medium">
                  âˆ’ {formatMoney(partnerCouponDiscountCents)}
                </strong>
              </div>
            ) : null}
            <div className="my-6 h-px bg-[#26352c]/10" />

                        <div className="mb-5 rounded-2xl bg-[#f5f7f2] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#26352c]/45">
                Forma de pagamento selecionada
              </p>

              <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                <strong className="font-medium">
                  {paymentMethod === "pix"
                    ? "âš¡ Pix"
                    : "ðŸ’³ CartÃ£o de crÃ©dito"}
                </strong>

                <span className="text-right text-[#26352c]/55">
                  {paymentMethod === "pix"
                    ? "Ã€ vista"
                    : "Parcelamento conforme adquirente"}
                </span>
              </div>
            </div>
<div className="flex items-end justify-between gap-5">
              <span className="font-medium">
                  Total
                </span>

              <strong className="text-2xl font-medium">
                {quote
                  ? formatMoney(
                        checkoutTotalCents
                      )
                  : loading
                    ? "..."
                    : "â€”"}
              </strong>
            </div>

            {pendingOrderId ? (
              <div
                id="bio-payment-pending-state"
                className="mt-6 rounded-2xl border border-[#46644f]/20 bg-[#f5f7f2] p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#46644f] text-sm text-white">
                    âœ“
                  </div>

                  <div>
                    <p className="font-medium text-[#26352c]">
                      {paymentMethod === "card" &&
                      pendingOrderStatus !== "paid"
                        ? "Pagamento pronto"
                        : "Pedido criado"}
                    </p>

                    <p className="mt-1 text-sm leading-5 text-[#26352c]/60">
                      {pendingOrderStatus === "paid"
                        ? "Pagamento confirmado."
                        : paymentMethod === "pix"
                          ? "Aguardando pagamento via Pix."
                          : "Preencha os dados do cartÃ£o abaixo para concluir sua compra."}
                    </p>

                    <p className="mt-2 text-xs text-[#26352c]/45">
                      Pedido {pendingOrderId}
                    </p>

                    {pendingOrderStatus !== "paid" ? (
                      <p className="mt-3 text-xs leading-5 text-[#26352c]/45">
                        Estamos acompanhando automaticamente o status do pagamento.
                      </p>
                    ) : null}
                    {paymentMethod === "card" &&
                    pendingOrderStatus !== "paid" &&
                    (!cardOrderTotalCents || !cardPayerEmail) ? (
                      <div className="mt-5 border-t border-[#26352c]/10 pt-5">
                        <p className="text-sm leading-5 text-[#26352c]/65">
                          Esta tentativa de pagamento nÃ£o pode ser retomada.
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            window.sessionStorage.removeItem(
                              "bio-payment-pending"
                            );
                            setPendingOrderId(null);
                            setPendingOrderStatus(null);
                            setCardOrderTotalCents(null);
                            setCardPayerEmail("");
                            setOrderError("");
                          }}
                          className="mt-3 w-full rounded-full border border-[#46644f]/30 bg-white px-4 py-3 text-sm font-medium text-[#26352c] transition hover:bg-[#f5f7f2]"
                        >
                          Fazer nova tentativa de pagamento
                        </button>
                      </div>
                    ) : null}

                    {paymentMethod === "pix" &&
                    pendingOrderStatus !== "paid" ? (
                      <div className="mt-5 border-t border-[#26352c]/10 pt-5">
                        {loadingPix ? (
                          <div className="rounded-xl bg-white/70 p-4 text-sm text-[#26352c]/60">
                            Gerando seu Pix...
                          </div>
                        ) : null}

                        {pixError ? (
                          <div className="rounded-xl border border-red-900/10 bg-white p-4">
                            <p className="text-sm font-medium text-[#26352c]">
                              NÃ£o foi possÃ­vel carregar o Pix.
                            </p>

                            <p className="mt-1 text-xs leading-5 text-[#26352c]/55">
                              {pixError}
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                setPixError("");
                                setPixPayment(null);
                                setPixRetryNonce(
                                  (value) => value + 1
                                );
                              }}
                              disabled={loadingPix}
                              className="mt-4 w-full rounded-full border border-[#26352c]/20 bg-[#26352c] px-4 py-3 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {loadingPix
                                ? "Tentando novamente..."
                                : "Tentar gerar Pix novamente"}
                            </button>
                          </div>
                        ) : null}

                        {pixPayment ? (
                          <div className="space-y-4">
                            {pixPayment.qrImageUrl ? (
                              <div className="flex justify-center">
                                <div className="rounded-2xl bg-white p-4 shadow-sm">
                                  <img
                                    src={pixPayment.qrImageUrl}
                                    alt="QR Code Pix"
                                    className="h-52 w-52 object-contain"
                                  />
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#26352c]/45">
                                Pix Copia e Cola
                              </p>

                              <div className="mt-2 rounded-xl bg-white p-3">
                                <p className="break-all text-xs leading-5 text-[#26352c]/65">
                                  {pixPayment.qrCode}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    pixPayment.qrCode
                                  );

                                  setPixCopied(true);

                                  window.setTimeout(
                                    () =>
                                      setPixCopied(false),
                                    2000
                                  );
                                } catch {
                                  setPixCopied(false);
                                }
                              }}
                              className="w-full rounded-full bg-[#46644f] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                            >
                              {pixCopied
                                ? "CÃ³digo Pix copiado"
                                : "Copiar cÃ³digo Pix"}
                            </button>

                            {pixPayment.expiresAt ? (
                              <p className="text-center text-xs text-[#26352c]/45">
                                Esta cobranÃ§a possui prazo de expiraÃ§Ã£o definido pelo provedor.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              form="bio-checkout-form"
              disabled={
                loading ||
                loadingShipping ||
                creatingOrder ||
                Boolean(pendingOrderId) ||
                !quote ||
                !selectedShipping ||
                Boolean(error) ||
                Boolean(shippingError)
              }
              className="mt-6 w-full rounded-full bg-[#26352c] px-6 py-3.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creatingOrder
                ? "Criando pedido..."
                : pendingOrderId
                  ? paymentMethod === "card" && pendingOrderStatus !== "paid" ? "Pagamento pendente" : "Pedido criado"
                  : paymentMethod === "pix"
                    ? "Continuar com Pix"
                    : "Continuar com cartÃ£o"}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-[#26352c]/45">
              {pendingOrderId
                ? pendingOrderStatus === "paid"
                  ? "Pagamento confirmado."
                  : "Sua compra ainda nÃ£o foi confirmada. Conclua o pagamento abaixo ou continue comprando."
                : "O pedido serÃ¡ criado com os valores, descontos e entrega confirmados acima."}
            </p>
          </aside>
        </div>
      </div>

      {/* BIO_WIDE_CARD_PAYMENT_SECTION_V1 */}
      {pendingOrderId &&
      paymentMethod === "card" &&
      pendingOrderStatus !== "paid" &&
      cardOrderTotalCents &&
      cardPayerEmail ? (
        <section
          id="bio-card-payment-section"
          className="mx-auto mt-8 w-full max-w-5xl scroll-mt-6 px-4 sm:px-6 lg:px-8"
        >
          <div className="rounded-[28px] border border-[#26352c]/10 bg-white p-4 shadow-[0_18px_60px_rgba(38,53,44,0.08)] sm:p-6 lg:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7445]">
                Finalize seu pagamento
              </p>

              <h2 className="mt-2 text-2xl font-medium text-[#26352c]">
                CartÃ£o de crÃ©dito
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#26352c]/60">
                Escolha o parcelamento e preencha os dados do cartÃ£o em ambiente seguro.
              </p>
            </div>

          {/* BIO_CONTINUE_SHOPPING_CARD_BUTTON_V1 */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#756674]">
              Ainda nÃ£o quer finalizar? Seu carrinho continuarÃ¡ disponÃ­vel.
            </p>

            <button
              type="button"
              onClick={continueShoppingFromCard}
              className="rounded-full border border-[#422347] bg-white px-5 py-2.5 text-sm font-extrabold text-[#422347] transition hover:bg-[#f7f1f5]"
            >
              â† Continuar comprando
            </button>
          </div>
            <MercadoPagoCardPayment
              orderId={pendingOrderId}
              amountCents={cardOrderTotalCents}
              payerEmail={cardPayerEmail}
              onStatusChange={(status) => {
                setPendingOrderStatus(status);
              }}
            />
          </div>
        </section>
      ) : null}
</main>
  );
}




