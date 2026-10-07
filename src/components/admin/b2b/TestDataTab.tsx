"use client";

/**
 * ADMIN B2B — aba "Dados de teste": candidatos com caixa de seleção; "Arquivar selecionados" some com
 * os registros das listas (nada é apagado) e dá para desfazer por lote. Pedido pago de verdade exige
 * confirmação linha a linha.
 */

import { useCallback, useEffect, useState } from "react";

type Candidates = {
  responsibles: Array<{ id: string; name: string; email: string; status: string }>;
  clients: Array<{ id: string; name: string; email: string | null }>;
  orders: Array<{ id: string; number: string; status: string; totalCents: number; createdAt: string; reason: string; paidForReal: boolean }>;
};
type Batch = { batchId: string; at: string; responsibles: number; clients: number; orders: number; restored: boolean };

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const day = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function TestDataTab() {
  const [data, setData] = useState<{ ready: boolean; candidates: Candidates; batches: Batch[] } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [vendors, setVendors] = useState<Set<string>>(new Set());
  const [clients, setClients] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<Set<string>>(new Set());
  const [paidOk, setPaidOk] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/b2b/test-data", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(json.error ?? "Erro ao carregar.");
      return;
    }

    setData(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (set: Set<string>, setter: (next: Set<string>) => void, id: string) => {
    const next = new Set(set);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    setter(next);
  };

  async function send(body: unknown) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/b2b/test-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(json.error ?? "Erro.");
        return;
      }

      return json;
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!window.confirm("Arquivar os itens selecionados? Eles somem de listas, comissões e acompanhamento; nada é apagado e dá para desfazer.")) return;

    const json = await send({
      action: "archive",
      responsibleIds: [...vendors],
      clientIds: [...clients],
      orderIds: [...orders],
      confirmedPaidOrderIds: [...paidOk],
    });

    if (!json) return;

    setMessage(
      `Arquivado: ${json.responsibles} vendedor(es), ${json.clients} cliente(s), ${json.orders} pedido(s).` +
        (json.skippedPaid?.length ? ` ${json.skippedPaid.length} pedido(s) pago(s) de verdade ficaram de fora (falta a confirmação linha a linha).` : "")
    );
    setVendors(new Set());
    setClients(new Set());
    setOrders(new Set());
    setPaidOk(new Set());
    void load();
  }

  async function restore(batchId: string) {
    if (!window.confirm("Desfazer este lote? Os itens voltam às listas.")) return;

    const json = await send({ action: "restore", batchId });

    if (json) {
      setMessage(`Desfeito: ${json.restored} item(ns) voltaram.`);
      void load();
    }
  }

  if (!data) return <p className="mt-6 text-sm text-[#7b6a77]">{message || "Carregando…"}</p>;

  const { candidates, batches } = data;
  const nothing = !candidates.responsibles.length && !candidates.clients.length && !candidates.orders.length;
  const box = "h-5 w-5 shrink-0";

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-[#fff4db] p-3 text-sm text-[#8a5a12]">
        Candidatos: vendedores e clientes com “teste” no nome/e-mail ou @example.invalid, e pedidos com o cupom TESTEB2B95 ou ligados a eles.
        Arquivar <strong>não apaga nada</strong>: some das listas, painéis, comissões, boletos, Central e acompanhamento, e dá para desfazer.
      </p>

      {!data.ready && <p className="rounded-xl bg-[#fbe7e7] p-3 text-sm text-[#8f2727]">O SQL 32b ainda não foi aplicado: a lista abaixo é só para conferência.</p>}
      {message && <p className="rounded-xl bg-[#f3eef2] p-3 text-sm">{message}</p>}
      {nothing && <p className="text-sm text-[#7b6a77]">Nenhum candidato a dado de teste.</p>}

      {candidates.responsibles.length > 0 && (
        <section className="rounded-2xl border border-[#eadfd9] bg-white p-4">
          <h3 className="font-extrabold">Vendedores ({candidates.responsibles.length})</h3>
          <ul className="mt-2 space-y-2">
            {candidates.responsibles.map((row) => (
              <li key={row.id}>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" className={box} checked={vendors.has(row.id)} onChange={() => toggle(vendors, setVendors, row.id)} />
                  <span><strong>{row.name}</strong> · {row.email} · {row.status}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {candidates.clients.length > 0 && (
        <section className="rounded-2xl border border-[#eadfd9] bg-white p-4">
          <h3 className="font-extrabold">Clientes ({candidates.clients.length})</h3>
          <ul className="mt-2 space-y-2">
            {candidates.clients.map((row) => (
              <li key={row.id}>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" className={box} checked={clients.has(row.id)} onChange={() => toggle(clients, setClients, row.id)} />
                  <span><strong>{row.name}</strong>{row.email ? ` · ${row.email}` : ""}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {candidates.orders.length > 0 && (
        <section className="rounded-2xl border border-[#eadfd9] bg-white p-4">
          <h3 className="font-extrabold">Pedidos ({candidates.orders.length})</h3>
          <p className="mt-1 text-xs text-[#7b6a77]">Pedidos de vendedor/cliente arquivado são arquivados junto, exceto os pagos de verdade.</p>
          <ul className="mt-2 space-y-2">
            {candidates.orders.map((row) => (
              <li key={row.id} className={row.paidForReal ? "rounded-xl border border-[#8f2727]/40 bg-[#fbe7e7] p-2" : ""}>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className={box}
                    checked={orders.has(row.id)}
                    onChange={() => toggle(orders, setOrders, row.id)}
                  />
                  <span>
                    <strong>#{row.number}</strong> · {day(row.createdAt)} · {money(row.totalCents)} · {row.status} · {row.reason}
                  </span>
                </label>
                {row.paidForReal && (
                  <label className="ml-8 mt-1 flex items-center gap-3 text-xs font-bold text-[#8f2727]">
                    <input type="checkbox" className={box} checked={paidOk.has(row.id)} onChange={() => toggle(paidOk, setPaidOk, row.id)} />
                    PAGO DE VERDADE: confirmo que este pedido pode ser arquivado
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!nothing && (
        <button
          type="button"
          disabled={busy || (!vendors.size && !clients.size && !orders.size) || !data.ready}
          onClick={archive}
          className="w-full rounded-full bg-[#342737] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-40 sm:w-auto"
        >
          Arquivar selecionados
        </button>
      )}

      {batches.length > 0 && (
        <section className="rounded-2xl border border-[#eadfd9] bg-white p-4">
          <h3 className="font-extrabold">Lotes arquivados</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {batches.map((batch) => (
              <li key={batch.batchId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {day(batch.at)} · {batch.responsibles} vendedor(es), {batch.clients} cliente(s), {batch.orders} pedido(s)
                  {batch.restored ? " · desfeito" : ""}
                </span>
                {!batch.restored && (
                  <button type="button" disabled={busy} onClick={() => restore(batch.batchId)} className="rounded-full border border-[#1f6b3a] px-3 py-1 text-xs font-extrabold text-[#1f6b3a]">
                    Desfazer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
