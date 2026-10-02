"use client";

/**
 * ADMIN B2B — aba "Boletos a receber" (C10): uma linha por PARCELA, vencidas
 * em destaque, filtros e "Dar baixa" / "Desfazer baixa".
 */

import { useCallback, useEffect, useState } from "react";

import { formatB2BCents } from "@/lib/b2b/format";
import { useAdminApi } from "./useAdminApi";

type Installment = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  responsibleName: string;
  installment: number;
  installments: number;
  dueDate: string | null;
  amountCents: number;
  status: "aberto" | "vencido" | "pago" | "cancelado";
  paidAt: string | null;
  paidCents: number | null;
  note: string | null;
};

const LABEL = { aberto: "Em aberto", vencido: "Vencido", pago: "Pago", cancelado: "Cancelado" } as const;
const CLASS = {
  aberto: "bg-[#e8f0ff] text-[#274b8f]",
  vencido: "bg-red-100 text-red-800",
  pago: "bg-[#e3f5e9] text-[#1f6b3a]",
  cancelado: "bg-[#f3eef2] text-[#7b6a77]",
} as const;
const fmt = (value: string | null) => (value ? value.split("-").reverse().join("/") : "—");
const field = "rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";

export default function BoletosTab() {
  const api = useAdminApi();
  const [rows, setRows] = useState<Installment[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [responsibles, setResponsibles] = useState<Array<{ id: string; name: string }>>([]);
  const [situacao, setSituacao] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [cliente, setCliente] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (situacao) query.set("situacao", situacao);
    if (de) query.set("de", de);
    if (ate) query.set("ate", ate);
    if (cliente) query.set("cliente", cliente);
    if (vendedor) query.set("vendedor", vendedor);
    const { ok, data } = await api(`/api/admin/b2b/boletos?${query.toString()}`);

    if (!ok) {
      setMessage(data.error ?? "Erro ao carregar.");
      return;
    }

    setRows(data.installments ?? []);
    setClients(data.clients ?? []);
    setResponsibles(data.responsibles ?? []);
  }, [api, situacao, de, ate, cliente, vendedor]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function baixa(row: Installment) {
    const today = new Date().toISOString().slice(0, 10);
    const paidAt = window.prompt(`Data do pagamento da parcela ${row.installment}/${row.installments} (#${row.orderNumber}) — AAAA-MM-DD:`, today);
    if (!paidAt) return;
    const value = window.prompt("Valor pago (R$):", (row.amountCents / 100).toFixed(2).replace(".", ","));
    if (value === null) return;
    const paidCents = Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
    let note: string | null = null;

    if (paidCents !== row.amountCents) {
      note = window.prompt("O valor é diferente do da parcela. Observação (obrigatória):");
      if (!note) return;
    }

    const { ok, data } = await api("/api/admin/b2b/boletos", {
      method: "POST",
      body: { action: "baixa", orderId: row.orderId, installment: row.installment, paidAt, paidCents, note },
    });
    setMessage(ok ? (data.orderPaid ? "Baixa registrada. Todas as parcelas pagas: pedido marcado como Pago." : "Baixa registrada.") : data.error ?? "Erro.");
    void load();
  }

  async function undo(row: Installment) {
    const reason = window.prompt("Motivo para desfazer a baixa (obrigatório):");
    if (!reason) return;
    const { ok, data } = await api("/api/admin/b2b/boletos", {
      method: "POST",
      body: { action: "undo", orderId: row.orderId, installment: row.installment, reason },
    });
    setMessage(ok ? "Baixa desfeita." : data.error ?? "Erro.");
    void load();
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-[#7b6a77]">
        Uma linha por parcela. A baixa registra a data e o valor pagos, alimenta a comissão da parcela (dia 10 do
        mês seguinte à baixa, nunca pelo vencimento) e, com todas as parcelas baixadas, marca o pedido como Pago.
      </p>
      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold text-[#7b6a77]">
          Situação
          <select className={`${field} block`} value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">Todas</option>
            <option value="aberto">Em aberto</option>
            <option value="vencido">Vencido</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Vencimento de
          <input className={`${field} block`} type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          até
          <input className={`${field} block`} type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Cliente
          <select className={`${field} block`} value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Todos</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Vendedor
          <select className={`${field} block`} value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {responsibles.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadfd9] bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-[#fbf5f1] text-xs uppercase tracking-[0.08em] text-[#7b6a77]">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Parcela</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Baixa</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e8e4]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#8a7886]">Nenhuma parcela.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.orderId}-${row.installment}`} className={row.status === "vencido" ? "bg-red-50" : ""}>
                <td className="px-4 py-3">#{row.orderNumber}</td>
                <td className="px-4 py-3">{row.clientName || "—"}</td>
                <td className="px-4 py-3">{row.responsibleName || "—"}</td>
                <td className="px-4 py-3">{row.installment}/{row.installments}</td>
                <td className="px-4 py-3 text-right">{formatB2BCents(row.amountCents)}</td>
                <td className="px-4 py-3">{fmt(row.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${CLASS[row.status]}`}>{LABEL[row.status]}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {row.paidAt ? `${fmt(row.paidAt)} · ${formatB2BCents(row.paidCents ?? 0)}` : "—"}
                  {row.note && <span className="block text-[#8a7886]">{row.note}</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {(row.status === "aberto" || row.status === "vencido") && (
                    <button type="button" onClick={() => baixa(row)} className="rounded-full bg-[#342737] px-3 py-1 text-xs font-extrabold text-white">
                      Dar baixa
                    </button>
                  )}
                  {row.status === "pago" && (
                    <button type="button" onClick={() => undo(row)} className="rounded-full border border-[#b33] px-3 py-1 text-xs font-extrabold text-[#b33]">
                      Desfazer baixa
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
