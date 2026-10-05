"use client";

/**
 * Página pública "Acompanhe seu pedido".
 *  - Principal: e-mail + CPF/CNPJ (os dois) -> lista dos pedidos dos últimos 6 meses -> abre o acompanhamento.
 *  - Secundária ("Tenho o número do pedido"): número + e-mail OU CPF/CNPJ.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ListedOrder = { number: string; createdAt: string; totalCents: number; situation: string; url: string };

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const day = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export default function TrackOrderPage() {
  const router = useRouter();
  const [byNumber, setByNumber] = useState(false);
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [number, setNumber] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<ListedOrder[] | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOrders(null);

    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(byNumber ? { mode: "number", number, contact } : { mode: "contact", email, document }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível consultar agora.");
        return;
      }

      if (byNumber) {
        if (data.url) router.push(data.url);
        return;
      }

      setOrders(data.orders ?? []);
    } catch {
      setError("Não foi possível consultar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 block w-full rounded-xl border border-[#d9ccc4] bg-white px-4 py-3 text-base";

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">Bio Florais</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#55245f]">Acompanhe seu pedido</h1>
        <p className="mt-2 text-sm text-[#6c5b69]">
          {byNumber
            ? "Informe o número do pedido (está na confirmação da compra, ex.: 3F9A21C4) e o e-mail ou o CPF/CNPJ usado na compra."
            : "Informe o e-mail e o CPF/CNPJ usados na compra para ver seus pedidos dos últimos 6 meses."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm">
          {byNumber ? (
            <>
              <label className="block text-sm font-bold">
                Número do pedido
                <input className={field} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex.: 3F9A21C4" autoCapitalize="characters" required />
              </label>
              <label className="block text-sm font-bold">
                E-mail ou CPF/CNPJ
                <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="voce@email.com ou 000.000.000-00" required />
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm font-bold">
                E-mail
                <input className={field} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
              </label>
              <label className="block text-sm font-bold">
                CPF ou CNPJ
                <input className={field} inputMode="numeric" value={document} onChange={(e) => setDocument(e.target.value)} placeholder="000.000.000-00" required />
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="w-full rounded-full bg-[#55245f] py-3.5 text-base font-extrabold text-white disabled:opacity-60">
            {busy ? "Consultando…" : byNumber ? "Acompanhar" : "Ver meus pedidos"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setByNumber((value) => !value);
            setError("");
            setOrders(null);
          }}
          className="mt-4 w-full text-center text-sm font-bold text-[#63326d] underline underline-offset-4"
        >
          {byNumber ? "Prefiro buscar pelo e-mail e CPF/CNPJ" : "Tenho o número do pedido"}
        </button>

        {orders && orders.length > 0 && (
          <section className="mt-6" aria-label="Seus pedidos">
            <h2 className="font-extrabold">Seus pedidos (últimos 6 meses)</h2>
            <ul className="mt-3 space-y-3">
              {orders.map((order) => (
                <li key={order.url}>
                  <Link
                    href={order.url}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[#eadfd9] bg-white p-4 shadow-sm"
                  >
                    <span>
                      <span className="block font-extrabold">Pedido #{order.number}</span>
                      <span className="block text-xs text-[#8a7886]">
                        {day(order.createdAt)} · {brl(order.totalCents)}
                      </span>
                      <span className="mt-1 block text-sm font-bold text-[#55245f]">{order.situation}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#55245f] px-4 py-2 text-sm font-extrabold text-white">Abrir</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-center text-sm text-[#6c5b69]">
          Precisa de ajuda? Fale com o{" "}
          <Link href="/atendimento" className="font-bold text-[#63326d] underline">
            atendimento
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
