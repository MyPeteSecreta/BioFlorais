"use client";

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
  commissionPercent: number;
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
  } = useCart();

  const [
    quote,
    setQuote,
  ] =
    useState<Quote | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<"pix" | "card">("pix");

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
    loadingCoupon,
    setLoadingCoupon,
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
      };

      if (parsed.orderId) {
        setPendingOrderId(parsed.orderId);
      }

      if (
        parsed.paymentMethod === "pix" ||
        parsed.paymentMethod === "card"
      ) {
        setPaymentMethod(parsed.paymentMethod);
      }
    } catch {
      window.sessionStorage.removeItem(
        "bio-payment-pending"
      );
    }
  }, []);

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
        }
      } catch {
        // Falha temporária de consulta não altera o pedido.
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
  }, [pendingOrderId]);
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
              "Não foi possível gerar o Pix."
          );
        }

        if (
          !data?.paymentId ||
          !data?.pix?.qrCode
        ) {
          throw new Error(
            "A cobrança Pix foi criada sem os dados necessários."
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
            : "Não foi possível carregar o Pix."
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
  ]);
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
              "Não foi possível calcular o pedido."
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
              : "Não foi possível calcular o pedido."
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

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-[#f8f5ee] px-5 py-16 text-[#26352c]">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-[32px] border border-[#26352c]/10 bg-white p-8 text-center shadow-sm md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#26352c]/50">
              Checkout
            </p>

            <h1 className="mt-3 text-3xl font-medium">
              Sua sacola está vazia
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
            "Não foi possível calcular o frete."
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
                    /\s*Ã¢\s*/g,
                    " — "
                  )
                  .replace(
                    /\s*—\s*/g,
                    " — "
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
          "Nenhuma opção de entrega disponível para este CEP."
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
          : "Não foi possível calcular o frete."
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
        "Digite um CEP com 8 números."
      );
      return;
    }

    if (!form) {
      setCepError(
        "Não foi possível localizar o formulário."
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
          "CEP não encontrado."
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
        "Não foi possível consultar o CEP. Você pode preencher o endereço manualmente."
      );
    } finally {
      setSearchingCep(false);
    }
  }

  async function validateCoupon(
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
          "Nao foi possivel validar o cupom."
      );
    }

    return {
      code: data.coupon.code,
      discountType: data.coupon.discountType,
      discountValue: data.coupon.discountValue,
      discountCents: data.discountCents,
      couponType: data.coupon.couponType,
      partnerId: data.coupon.partnerId ?? null,
      commissionPercent:
        data.coupon.commissionPercent ?? 0,
    };
  }

  async function handleApplyCoupon() {
    const code =
      couponCode.trim().toUpperCase();

    if (!code || !quote) return;

    setLoadingCoupon(true);
    setCouponError("");

    try {
      const validation =
        await validateCoupon(
          code,
          quote.totalCents
        );

      if (validation.couponType === "partner") {

        if (appliedPartnerCoupon) {
          throw new Error(
            "Ja existe um cupom UGC/parceira aplicado."
          );
        }

        const partnerBaseCents =
          Math.max(
            0,
            quote.totalCents -
              (appliedCoupon?.discountCents ?? 0)
          );

        const partner =
          await validateCoupon(
            code,
            partnerBaseCents
          );

        setAppliedPartnerCoupon(partner);
      }
      else {

        if (appliedCoupon) {
          throw new Error(
            "Ja existe um cupom comercial aplicado."
          );
        }

        setAppliedCoupon(validation);

        if (appliedPartnerCoupon) {
          const partnerBaseCents =
            Math.max(
              0,
              quote.totalCents -
                validation.discountCents
            );

          const recalculatedPartner =
            await validateCoupon(
              appliedPartnerCoupon.code,
              partnerBaseCents
            );

          setAppliedPartnerCoupon(
            recalculatedPartner
          );
        }
      }

      setCouponCode("");
    }
    catch (err) {
      setCouponError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel aplicar o cupom."
      );
    }
    finally {
      setLoadingCoupon(false);
    }
  }

  function removeCommercialCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
  }

  function removePartnerCoupon() {
    setAppliedPartnerCoupon(null);
    setCouponError("");
  }
  const merchandiseTotalCents =
    quote?.totalCents ?? 0;

  const hasFreeShipping =
    merchandiseTotalCents >= 10000;

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
            className="text-sm font-medium underline underline-offset-4"
          >
            Voltar para a sacola
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <form
            id="bio-checkout-form"
            className="space-y-6"
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

                window.sessionStorage.setItem(
                  "bio-payment-pending",
                  JSON.stringify({
                    orderId: data.order.id,
                    paymentMethod,
                  })
                );

                setPendingOrderId(data.order.id);
                setPendingOrderStatus(
                  data.order.status ?? "awaiting_payment"
                );
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
                  RG ou Inscrição Estadual
                  <input
                    name="secondaryDocument"
                    className={inputClass}
                    placeholder="RG ou Inscrição Estadual"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#26352c]/45">
                Etapa 2
              </p>

              <h2 className="mt-1 text-xl font-medium">
                Endereço de entrega
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
                      Buscando endereço...
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
                  Endereço
                  <input
                    name="street"
                    autoComplete="address-line1"
                    required
                    className={inputClass}
                    placeholder="Rua, avenida..."
                  />
                </label>

                <label className="text-sm font-medium">
                  Número
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
                Entrega e benefícios
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
                        Frete grátis
                      </span>
                    ) : null}
                  </div>

                  {loadingShipping ? (
                    <p className="mt-4 text-xs text-[#26352c]/55">
                      Consultando opções de entrega...
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
                      Informe seu CEP para calcular as opções de entrega.
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
                                      ? "dia útil"
                                      : "dias úteis"}
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
                                          Preço cheio{" "}
                                          <span className="font-medium text-[#26352c]/65">
                                            {formatMoney(
                                              option.priceCents
                                            )}
                                          </span>
                                        </p>

                                        <p className="mt-0.5 text-[10px] text-[#46644f]">
                                          Benefício Bio{" "}
                                          <span className="font-medium">
                                            −{" "}
                                            {formatMoney(
                                              optionBenefitCents
                                            )}
                                          </span>
                                        </p>

                                        <p className="mt-1 text-xs font-semibold text-[#26352c]">
                                          Você paga{" "}
                                          {optionCustomerCents ===
                                          0 ? (
                                            <span className="text-[#46644f]">
                                              Grátis
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

                  {hasFreeShipping ? (
                    <p className="mt-3 text-[11px] leading-5 text-[#46644f]">
                      Acima de R$ 100,00, a opção econômica recebe gratuidade integral.
                    </p>
                  ) : (
                    <p className="mt-3 text-[11px] leading-5 text-[#46644f]">
                      A Bio Florais subsidia 25% do seu frete.
                    </p>
                  )}
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
                          void handleApplyCoupon();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-full border border-[#26352c]/15 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="Digite seu cupom"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        void handleApplyCoupon()
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
                          Cupom comercial · −{" "}
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

                  {appliedPartnerCoupon ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-xs">
                      <div>
                        <strong className="block font-medium">
                          {appliedPartnerCoupon.code}
                        </strong>
                        <span className="text-[#26352c]/55">
                          Cupom UGC/parceira · −{" "}
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
                    Você pode usar 1 cupom comercial e 1 cupom de parceira/UGC no mesmo pedido.
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

                  <div className="text-2xl">⚡</div>

                  <p className="mt-4 font-medium">
                    Pix
                  </p>

                  <p className="mt-1 max-w-xs text-sm leading-5 text-[#26352c]/55">
                    Pagamento à vista com QR Code e Pix Copia e Cola.
                  </p>
                </button>

                <button
                  type="button"
                  disabled
                  aria-disabled="true"
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

                  <div className="text-2xl">💳</div>

                  <p className="mt-4 font-medium">
                    Cartão de crédito
                  </p>

                  <p className="mt-1 max-w-xs text-sm leading-5 text-[#26352c]/55">
                    Pagamento com cartão de crédito. Consulte as opções de parcelamento na próxima etapa.
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
                      {item.qty}×{" "}
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
                  − {formatMoney(couponDiscountCents)}
                </strong>
              </div>
            ) : null}

            {partnerCouponDiscountCents > 0 ? (
              <div className="mb-3 flex justify-between gap-5 text-sm text-[#46644f]">
                <span>Cupom UGC/parceira</span>
                <strong className="font-medium">
                  − {formatMoney(partnerCouponDiscountCents)}
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
                      : "—"}
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
                      −{" "}
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
                        ? "Grátis"
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
                  − {formatMoney(couponDiscountCents)}
                </strong>
              </div>
            ) : null}

            {partnerCouponDiscountCents > 0 ? (
              <div className="mb-3 flex justify-between gap-5 text-sm text-[#46644f]">
                <span>Cupom UGC/parceira</span>
                <strong className="font-medium">
                  − {formatMoney(partnerCouponDiscountCents)}
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
                    ? "⚡ Pix"
                    : "💳 Cartão de crédito"}
                </strong>

                <span className="text-right text-[#26352c]/55">
                  {paymentMethod === "pix"
                    ? "À vista"
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
                    : "—"}
              </strong>
            </div>

            {pendingOrderId ? (
              <div
                id="bio-payment-pending-state"
                className="mt-6 rounded-2xl border border-[#46644f]/20 bg-[#f5f7f2] p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#46644f] text-sm text-white">
                    ✓
                  </div>

                  <div>
                    <p className="font-medium text-[#26352c]">
                      Pedido criado
                    </p>

                    <p className="mt-1 text-sm leading-5 text-[#26352c]/60">
                      {pendingOrderStatus === "paid"
                        ? "Pagamento confirmado."
                        : paymentMethod === "pix"
                          ? "Aguardando pagamento via Pix."
                          : "Aguardando pagamento com cartão."}
                    </p>

                    <p className="mt-2 text-xs text-[#26352c]/45">
                      Pedido {pendingOrderId}
                    </p>

                    {pendingOrderStatus !== "paid" ? (
                      <p className="mt-3 text-xs leading-5 text-[#26352c]/45">
                        Estamos acompanhando automaticamente o status do pagamento.
                      </p>
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
                              Não foi possível carregar o Pix.
                            </p>

                            <p className="mt-1 text-xs leading-5 text-[#26352c]/55">
                              {pixError}
                            </p>
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
                                ? "Código Pix copiado"
                                : "Copiar código Pix"}
                            </button>

                            {pixPayment.expiresAt ? (
                              <p className="text-center text-xs text-[#26352c]/45">
                                Esta cobrança possui prazo de expiração definido pelo provedor.
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
                  ? "Pedido criado"
                  : paymentMethod === "pix"
                    ? "Continuar com Pix"
                    : "Continuar com cartão"}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-[#26352c]/45">
              {pendingOrderId
                ? pendingOrderStatus === "paid"
                  ? "Pagamento confirmado."
                  : "Não feche esta página enquanto concluímos o pagamento."
                : "O pedido será criado com os valores, descontos e entrega confirmados acima."}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}




