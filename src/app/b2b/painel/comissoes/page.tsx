/**
 * BIO FLORAIS B2B — "Minhas comissões" (C9). Só os pedidos do vendedor da
 * sessão (filtro no SQL por b2b_responsible_id). Mostra por pedido a base, o
 * percentual (base + extra = total), o valor e a situação; totais a receber.
 * Boleto: nunca pela data de vencimento, só depois da baixa da parcela.
 */

import Link from "next/link";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { formatB2BCents } from "@/lib/b2b/format";
import { getAppSqlRunner, listOwnedClients } from "@/lib/b2b/ownership";
import { STATE_LABEL, loadCommissionRows, totalsFor, type CommissionState } from "@/lib/b2b/commissions";

export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { pix: "Pix", card: "Cartão", boleto: "Boleto" };
const STATE_CLASS: Record<CommissionState, string> = {
  aguardando: "bg-[#fff4db] text-[#8a5a12]",
  a_receber: "bg-[#e8f0ff] text-[#274b8f]",
  paga: "bg-[#e3f5e9] text-[#1f6b3a]",
  cancelada: "bg-[#f3eef2] text-[#7b6a77]",
};

const date = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(value) : "—";
const pct = (value: number | null) => (value === null ? "—" : `${String(value).replace(".", ",")}%`);

export default async function MyCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cliente?: string }>;
}) {
  const { mes, cliente } = await searchParams;
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();

  const [rows, clients] = await Promise.all([
    loadCommissionRows(run, { responsibleId: responsible.id, clientId: cliente, month: mes }),
    listOwnedClients(run, responsible.id),
  ]);

  const totals = totalsFor(rows);

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      <Link href="/b2b/painel" className="text-sm font-bold text-[#63326d] underline underline-offset-4">
        ← Meus clientes
      </Link>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-[#55245f]">Minhas comissões</h1>
      <p className="mt-2 max-w-3xl text-sm text-[#746471]">
        Base = valor pago dos produtos (sem frete, depois de promoção, cupom e desconto Pix/cartão). A comissão
        fica &quot;A receber&quot; no dia 10 do mês seguinte ao recebimento. No boleto, cada parcela rende comissão
        proporcional, pela data da BAIXA da parcela (nunca pelo vencimento).
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[20px] border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-blue-900">
            A receber em {totals.nextTenthDate ? date(totals.nextTenthDate) : "—"}
          </p>
          <p className="mt-1 text-2xl font-black text-blue-900">{formatB2BCents(totals.nextTenthCents)}</p>
        </div>
        <div className="rounded-[20px] border border-[#eadfd9] bg-white p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#9b6c24]">Nos meses seguintes</p>
          <p className="mt-1 text-2xl font-black">{formatB2BCents(totals.laterCents)}</p>
        </div>
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-emerald-900">Já recebido</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{formatB2BCents(totals.receivedCents)}</p>
        </div>
        <div className="rounded-[20px] border border-[#eadfd9] bg-white p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#9b6c24]">Aguardando pagamento</p>
          <p className="mt-1 text-2xl font-black">{formatB2BCents(totals.waitingCents)}</p>
        </div>
      </section>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-[20px] border border-[#eadfd9] bg-white p-4 text-sm">
        <label className="text-xs font-bold text-[#7b6a77]">
          Mês do pedido
          <input type="month" name="mes" defaultValue={mes ?? ""} className="mt-1 block rounded-xl border border-[#eadfd9] px-3 py-2" />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Cliente
          <select name="cliente" defaultValue={cliente ?? ""} className="mt-1 block rounded-xl border border-[#eadfd9] px-3 py-2">
            <option value="">Todos</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-[#55245f] px-5 py-2.5 text-xs font-extrabold text-white">
          Filtrar
        </button>
        <Link href="/b2b/painel/comissoes" className="px-2 py-2.5 text-xs font-bold text-[#63326d] underline">
          Limpar
        </Link>
      </form>

      <div className="mt-6 overflow-x-auto rounded-[20px] border border-[#eadfd9] bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#fbf5f1] text-xs uppercase tracking-[0.08em] text-[#7b6a77]">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3">Base + extra = total</th>
              <th className="px-4 py-3 text-right">Comissão</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e8e4]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#8a7886]">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.orderId}>
                <td className="px-4 py-3">{date(row.createdAt)}</td>
                <td className="px-4 py-3 font-semibold">{row.clientName || "—"}</td>
                <td className="px-4 py-3">
                  #{row.orderNumber}
                  {row.installmentLabel && <span className="block text-xs text-[#8a7886]">parcela {row.installmentLabel}</span>}
                </td>
                <td className="px-4 py-3">{METHOD[row.paymentMethod ?? ""] ?? row.paymentMethod ?? "—"}</td>
                <td className="px-4 py-3 text-right">{formatB2BCents(row.baseCents)}</td>
                <td className="px-4 py-3 text-xs">
                  {row.totalPercent === null ? (
                    "sem snapshot"
                  ) : (
                    <>
                      {pct(row.basePercent)} + {pct(row.extraPercent)} = <strong>{pct(row.totalPercent)}</strong>
                      {row.basis && <span className="block text-[#8a7886]">{row.basis}</span>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-extrabold">
                  {row.commissionCents === null ? "—" : formatB2BCents(row.commissionCents)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${STATE_CLASS[row.state]}`}>
                    {row.state === "a_receber" && row.payableOn
                      ? `A receber em ${date(row.payableOn)}`
                      : row.state === "paga"
                        ? `Paga em ${date(row.paidOutAt)}`
                        : STATE_LABEL[row.state]}
                  </span>
                  {row.state === "aguardando" && row.paymentMethod === "boleto" && (
                    <span className="mt-1 block text-[11px] text-[#8a7886]">Aguardando a baixa da parcela</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
