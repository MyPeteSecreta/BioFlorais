/**
 * Retomar o pagamento de um pedido B2C não pago (link do e-mail "Seu pedido está separado"). O link é o mesmo assinado do
 * acompanhamento (<id do pedido>.<assinatura>): sem dado pessoal na URL. Pedido pago vai ao acompanhamento; cancelado, B2B ou
 * inexistente mostram aviso.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import ResumePayment from "@/components/payments/ResumePayment";
import { formatB2BCents } from "@/lib/b2b/format";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { cardWasDeclined } from "@/lib/payment-reminder";
import { loadTrackingView, verifyTrackingToken } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concluir o pagamento | Bio Florais", robots: { index: false, follow: false } };

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-16 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-[#6c5b69]">{text}</p>
      <Link href="/" className="mt-5 inline-block rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white">
        Voltar à loja
      </Link>
    </main>
  );
}

export default async function ResumePaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const orderId = verifyTrackingToken(decoded);

  if (!orderId) return <Notice title="Link inválido" text="Este link de pagamento não é válido. Se você recebeu um e-mail da Bio Florais, abra o link direto do e-mail." />;

  const view = await loadTrackingView(getAppSqlRunner(), orderId);

  if (!view || view.isB2B) return <Notice title="Pedido não encontrado" text="Não encontramos este pedido." />;
  if (view.status === "paid") redirect(`/acompanhe/${token}`);
  if (view.timeline.cancelled) return <Notice title="Pedido cancelado" text="Este pedido foi cancelado e não aceita mais pagamento. Você pode fazer um novo pedido na loja." />;
  if (view.status !== "pending" && view.status !== "checkout_pending") return <Notice title="Pedido em andamento" text="Este pedido já está sendo processado. Acompanhe pelo link do acompanhamento." />;

  const cardIssue = cardWasDeclined({ lastMethod: view.paymentMethod === "card" ? "card" : view.paymentMethod, lastPaymentStatus: null, status: view.status });

  return (
    <main className="min-h-screen bg-[#fffaf6] px-4 py-8 text-[#422347]">
      <div className="mx-auto max-w-lg space-y-5">
        <header>
          <Link href="/" className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">
            Bio Florais
          </Link>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#55245f]">Seu pedido está separado</h1>
          <p className="mt-1 text-sm text-[#6c5b69]">Pedido #{view.number} · falta só o pagamento.</p>
        </header>

        <section className="rounded-[24px] border border-[#eadfd9] bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#9b6c24]">Itens</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {view.items
              .filter((item) => !item.bonified)
              .map((item, index) => (
                <li key={index}>
                  {item.qty}× {item.name}
                </li>
              ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-[#eadfd9] pt-3 text-base font-extrabold">
            <span>Total</span>
            <span>{formatB2BCents(view.totalCents)}</span>
          </p>
        </section>

        <ResumePayment orderId={view.orderId} trackPath={`/acompanhe/${token}`} initialPixCode={view.pixCode} cardIssue={cardIssue} totalLabel={formatB2BCents(view.totalCents)} />

        <p className="text-center text-xs text-[#6c5b69]">
          Pagamento seguro. Dúvidas? Fale com o{" "}
          <Link href="/atendimento" className="font-bold underline">
            atendimento
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
