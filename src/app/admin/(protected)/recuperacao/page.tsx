/** ADMIN — Recuperação de pedidos não pagos: liga/desliga, % do cupom e relatório (src/lib/recovery-offer.ts). */

import RecoverySettingsForm from "@/components/admin/RecoverySettingsForm";
import ReviewSettingsForm from "@/components/admin/ReviewSettingsForm";
import CartRecoveryForm from "@/components/admin/CartRecoveryForm";
import { loadCartRecoveryEnabled, loadCartRecoveryReport } from "@/lib/cart-recovery";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { brlCents, loadRecoveryReport, loadRecoverySettings } from "@/lib/recovery-offer";
import { loadReviewSettings } from "@/lib/review-request";

export const dynamic = "force-dynamic";

const pct = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(2).replace(".", ",")}%` : "—");

export default async function RecuperacaoPage() {
  const run = getAppSqlRunner();
  const [settings, report, review, cartEnabled, cartReport] = await Promise.all([
    loadRecoverySettings(run),
    loadRecoveryReport(run).catch(() => null),
    loadReviewSettings(run),
    loadCartRecoveryEnabled(run),
    loadCartRecoveryReport(run).catch(() => null),
  ]);

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
      <section className="rounded-2xl border border-[#eadfd9] bg-white p-5" data-testid="carrinho-abandonado-admin">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#a0742b]">Carrinho abandonado</h2>
        <p className="mb-3 text-sm text-[#6c5b69]">
          Só para quem marca, no checkout, que quer um lembrete da sacola (caixa desmarcada por padrão). 2 h depois: lembrete sem desconto.
          Em 2 dias: o cupom pessoal, se a oferta de desconto acima estiver ligada (mesmo %). No máximo 1 oferta a cada 30 dias por e-mail.
          A sacola é apagada em 30 dias ou quando a pessoa pede para sair. Precisa do SQL 56b.
        </p>
        <CartRecoveryForm enabled={cartEnabled} />
        {cartReport ? (
          <table className="mt-4 w-full text-sm">
            <tbody>
              <tr><td className="py-1">Sacolas guardadas agora</td><td className="text-right font-bold">{cartReport.active}</td></tr>
              <tr><td className="py-1">Lembretes enviados (30 dias)</td><td className="text-right font-bold">{cartReport.reminders30}</td></tr>
              <tr><td className="py-1">Ofertas enviadas (30 dias)</td><td className="text-right font-bold">{cartReport.offers30}</td></tr>
              <tr><td className="py-1">Viraram pedido (30 dias)</td><td className="text-right font-bold">{cartReport.converted30}</td></tr>
              <tr><td className="py-1">Cupons da sacola usados</td><td className="text-right font-bold">{cartReport.couponsUsed}</td></tr>
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-[#6c5b69]">Aplique o SQL 56b para ligar o carrinho abandonado.</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#eadfd9] bg-white p-5">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#a0742b]">Pedido de avaliação</h2>
        <ReviewSettingsForm enabled={review.enabled} url={review.url} />
      </section>
    </main>
  );
}
