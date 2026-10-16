"use client";

/**
 * BIO FLORAIS B2B — "Lançar pedido" (o vendedor lança o pedido pelo cliente).
 * 1. Cliente: um dos dele OU novo (nome/razão social, CPF/CNPJ validado, e-mail, WhatsApp; aviso LGPD).
 *    CNPJ/CPF de cliente de OUTRO representante é recusado pelo servidor.
 * 2. Oferta: uma oferta ativa do cliente (com as promoções dela), "sem promoção" (preço B2B normal) ou
 *    montar uma nova no Offer Builder.
 * 3. Abre a MESMA loja do link do cliente em modo lançamento (?lancar=1); o servidor revalida tudo.
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { LAUNCH_LGPD_NOTICE } from "@/lib/b2b/launch-constants";

type ClientOption = { id: string; displayName: string };
type OfferOption = { id: string; lines: number; promotions: number; createdAt: string };

const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-3 text-base";
const big = "w-full rounded-full px-6 py-4 text-base font-extrabold disabled:opacity-50";

function launchUrl(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}lancar=1`;
}

export default function LaunchOrder({ clients }: { clients: ClientOption[] }) {
  const [clientList, setClientList] = useState(clients);
  const [mode, setMode] = useState<"existing" | "new">(clients.length > 0 ? "existing" : "new");
  const [clientId, setClientId] = useState("");
  const [form, setForm] = useState({ name: "", document: "", email: "", phone: "" });
  const [client, setClient] = useState<ClientOption | null>(null);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function chooseClient(chosen: ClientOption) {
    setError("");
    setBusy(true);

    try {
      const response = await fetch(`/api/b2b/launch/offers?clientId=${encodeURIComponent(chosen.id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível carregar as ofertas do cliente.");
        return;
      }

      setClient(chosen);
      setOffers((data.offers ?? []) as OfferOption[]);
    } finally {
      setBusy(false);
    }
  }

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const response = await fetch("/api/b2b/launch/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível cadastrar o cliente.");
        return;
      }

      const created = { id: String(data.clientId), displayName: String(data.displayName) };
      setClientList((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]));
      if (data.reused) setNotice("Este documento já é um cliente seu: usando o cadastro existente.");
      setBusy(false);
      await chooseClient(created);
    } finally {
      setBusy(false);
    }
  }

  async function openStore(url: string) {
    window.location.href = launchUrl(url);
  }

  async function useOffer(offerId: string) {
    setError("");
    setBusy(true);

    try {
      const response = await fetch(`/api/b2b/offers/link?offerId=${encodeURIComponent(offerId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error ?? "Não foi possível abrir o link desta oferta.");
        return;
      }

      await openStore(String(data.url));
    } finally {
      setBusy(false);
    }
  }

  async function withoutPromotion() {
    if (!client) return;
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/b2b/offers/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error ?? "Não foi possível preparar a oferta sem promoção.");
        return;
      }

      await openStore(String(data.url));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-2xl space-y-5" data-testid="lancar-pedido">
      {!client ? (
        <section className="rounded-[24px] border-2 border-[#55245f] bg-[#fbf6fc] p-5">
          <h2 className="text-xl font-extrabold text-[#55245f]">1. Para quem é o pedido?</h2>

          {clientList.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["existing", "new"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-3 text-sm font-extrabold ${
                    mode === value ? "bg-[#55245f] text-white" : "border border-[#d9c7dc] bg-white text-[#55245f]"
                  }`}
                >
                  {value === "existing" ? "Cliente meu" : "Novo cliente"}
                </button>
              ))}
            </div>
          )}

          {mode === "existing" && clientList.length > 0 ? (
            <div className="mt-4 space-y-3">
              <select className={input} value={clientId} onChange={(event) => setClientId(event.target.value)} aria-label="Cliente">
                <option value="">Escolha o cliente</option>
                {clientList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !clientId}
                onClick={() => {
                  const chosen = clientList.find((item) => item.id === clientId);
                  if (chosen) void chooseClient(chosen);
                }}
                className={`${big} bg-[#55245f] text-white`}
              >
                {busy ? "Carregando…" : "Continuar"}
              </button>
            </div>
          ) : (
            <form onSubmit={submitNew} className="mt-4 space-y-3">
              <input className={input} placeholder="Razão social ou nome" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={input} inputMode="numeric" placeholder="CNPJ ou CPF" required value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
              <input className={input} type="email" placeholder="E-mail do cliente" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className={input} inputMode="tel" placeholder="WhatsApp do cliente (com DDD)" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <p className="text-xs text-[#746471]" data-testid="lgpd-aviso">
                {LAUNCH_LGPD_NOTICE} O endereço de entrega é informado no fechamento do pedido.
              </p>
              <button type="submit" disabled={busy} className={`${big} bg-[#55245f] text-white`}>
                {busy ? "Cadastrando…" : "Cadastrar e continuar"}
              </button>
            </form>
          )}
        </section>
      ) : (
        <section className="rounded-[24px] border-2 border-[#55245f] bg-[#fbf6fc] p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-extrabold text-[#55245f]">2. Qual oferta usar para {client.displayName}?</h2>
            <button type="button" onClick={() => setClient(null)} className="shrink-0 text-xs font-bold text-[#63326d] underline">
              Trocar cliente
            </button>
          </div>
          {notice && <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</p>}

          <div className="mt-4 space-y-3">
            <button type="button" disabled={busy} onClick={withoutPromotion} className={`${big} bg-[#55245f] text-white`}>
              Sem promoção (preço B2B normal)
            </button>

            {offers.length > 0 && <p className="pt-1 text-xs font-extrabold uppercase tracking-wide text-[#9b6c24]">Ofertas ativas do cliente</p>}
            {offers.map((offer) => (
              <button
                key={offer.id}
                type="button"
                disabled={busy}
                onClick={() => void useOffer(offer.id)}
                className="w-full rounded-2xl border border-[#d9c7dc] bg-white p-4 text-left disabled:opacity-50"
              >
                <span className="block text-sm font-extrabold text-[#422347]">
                  {offer.lines} linha(s) · {offer.promotions} promoção(ões)
                </span>
                <span className="block text-xs text-[#8a7886]">
                  criada em {new Date(offer.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · usar esta oferta
                </span>
              </button>
            ))}

            <Link
              href={`/b2b/painel/cliente/${client.id}/oferta`}
              className="block rounded-full border-2 border-[#55245f] px-6 py-3.5 text-center text-sm font-extrabold text-[#55245f]"
            >
              Montar oferta com promoções (Offer Builder)
            </Link>
            <p className="text-xs text-[#8a7886]">
              Depois de gerar o link no Offer Builder, volte aqui e escolha a oferta ativa para lançar o pedido.
            </p>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
