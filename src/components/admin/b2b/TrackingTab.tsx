"use client";

/**
 * ADMIN B2B — aba "Acompanhamento": ofertas, pedidos B2B, solicitações de
 * boleto (parcelas e vencimentos) e linhas abertas fora da oferta.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatB2BCents } from "@/lib/b2b/format";
import { formatB2BDueDate } from "@/lib/b2b/pricing";
import { useAdminApi } from "./useAdminApi";

type Offer = {
  id: string;
  createdAt: string;
  status: string;
  revokedAt: string | null;
  responsibleName: string;
  clientName: string;
  groups: string[];
  promotions: string[];
  linkStatus: "active" | "revoked" | "none";
};

type Order = {
  id: string;
  createdAt: string;
  status: string;
  fulfillmentStatus: string;
  paymentMethod: string | null;
  totalCents: number;
  responsibleName: string | null;
  customerName: string | null;
  personType: string | null;
  clientName: string | null;
};

type Boleto = {
  id: string;
  orderId: string;
  amountCents: number;
  installments: number;
  schedule: Array<{ installment: number; dueDate: string; amountCents: number }>;
  status: string;
  requestedAt: string;
  orderStatus: string;
  customerName: string | null;
};

type LineView = {
  offerId: string;
  clientName: string;
  responsibleName: string;
  lineName: string;
  views: number;
  lastViewedAt: string;
};

const METHOD_LABELS: Record<string, string> = { pix: "Pix", card: "Cartão", boleto: "Boleto" };
const LINK_LABELS = { active: "Link ativo", revoked: "Link revogado", none: "Sem link" } as const;

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

const card = "overflow-x-auto rounded-2xl border border-[#eadfd9] bg-white";
const th = "px-4 py-3";
const td = "px-4 py-3 align-top";

export default function TrackingTab() {
  const api = useAdminApi();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [lineViews, setLineViews] = useState<LineView[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { ok, data } = await api("/api/admin/b2b/tracking");

    if (!ok) {
      setMessage(data.error ?? "Erro ao carregar.");
      return;
    }

    setOffers(data.offers ?? []);
    setOrders(data.orders ?? []);
    setBoletos(data.boletos ?? []);
    setLineViews(data.lineViews ?? []);
  }, [api]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      {message && <p className="rounded-xl bg-[#fbe7e7] p-3 text-sm text-[#8f2727]">{message}</p>}

      <section>
        <h2 className="mb-1 font-extrabold">Linhas abertas fora da oferta</h2>
        <p className="mb-3 text-sm text-[#7b6a77]">
          O cliente abriu, pelo link da oferta, uma linha que não estava nela. O vendedor também vê
          isso no painel dele.
        </p>
        <div className={card}>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
              <tr><th className={th}>Cliente</th><th className={th}>Linha</th><th className={th}>Vendedor</th><th className={`${th} text-right`}>Vezes</th><th className={th}>Última vez</th></tr>
            </thead>
            <tbody className="divide-y divide-[#f1e9e4]">
              {lineViews.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[#7b6a77]">Nenhum registro ainda.</td></tr>}
              {lineViews.map((row) => (
                <tr key={`${row.offerId}-${row.lineName}`}>
                  <td className={td}>{row.clientName}</td>
                  <td className={`${td} font-bold`}>{row.lineName}</td>
                  <td className={td}>{row.responsibleName}</td>
                  <td className={`${td} text-right`}>{row.views}</td>
                  <td className={td}>{dateTime(row.lastViewedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-extrabold">Ofertas geradas</h2>
        <div className={card}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
              <tr><th className={th}>Data</th><th className={th}>Vendedor</th><th className={th}>Cliente</th><th className={th}>Linhas</th><th className={th}>Promoções</th><th className={th}>Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-[#f1e9e4]">
              {offers.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-[#7b6a77]">Nenhuma oferta ainda.</td></tr>}
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td className={td}>{dateTime(offer.createdAt)}</td>
                  <td className={td}>{offer.responsibleName}</td>
                  <td className={`${td} font-bold`}>{offer.clientName}</td>
                  <td className={`${td} text-xs`}>{offer.groups.join(", ") || "—"}</td>
                  <td className={`${td} text-xs`}>{offer.promotions.join(", ") || "—"}</td>
                  <td className={`${td} text-xs font-bold`}>
                    {offer.revokedAt ? "Oferta revogada" : LINK_LABELS[offer.linkStatus]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-extrabold">Pedidos B2B</h2>
        <div className={card}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
              <tr><th className={th}>Data</th><th className={th}>Pedido</th><th className={th}>Cliente</th><th className={th}>Vendedor</th><th className={th}>Pagamento</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#f1e9e4]">
              {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-[#7b6a77]">Nenhum pedido B2B ainda.</td></tr>}
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className={td}>{dateTime(order.createdAt)}</td>
                  <td className={td}>
                    <Link href={`/admin/pedidos/${order.id}`} className="font-bold text-[#63326d] underline">
                      {order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className={td}>
                    {order.clientName ?? "—"}
                    <span className="block text-xs text-[#7b6a77]">
                      {order.customerName} {order.personType ? `(${order.personType.toUpperCase()})` : ""}
                    </span>
                  </td>
                  <td className={td}>{order.responsibleName ?? "—"}</td>
                  <td className={td}>{order.paymentMethod ? METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod : "—"}</td>
                  <td className={`${td} text-right font-bold`}>{formatB2BCents(order.totalCents)}</td>
                  <td className={`${td} text-xs`}>{order.status} · {order.fulfillmentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-extrabold">Solicitações de boleto</h2>
        <div className={card}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
              <tr><th className={th}>Solicitado em</th><th className={th}>Pedido</th><th className={th}>Cliente</th><th className={`${th} text-right`}>Total</th><th className={th}>Parcelas e vencimentos</th><th className={th}>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#f1e9e4]">
              {boletos.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-[#7b6a77]">Nenhuma solicitação de boleto.</td></tr>}
              {boletos.map((boleto) => (
                <tr key={boleto.id}>
                  <td className={td}>{dateTime(boleto.requestedAt)}</td>
                  <td className={td}>
                    <Link href={`/admin/pedidos/${boleto.orderId}`} className="font-bold text-[#63326d] underline">
                      {boleto.orderId.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className={td}>{boleto.customerName ?? "—"}</td>
                  <td className={`${td} text-right font-bold`}>{formatB2BCents(boleto.amountCents)}</td>
                  <td className={`${td} text-xs`}>
                    {boleto.schedule.length > 0 ? (
                      <ul className="space-y-0.5">
                        {boleto.schedule.map((item) => (
                          <li key={item.installment}>
                            {item.installment}ª · {formatB2BDueDate(item.dueDate)} · {formatB2BCents(item.amountCents)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      `${boleto.installments}x (sem cronograma gravado)`
                    )}
                  </td>
                  <td className={`${td} text-xs`}>{boleto.status} · pedido {boleto.orderStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
