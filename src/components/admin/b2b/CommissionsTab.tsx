"use client";

/** ADMIN B2B — aba "Comissões": por vendedor/mês, marcar como paga (data) ou desfazer. */

import { useCallback, useEffect, useState } from "react";

import { formatB2BCents } from "@/lib/b2b/format";
import { useAdminApi } from "./useAdminApi";

type Row = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  responsibleName: string;
  clientName: string;
  paymentMethod: string | null;
  baseCents: number;
  basePercent: number | null;
  extraPercent: number | null;
  totalPercent: number | null;
  commissionCents: number | null;
  state: "aguardando" | "a_receber" | "paga" | "cancelada";
  payableOn: string | null;
  paidOutAt: string | null;
};

type Totals = { nextTenthCents: number; laterCents: number; receivedCents: number; waitingCents: number };

const LABEL = {
  aguardando: "Aguardando pagamento",
  a_receber: "A receber",
  paga: "Paga",
  cancelada: "Cancelada",
} as const;
const br = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const field = "rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";

export default function CommissionsTab() {
  const api = useAdminApi();
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [responsibles, setResponsibles] = useState<Array<{ id: string; name: string }>>([]);
  const [vendedor, setVendedor] = useState("");
  const [mes, setMes] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (vendedor) query.set("vendedor", vendedor);
    if (mes) query.set("mes", mes);
    const { ok, data } = await api(`/api/admin/b2b/commissions?${query.toString()}`);

    if (!ok) {
      setMessage(data.error ?? "Erro ao carregar.");
      return;
    }

    setRows(data.rows ?? []);
    setTotals(data.totals ?? null);
    setResponsibles(data.responsibles ?? []);
  }, [api, vendedor, mes]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function markPaid(row: Row) {
    const today = new Date().toISOString().slice(0, 10);
    const paidAt = window.prompt(`Data em que a comissão do pedido #${row.orderNumber} foi paga (AAAA-MM-DD):`, today);
    if (!paidAt) return;
    const { ok, data } = await api("/api/admin/b2b/commissions", { method: "POST", body: { orderId: row.orderId, paidAt } });
    setMessage(ok ? "Comissão marcada como paga." : data.error ?? "Erro.");
    void load();
  }

  async function undo(row: Row) {
    const note = window.prompt("Motivo para desfazer o pagamento:");
    if (note === null) return;
    const { ok, data } = await api("/api/admin/b2b/commissions", {
      method: "POST",
      body: { orderId: row.orderId, undo: true, note },
    });
    setMessage(ok ? "Pagamento desfeito." : data.error ?? "Erro.");
    void load();
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-[#7b6a77]">
        Base = valor pago dos produtos (sem frete). A comissão vira &quot;A receber&quot; no dia 10 do mês seguinte
        ao recebimento; no boleto, só depois da baixa da parcela (nunca pelo vencimento). Aqui você marca a comissão
        como paga ao vendedor.
      </p>
      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold text-[#7b6a77]">
          Vendedor
          <select className={`${field} block`} value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {responsibles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Mês do pedido
          <input className={`${field} block`} type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </label>
        {totals && (
          <p className="text-sm font-bold">
            Próximo dia 10: {formatB2BCents(totals.nextTenthCents)} · Depois: {formatB2BCents(totals.laterCents)} ·
            Pago: {formatB2BCents(totals.receivedCents)} · Aguardando: {formatB2BCents(totals.waitingCents)}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadfd9] bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#fbf5f1] text-xs uppercase tracking-[0.08em] text-[#7b6a77]">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3">%</th>
              <th className="px-4 py-3 text-right">Comissão</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e8e4]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#8a7886]">
                  Nenhum pedido.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.orderId}>
                <td className="px-4 py-3">{br(row.createdAt)}</td>
                <td className="px-4 py-3">{row.responsibleName}</td>
                <td className="px-4 py-3">{row.clientName || "—"}</td>
                <td className="px-4 py-3">
                  #{row.orderNumber} · {row.paymentMethod ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">{formatB2BCents(row.baseCents)}</td>
                <td className="px-4 py-3 text-xs">
                  {row.totalPercent === null ? "—" : `${row.basePercent}+${row.extraPercent}=${row.totalPercent}%`}
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  {row.commissionCents === null ? "—" : formatB2BCents(row.commissionCents)}
                </td>
                <td className="px-4 py-3 text-xs font-bold">
                  {row.state === "a_receber"
                    ? `A receber em ${br(row.payableOn)}`
                    : row.state === "paga"
                      ? `Paga em ${br(row.paidOutAt)}`
                      : LABEL[row.state]}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.state === "a_receber" && (
                    <button
                      type="button"
                      onClick={() => markPaid(row)}
                      className="rounded-full border border-[#342737] px-3 py-1 text-xs font-extrabold"
                    >
                      Marcar paga
                    </button>
                  )}
                  {row.state === "paga" && (
                    <button
                      type="button"
                      onClick={() => undo(row)}
                      className="rounded-full border border-[#b33] px-3 py-1 text-xs font-extrabold text-[#b33]"
                    >
                      Desfazer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
