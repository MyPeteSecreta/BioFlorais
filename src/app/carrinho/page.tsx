"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
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
  image?: string | null;
}

interface OfferBreakdown {
  code?: string;
  label?: string;
  discountCents: number;
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

function formatMoney(
  cents: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(
    cents / 100
  );
}

export default function CartPage() {
  const {
    items,
    offers,
    setQuantity,
    removeProduct,
    clearCart,
  } = useCart();

  const [
    quote,
    setQuote,
  ] =
    useState<Quote | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const loadQuote =
    useCallback(
      async () => {
        if (
          items.length === 0
        ) {
          setQuote(null);
          setError(null);
          return;
        }

        setLoading(true);
        setError(null);

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
                  JSON.stringify({
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
                          qty:
                            offer.qty,
                        })
                      ),
                  }),
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.error ||
                "Erro ao calcular a sacola."
            );
          }

          setQuote(
            data as Quote
          );
        } catch (err) {
          setQuote(null);

          setError(
            err instanceof Error
              ? err.message
              : "Erro ao calcular a sacola."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        items,
        offers,
      ]
    );

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const quoteBySlug =
    new Map(
      quote?.items.map(
        (item) => [
          item.productSlug,
          item,
        ]
      ) ?? []
    );

  return (
    <main className="min-h-screen bg-[#f8f5ee] text-[#26352c]">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-[#26352c]/10 pb-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-[#26352c]/55">
              Bio Florais
            </p>

            <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
              Sua sacola
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-full border border-[#26352c]/20 px-5 py-2.5 text-sm transition hover:bg-white"
          >
            Continuar comprando
          </Link>
        </div>

        {items.length === 0 ? (
          <section className="rounded-[28px] border border-[#26352c]/10 bg-white/70 p-8 text-center shadow-sm md:p-12">
            <h2 className="text-2xl font-medium">
              Sua sacola está vazia
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#26352c]/65">
              Escolha os florais e cuidados Bio Florais que deseja levar.
            </p>

            <Link
              href="/"
              className="mt-7 inline-flex rounded-full bg-[#26352c] px-7 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              Ver produtos
            </Link>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <section className="space-y-4">
              {items.map(
                (cartItem) => {
                  const serverItem =
                    quoteBySlug.get(
                      cartItem.productSlug
                    );

                  return (
                    <article
                      key={
                        cartItem.productSlug
                      }
                      className="rounded-[24px] border border-[#26352c]/10 bg-white/80 p-5 shadow-sm md:p-6"
                    >
                      <div className="flex gap-4 md:gap-6">
                        {cartItem.image ? (
                          <div className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#f2eee5] md:h-28 md:w-24">
                            <img
                              src={
                                cartItem.image
                              }
                              alt=""
                              className="h-full w-full object-contain p-2"
                            />
                          </div>
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-medium leading-snug">
                            {
                              cartItem.name
                            }
                          </h2>

                          <p className="mt-2 text-sm text-[#26352c]/65">
                            {serverItem
                              ? formatMoney(
                                  serverItem.unitPriceCents
                                )
                              : loading
                                ? "Calculando..."
                                : "Preço indisponível"}
                          </p>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                            <div className="inline-flex items-center overflow-hidden rounded-full border border-[#26352c]/15 bg-[#f8f5ee]">
                              <button
                                type="button"
                                aria-label="Diminuir quantidade"
                                className="h-10 w-11 text-lg transition hover:bg-white"
                                onClick={() =>
                                  setQuantity(
                                    cartItem.productSlug,
                                    cartItem.qty -
                                      1
                                  )
                                }
                              >
                                −
                              </button>

                              <span className="min-w-10 text-center text-sm font-medium">
                                {
                                  cartItem.qty
                                }
                              </span>

                              <button
                                type="button"
                                aria-label="Aumentar quantidade"
                                className="h-10 w-11 text-lg transition hover:bg-white"
                                onClick={() =>
                                  setQuantity(
                                    cartItem.productSlug,
                                    cartItem.qty +
                                      1
                                  )
                                }
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeProduct(
                                  cartItem.productSlug
                                )
                              }
                              className="text-sm text-[#26352c]/55 underline-offset-4 transition hover:text-[#26352c] hover:underline"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}

              <button
                type="button"
                onClick={
                  clearCart
                }
                className="px-2 py-2 text-sm text-[#26352c]/50 transition hover:text-[#26352c]"
              >
                Limpar sacola
              </button>
            </section>

            <aside className="h-fit rounded-[28px] border border-[#26352c]/10 bg-white p-6 shadow-sm lg:sticky lg:top-6">
              <h2 className="text-xl font-medium">
                Resumo
              </h2>

              {error ? (
                <div className="mt-5 rounded-2xl border border-red-900/10 bg-red-50 p-4 text-sm text-red-900">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-5">
                  <span className="text-[#26352c]/65">
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
                  (
                    offer,
                    index
                  ) => (
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

                {quote &&
                quote.offerDiscountCents >
                  0 &&
                quote.offerBreakdown
                  .length === 0 ? (
                  <div className="flex justify-between gap-5 text-[#46644f]">
                    <span>
                      Desconto de combo
                    </span>

                    <strong className="font-medium">
                      −{" "}
                      {formatMoney(
                        quote.offerDiscountCents
                      )}
                    </strong>
                  </div>
                ) : null}

                <div className="flex justify-between gap-5 text-[#26352c]/55">
                  <span>
                    Entrega
                  </span>

                  <span>
                    Calculada na próxima etapa
                  </span>
                </div>
              </div>

              <div className="my-6 h-px bg-[#26352c]/10" />

              <div className="flex items-end justify-between gap-5">
                <span className="font-medium">
                  Total parcial
                </span>

                <strong className="text-2xl font-medium">
                  {quote
                    ? formatMoney(
                        quote.totalCents
                      )
                    : loading
                      ? "..."
                      : "—"}
                </strong>
              </div>

              <p className="mt-3 text-xs leading-5 text-[#26352c]/50">
                Frete, cupons e demais benefícios serão calculados antes do pagamento.
              </p>

              <Link
                href="/checkout"
                aria-disabled={
                  loading ||
                  !quote ||
                  Boolean(error)
                }
                onClick={(event) => {
                  if (
                    loading ||
                    !quote ||
                    Boolean(error)
                  ) {
                    event.preventDefault();
                  }
                }}
                className={`mt-6 flex w-full items-center justify-center rounded-full bg-[#26352c] px-6 py-3.5 text-sm font-medium text-white transition ${
                  loading ||
                  !quote ||
                  Boolean(error)
                    ? "cursor-not-allowed opacity-40"
                    : "hover:opacity-90"
                }`}
              >
                Continuar compra
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

