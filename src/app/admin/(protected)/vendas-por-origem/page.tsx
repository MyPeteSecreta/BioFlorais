import Link from "next/link";

import { andNotArchived } from "@/lib/b2b/archive";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadSalesByOrigin, resolvePeriod, type OriginRow } from "@/lib/sales-by-origin";

export const dynamic = "force-dynamic";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function Cells({ row }: { row: OriginRow }) {
  return (
    <>
      <td className="px-3 py-2 text-right">{row.pedidos}</td>
      <td className="px-3 py-2 text-right">{row.pagos}</td>
      <td className="px-3 py-2 text-right">{money(row.valorPagoCents)}</td>
      <td className="px-3 py-2 text-right">{row.naoPagos}</td>
      <td className="px-3 py-2 text-right">{money(row.valorNaoPagoCents)}</td>
    </>
  );
}

const HEAD = ["Pedidos", "Pagos", "Valor pago", "Não pagos", "Valor não pago"];

export default async function SalesByOriginPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const period = resolvePeriod(params.from, params.to);
  let report: Awaited<ReturnType<typeof loadSalesByOrigin>> | null = null;
  let failed = false;

  try {
    const run = getAppSqlRunner();
    report = await loadSalesByOrigin(run, { from: period.from, to: period.to, notArchivedSql: await andNotArchived(run, "orders", "o") });
  } catch {
    failed = true;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-10" data-testid="vendas-por-origem">
      <Link href="/admin/pedidos" className="text-sm font-bold text-[#6b476f] underline">
        Voltar aos pedidos
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold text-[#342737]">Vendas por origem</h1>
      <p className="mt-1 text-sm text-[#756674]">
        Pedidos do site (sem lojista) por canal, campanha e anúncio. Só números: nenhum dado de cliente. &quot;Não pagos&quot; inclui aguardando pagamento e cancelados.
      </p>

      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold text-[#342737]">
          De
          <input type="date" name="from" defaultValue={period.from} className="ml-2 rounded-lg border border-[#eadfd9] px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-[#342737]">
          Até
          <input type="date" name="to" defaultValue={period.to} className="ml-2 rounded-lg border border-[#eadfd9] px-3 py-2" />
        </label>
        <button type="submit" className="rounded-full bg-[#422347] px-5 py-2.5 text-sm font-extrabold text-white">
          Ver período
        </button>
        <a href={`/api/admin/orders/export?from=${period.from}&to=${period.to}`} className="rounded-full border-2 border-[#422347] px-5 py-2.5 text-sm font-extrabold text-[#422347]">
          Exportar CSV
        </a>
      </form>

      {failed || !report ? (
        <p className="mt-6 rounded-xl bg-[#fff4e5] p-4 text-sm font-bold text-[#7a4a00]">Não foi possível ler os pedidos agora. Tente de novo em instantes.</p>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-extrabold text-[#342737]">Por canal</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-[#eadfd9] bg-white">
            <table className="w-full min-w-[640px] text-sm" data-testid="origem-canais">
              <thead className="bg-[#f6eef7] text-left text-xs uppercase text-[#6b476f]">
                <tr>
                  <th className="px-3 py-2">Canal</th>
                  {HEAD.map((label) => (
                    <th key={label} className="px-3 py-2 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.channels.map((row) => (
                  <tr key={row.canal} className="border-t border-[#f1e8e3]">
                    <td className="px-3 py-2 font-bold">{row.canal}</td>
                    <Cells row={row} />
                  </tr>
                ))}
                <tr className="border-t-2 border-[#d8c9d9] bg-[#faf6fb] font-extrabold">
                  <td className="px-3 py-2">Total</td>
                  <Cells row={report.totals} />
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-lg font-extrabold text-[#342737]">Por campanha e anúncio</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-[#eadfd9] bg-white">
            <table className="w-full min-w-[900px] text-sm" data-testid="origem-detalhe">
              <thead className="bg-[#f6eef7] text-left text-xs uppercase text-[#6b476f]">
                <tr>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Meio</th>
                  <th className="px-3 py-2">Campanha</th>
                  <th className="px-3 py-2">Anúncio</th>
                  {HEAD.map((label) => (
                    <th key={label} className="px-3 py-2 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-4 text-center text-[#756674]">
                      Nenhum pedido neste período.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={`${row.canal}|${row.meio}|${row.campanha}|${row.anuncio}`} className="border-t border-[#f1e8e3]">
                      <td className="px-3 py-2 font-bold">{row.canal}</td>
                      <td className="px-3 py-2">{row.meio}</td>
                      <td className="px-3 py-2">{row.campanha}</td>
                      <td className="px-3 py-2">{row.anuncio}</td>
                      <Cells row={row} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[#756674]">
            Pedidos sem informação de origem aparecem como &quot;direto&quot;. A coluna Anúncio só é preenchida quando o link do anúncio leva utm_content.
          </p>
        </>
      )}
    </main>
  );
}
