"use client";

/**
 * ADMIN B2B — aba "Clientes do site (B2C)": compradores do site agrupados por e-mail (só leitura). Busca por e-mail, nome ou
 * cidade; cada cartão mostra cidade/UF, nº de pedidos, último pedido e total pago, com link para os pedidos do comprador.
 * Sem exportação de dados pessoais por enquanto.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

type SiteClient = {
  email: string;
  name: string;
  city: string | null;
  state: string | null;
  orders: number;
  paidOrders: number;
  totalPaidCents: number;
  lastOrderAt: string | null;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export default function SiteClientsTab() {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<SiteClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/admin/b2b/site-clients?q=${encodeURIComponent(query)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data.error ?? "Não foi possível buscar os clientes do site.");

        setClients(Array.isArray(data.clients) ? data.clients : []);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Não foi possível buscar os clientes do site.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section className="space-y-4" data-testid="site-clientes-tab">
      <p className="text-sm text-[#7b6a77]">Compradores do site (B2C) agrupados por e-mail, a partir dos pedidos. Somente leitura.</p>
      <input
        className="w-full max-w-xl rounded-xl border border-[#d9c7dc] bg-white px-3 py-2.5 text-sm"
        type="search"
        placeholder="Buscar por e-mail, nome ou cidade"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        data-testid="site-clientes-busca"
      />
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      {loading && <p className="text-sm text-[#7b6a77]">Buscando…</p>}
      {!loading && !error && clients.length === 0 && <p className="text-sm text-[#7b6a77]">Nenhum comprador encontrado.</p>}

      <ul className="grid gap-3 md:grid-cols-2" data-testid="site-clientes-lista">
        {clients.map((client) => (
          <li key={client.email} className="rounded-2xl border border-[#eadfd9] bg-white p-4">
            <p className="text-sm font-extrabold text-[#342737]">{client.name || "Sem nome"}</p>
            <p className="break-all text-xs text-[#7b6a77]">{client.email}</p>
            <p className="mt-1 text-xs text-[#5b4a58]">{[client.city, client.state].filter(Boolean).join("/") || "Cidade não informada"}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-[#fbf5f1] p-2">
                <dt className="font-bold text-[#7b6a77]">Pedidos</dt>
                <dd className="text-base font-extrabold text-[#342737]">{client.orders}</dd>
                <dd className="text-[10px] text-[#7b6a77]">{client.paidOrders} pago(s)</dd>
              </div>
              <div className="rounded-xl bg-[#fbf5f1] p-2">
                <dt className="font-bold text-[#7b6a77]">Último</dt>
                <dd className="text-sm font-extrabold text-[#342737]">{date(client.lastOrderAt)}</dd>
              </div>
              <div className="rounded-xl bg-[#fbf5f1] p-2">
                <dt className="font-bold text-[#7b6a77]">Total pago</dt>
                <dd className="text-sm font-extrabold text-[#342737]">{money(client.totalPaidCents)}</dd>
              </div>
            </dl>
            <Link href={`/admin/pedidos?cliente=${encodeURIComponent(client.email)}`} className="mt-3 inline-block text-xs font-extrabold text-[#55245f] underline underline-offset-2" data-testid="site-cliente-pedidos">
              Ver pedidos
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
