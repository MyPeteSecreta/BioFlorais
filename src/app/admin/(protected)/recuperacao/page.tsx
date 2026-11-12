/** ADMIN — Recuperação de pedidos não pagos: liga/desliga, % do cupom e relatório (src/lib/recovery-offer.ts). */

import RecoverySettingsForm from "@/components/admin/RecoverySettingsForm";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { brlCents, loadRecoveryReport, loadRecoverySettings } from "@/lib/recovery-offer";

export const dynamic = "force-dynamic";

const pct = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(2).replace(".", ",")}%` : "—");

export default async function RecuperacaoPage() {
  const run = getAppSqlRunner();
  const [settings, report] = await Promise.all([loadRecoverySettings(run), loadRecoveryReport(run).catch(() => null)]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-8 text-[#342737]">
      <header>
        <h1 className="text-2xl font-extrabold">Recuperação de pedidos não pagos</h1>
        <p className="mt-1 text-sm text-[#6c5b69]">
          Lembrete 2 h depois do pedido (sem desconto). Se em 2 dias não pagar: um e-mail com cupom pessoal (VOLTA-…), de uso único, válido
          por 48 h, só para o e-mail da cliente. Não vai para pedido pago, cancelado, B2B, orçamento, nem para quem comprou depois.
        </p>
      </header>

      <section className="rounded-2xl border border-[#eadfd9] bg-white p-5">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#a0742b]">Oferta de desconto</h2>
        <RecoverySettingsForm enabled={settings.enabled} percent={settings.percent} />
      </section>

      <section className="rounded-2xl border border-[#eadfd9] bg-white p-5" data-testid="recuperacao-relatorio">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#a0742b]">Relatório</h2>
        {report ? (
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1">Ofertas enviadas (30 dias / total)</td><td className="text-right font-bold">{report.sent30} / {report.sent}</td></tr>
              <tr><td className="py-1">Cupons usados (30 dias / total)</td><td className="text-right font-bold">{report.used30} / {report.used}</td></tr>
              <tr><td className="py-1">Taxa de uso (total)</td><td className="text-right font-bold">{pct(report.used, report.sent)}</td></tr>
              <tr><td className="py-1">Pedidos pagos com o cupom</td><td className="text-right font-bold">{report.paidOrders}</td></tr>
              <tr><td className="py-1">Valor vendido com o cupom</td><td className="text-right font-bold">{brlCents(report.paidCents)}</td></tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[#6c5b69]">Relatório indisponível no momento.</p>
        )}
      </section>
    </main>
  );
}
