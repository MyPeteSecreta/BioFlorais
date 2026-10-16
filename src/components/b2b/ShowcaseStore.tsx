"use client";

/**
 * BIO FLORAIS B2B — loja interna do MOSTRUÁRIO do vendedor/RCA.
 * Passos: escolher itens (com cota restante e data de liberação) -> entrega + frete regional ->
 * Pix (padrão) ou cartão. A tela só apresenta: o servidor revalida preço, itens e limites.
 */

import { useEffect, useMemo, useState } from "react";

import B2BMercadoPagoCardPayment from "@/components/payments/B2BMercadoPagoCardPayment";
import { formatB2BCents } from "@/lib/b2b/format";

export type StoreProduct = {
  id: string;
  label: string;
  volume: string;
  priceCents: number;
  b2cPriceCents: number;
  lineKey: string;
};

/** Teto da linha na janela (soma de todos os itens da linha). */
export type StoreLine = {
  key: string;
  name: string;
  cap: number;
  used: number;
  remaining: number;
  releasesAt: string | null;
};

export type StoreSection = {
  key: string;
  title: string;
  limit: number;
  used: number;
  remaining: number;
  releasesAt: string | null;
  products: StoreProduct[];
};

export type StoreVendor = {
  name: string;
  email: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type Address = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

type QuoteOption = { serviceName: string; etaDays: number; priceCents: number; totalCents: number };
type Quote = { subtotalCents: number; state: string; options: QuoteOption[] };
type CreatedOrder = { id: string; paymentMethod: "pix" | "card"; totalCents: number; payerEmail: string };

const field = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-2.5 text-sm";
const dateBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function ShowcaseStore({
  sections,
  lines,
  vendor,
  windowDays,
  percent,
}: {
  sections: StoreSection[];
  lines: StoreLine[];
  vendor: StoreVendor;
  windowDays: number;
  percent: number;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"shop" | "checkout">("shop");
  const [address, setAddress] = useState<Address>({
    cep: vendor.postalCode,
    street: vendor.street,
    number: vendor.addressNumber,
    complement: vendor.addressComplement,
    district: vendor.neighborhood,
    city: vendor.city,
    state: vendor.state,
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [pix, setPix] = useState<{ qrCode: string; qrImageUrl: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; text: string } | null>(null);

  const productById = useMemo(() => {
    const map = new Map<string, StoreProduct & { sectionKey: string }>();
    for (const section of sections) for (const product of section.products) map.set(product.id, { ...product, sectionKey: section.key });
    return map;
  }, [sections]);

  const usedBySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, count] of Object.entries(qty)) {
      const product = productById.get(id);
      if (product && count > 0) map.set(product.sectionKey, (map.get(product.sectionKey) ?? 0) + count);
    }
    return map;
  }, [qty, productById]);

  const usedByLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, count] of Object.entries(qty)) {
      const product = productById.get(id);
      if (product && count > 0) map.set(product.lineKey, (map.get(product.lineKey) ?? 0) + count);
    }
    return map;
  }, [qty, productById]);
  const lineByKey = useMemo(() => new Map(lines.map((line) => [line.key, line])), [lines]);

  const items = Object.entries(qty)
    .filter(([, count]) => count > 0)
    .map(([productId, count]) => ({ productId, qty: count }));
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotalCents = items.reduce((sum, item) => sum + (productById.get(item.productId)?.priceCents ?? 0) * item.qty, 0);
  const option = quote?.options[0] ?? null;

  function change(product: StoreProduct, sectionKey: string, delta: number) {
    const section = sections.find((candidate) => candidate.key === sectionKey);
    if (!section) return;

    setQuote(null);
    setQty((current) => {
      const now = current[product.id] ?? 0;
      const used = usedBySection.get(sectionKey) ?? 0;
      const next = Math.max(0, now + delta);
      if (delta > 0 && used >= section.remaining) return current;
      // Teto da linha: soma de todos os itens da linha (qualquer grupo).
      const line = lineByKey.get(product.lineKey);
      if (delta > 0 && line && (usedByLine.get(product.lineKey) ?? 0) >= line.remaining) return current;
      return { ...current, [product.id]: next };
    });
  }

  async function calculate() {
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/b2b/showcase/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, cep: address.cep, state: address.state }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.quote) {
        setQuote(null);
        setError(data?.error ?? "Não foi possível calcular o frete agora.");
        return;
      }

      setQuote(data.quote as Quote);
    } finally {
      setBusy(false);
    }
  }

  async function startPix(orderId: string) {
    const route =
      process.env.NEXT_PUBLIC_PIX_PROVIDER === "lunium" ? "/api/b2b/payments/lunium/pix" : "/api/b2b/payments/mercadopago/pix";
    const response = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, b2bToken: "" }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.pix?.qrCode) {
      setError(data?.error ?? "Não foi possível gerar o Pix.");
      return;
    }

    setPix({ qrCode: data.pix.qrCode, qrImageUrl: data.pix.qrImageUrl ?? null });
  }

  async function finish() {
    if (!option) return;
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/b2b/showcase/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          address: {
            cep: address.cep,
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: address.city,
            state: address.state,
          },
          shipping: { serviceName: option.serviceName },
          paymentMethod: method,
          installments: 1,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.order?.id) {
        setError(data?.error ?? "Não foi possível criar o pedido agora.");
        return;
      }

      const created: CreatedOrder = {
        id: String(data.order.id),
        paymentMethod: method,
        totalCents: Number(data.order.totalCents),
        payerEmail: String(data.order.payerEmail ?? vendor.email),
      };
      setOrder(created);

      if (method === "pix") await startPix(created.id);
    } finally {
      setBusy(false);
    }
  }

  // Polling do Pix: a tela confirma sozinha.
  useEffect(() => {
    if (!order || order.paymentMethod !== "pix" || !pix || done) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}/status`, { cache: "no-store" });
        const data = await response.json();
        if (data?.paid) setDone({ ok: true, text: "Pagamento Pix confirmado. Seu mostruário será preparado!" });
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [order, pix, done]);

  const addressComplete =
    address.cep.replace(/\D/g, "").length === 8 &&
    address.street.trim() &&
    address.number.trim() &&
    address.district.trim() &&
    address.city.trim() &&
    address.state.trim().length === 2;

  // ----- Pagamento
  if (order) {
    return (
      <div className="mt-6 max-w-xl" data-testid="showcase-payment">
        <h2 className="text-2xl font-extrabold text-[#55245f]">Pagamento do mostruário</h2>
        <p className="mt-1 text-sm text-[#746471]">
          Pedido de mostruário · total <strong>{formatB2BCents(order.totalCents)}</strong>
        </p>

        {done ? (
          <p role="status" className={`mt-5 rounded-2xl p-4 text-sm font-bold ${done.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
            {done.text}
          </p>
        ) : (
          <>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                {error}
              </p>
            )}

            {order.paymentMethod === "card" && (
              <div className="mt-5">
                <B2BMercadoPagoCardPayment
                  orderId={order.id}
                  b2bToken=""
                  amountCents={order.totalCents}
                  payerEmail={order.payerEmail}
                  onStatusChange={(status) => {
                    if (status === "paid" || status === "authorized") {
                      setDone({ ok: true, text: "Pagamento aprovado. Seu mostruário será preparado!" });
                    } else if (status === "pending") {
                      setDone({ ok: true, text: "Pagamento em análise pelo Mercado Pago. Avisaremos quando for aprovado." });
                    } else {
                      setError("Pagamento não aprovado. Confira os dados ou use outro cartão.");
                    }
                  }}
                />
              </div>
            )}

            {order.paymentMethod === "pix" && pix && (
              <section className="mt-5 rounded-[20px] border border-[#eadfd9] bg-white p-5 text-center">
                <h3 className="text-lg font-bold">Pague com Pix</h3>
                {pix.qrImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pix.qrImageUrl} alt="QR Code Pix" className="mx-auto mt-4 h-56 w-56" />
                )}
                <textarea readOnly value={pix.qrCode} className="mt-4 h-24 w-full rounded-xl border border-[#d9c7dc] p-2 text-xs" />
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
                <p className="mt-3 text-xs text-[#8a7886]">Aguardando confirmação do pagamento… esta tela atualiza sozinha.</p>
              </section>
            )}

            {order.paymentMethod === "pix" && !pix && !error && <p className="mt-5 text-sm">Gerando o Pix…</p>}

            {order.paymentMethod === "pix" && !pix && error && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  void startPix(order.id);
                }}
                className="mt-4 rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white"
              >
                Tentar gerar o Pix de novo
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // ----- Entrega + frete + forma de pagamento
  if (step === "checkout") {
    return (
      <div className="mt-6 max-w-2xl space-y-5 pb-10" data-testid="showcase-checkout">
        <button type="button" onClick={() => setStep("shop")} className="text-sm font-bold text-[#63326d] underline">
          ← Voltar aos itens
        </button>

        <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-extrabold text-[#422347]">Resumo do mostruário</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {items.map((item) => {
              const product = productById.get(item.productId);
              return (
                <li key={item.productId} className="flex justify-between gap-3">
                  <span>
                    {item.qty}× {product?.label} {product?.volume ? `· ${product.volume}` : ""}
                  </span>
                  <strong className="shrink-0">{formatB2BCents((product?.priceCents ?? 0) * item.qty)}</strong>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex justify-between border-t border-[#eee5df] pt-3 text-sm">
            <span>Produtos</span>
            <strong>{formatB2BCents(subtotalCents)}</strong>
          </p>
        </section>

        <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5">
          <h2 className="font-extrabold text-[#422347]">Entrega (seu endereço — pode editar)</h2>
          <p className="mt-1 text-xs text-[#8a7886]">Comprador: {vendor.name}</p>
          <div className="mt-3 grid grid-cols-6 gap-3">
            <label className="col-span-6 text-xs font-bold text-[#7b6a77] sm:col-span-2">
              CEP
              <input
                className={field}
                inputMode="numeric"
                maxLength={9}
                value={address.cep}
                onChange={(e) => {
                  setQuote(null);
                  setAddress({ ...address, cep: e.target.value });
                }}
              />
            </label>
            <label className="col-span-6 text-xs font-bold text-[#7b6a77] sm:col-span-4">
              Rua
              <input className={field} value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
            </label>
            <label className="col-span-3 text-xs font-bold text-[#7b6a77] sm:col-span-2">
              Número
              <input className={field} value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
            </label>
            <label className="col-span-3 text-xs font-bold text-[#7b6a77] sm:col-span-4">
              Complemento
              <input className={field} value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
            </label>
            <label className="col-span-6 text-xs font-bold text-[#7b6a77] sm:col-span-3">
              Bairro
              <input className={field} value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} />
            </label>
            <label className="col-span-4 text-xs font-bold text-[#7b6a77] sm:col-span-2">
              Cidade
              <input className={field} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </label>
            <label className="col-span-2 text-xs font-bold text-[#7b6a77] sm:col-span-1">
              UF
              <input
                className={field}
                maxLength={2}
                value={address.state}
                onChange={(e) => {
                  setQuote(null);
                  setAddress({ ...address, state: e.target.value.toUpperCase() });
                }}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !addressComplete}
            onClick={calculate}
            className="mt-4 w-full rounded-full border-2 border-[#55245f] py-3 text-sm font-extrabold text-[#55245f] disabled:opacity-50"
          >
            {busy && !quote ? "Calculando..." : "Calcular frete e total"}
          </button>
        </section>

        {option && quote && (
          <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5" data-testid="showcase-quote">
            <h2 className="font-extrabold text-[#422347]">Frete e forma de pagamento</h2>
            <p className="mt-2 flex justify-between text-sm">
              <span>
                Frete mostruário · {option.serviceName} (até {option.etaDays} dias úteis)
              </span>
              <strong>{formatB2BCents(option.priceCents)}</strong>
            </p>
            <p className="mt-2 flex justify-between border-t border-[#eee5df] pt-2 text-base">
              <span className="font-bold">Total</span>
              <strong data-testid="showcase-total">{formatB2BCents(option.totalCents)}</strong>
            </p>

            <fieldset className="mt-4">
              <legend className="text-xs font-extrabold uppercase tracking-wide text-[#9b6c24]">Pagamento</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["pix", "card"] as const).map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-2xl border-2 p-3 text-center text-sm font-extrabold ${
                      method === value ? "border-[#55245f] bg-[#f6eef7]" : "border-[#eadfd9]"
                    }`}
                  >
                    <input type="radio" name="showcase-method" className="sr-only" checked={method === value} onChange={() => setMethod(value)} />
                    {value === "pix" ? "Pix" : "Cartão de crédito"}
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              disabled={busy}
              onClick={finish}
              className="mt-5 w-full rounded-full bg-[#55245f] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "Registrando..." : "Finalizar pedido de mostruário"}
            </button>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ----- Itens
  return (
    <div className="mt-6 pb-28" data-testid="showcase-shop">
      <p className="max-w-3xl text-sm text-[#746471]">
        Preço de mostruário ({percent}% do preço de loja), só o menor volume de cada item. Cada grupo tem um limite numa
        janela de {windowDays} dias: abaixo você vê quanto ainda pode pegar e quando libera de novo.
      </p>

      {sections.length === 0 ? (
        <p className="mt-6 rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
          Nenhum item liberado para mostruário agora.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {sections.map((section) => {
            const inCart = usedBySection.get(section.key) ?? 0;
            const sectionLines = Array.from(new Set(section.products.map((product) => product.lineKey)))
              .map((key) => lineByKey.get(key))
              .filter((line): line is StoreLine => Boolean(line));
            const lineBlocked = sectionLines.length > 0 && sectionLines.every((line) => line.remaining <= 0);
            const blocked = section.remaining <= 0 || lineBlocked;

            return (
              <section key={section.key} className="rounded-[24px] border border-[#eadfd9] bg-white p-4 sm:p-5" data-testid="showcase-section">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-extrabold text-[#422347]">{section.title}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                      blocked ? "bg-stone-100 text-stone-600" : "bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    {blocked
                      ? "Limite atingido"
                      : `Você ainda pode pegar ${Math.max(0, section.remaining - inCart)} de ${section.limit}`}
                  </span>
                </div>
                {section.used > 0 && section.releasesAt && (
                  <p className="mt-1 text-xs text-[#8a7886]">
                    {blocked ? "Libera de novo em " : "Próxima liberação em "}
                    <strong>{dateBr(section.releasesAt)}</strong>.
                  </p>
                )}

                {sectionLines.map((line) => (
                  <p key={line.key} className="mt-1 text-xs text-[#8a7886]" data-testid="showcase-line-cap">
                    Você ainda pode pedir <strong>{Math.max(0, line.remaining - (usedByLine.get(line.key) ?? 0))}</strong> desta linha
                    ({line.name}: teto de {line.cap} a cada {windowDays} dias
                    {line.used > 0 && line.releasesAt ? `, libera em ${dateBr(line.releasesAt)}` : ""}).
                  </p>
                ))}

                <ul className="mt-3 divide-y divide-[#f0e8e3]">
                  {section.products.map((product) => {
                    const count = qty[product.id] ?? 0;
                    return (
                      <li key={product.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-[#342737]">{product.label}</p>
                          <p className="text-xs text-[#8a7886]">
                            {product.volume && `${product.volume} · `}
                            <strong className="text-[#55245f]">{formatB2BCents(product.priceCents)}</strong>
                            <span className="ml-1 line-through">{formatB2BCents(product.b2cPriceCents)}</span>
                          </p>
                        </div>
                        {blocked ? (
                          <span className="shrink-0 text-xs font-bold text-stone-500">Indisponível</span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              aria-label={`Diminuir ${product.label}`}
                              disabled={count === 0}
                              onClick={() => change(product, section.key, -1)}
                              className="h-9 w-9 rounded-full border border-[#d9c7dc] text-lg font-extrabold disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-extrabold">{count}</span>
                            <button
                              type="button"
                              aria-label={`Aumentar ${product.label}`}
                              disabled={
                                inCart >= section.remaining ||
                                (usedByLine.get(product.lineKey) ?? 0) >= (lineByKey.get(product.lineKey)?.remaining ?? Infinity)
                              }
                              onClick={() => change(product, section.key, 1)}
                              className="h-9 w-9 rounded-full bg-[#55245f] text-lg font-extrabold text-white disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eadfd9] bg-white px-4 py-3 shadow-[0_-6px_20px_rgba(66,35,71,0.08)]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3">
          <p className="text-sm">
            <strong>{totalItems}</strong> {totalItems === 1 ? "item" : "itens"} ·{" "}
            <strong data-testid="showcase-subtotal">{formatB2BCents(subtotalCents)}</strong>
          </p>
          <button
            type="button"
            disabled={totalItems === 0}
            onClick={() => setStep("checkout")}
            className="rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
