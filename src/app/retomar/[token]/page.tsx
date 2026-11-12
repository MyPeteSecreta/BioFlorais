/**
 * Link "Retomar com desconto" do e-mail de recuperação (src/lib/recovery-offer.ts). Mesmo link assinado do acompanhamento
 * (<id do pedido>.<assinatura>), sem dado pessoal na URL. Remonta a sacola com os itens do pedido e abre o checkout com o cupom
 * VOLTA pronto no campo. Pedido pago vai ao acompanhamento; cupom vencido/usado: remonta a sacola sem o cupom e avisa.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import RestoreCart from "@/components/payments/RestoreCart";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadTrackingView, verifyTrackingToken } from "@/lib/order-tracking";
import { loadOrderCartItems, loadRecoveryForOrder } from "@/lib/recovery-offer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Retomar pedido | Bio Florais", robots: { index: false, follow: false } };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-16 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">{title}</h1>
      <div className="mx-auto mt-3 max-w-md text-sm text-[#6c5b69]">{children}</div>
    </main>
  );
}

const home = (
  <Link href="/" className="mt-5 inline-block rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white">
    Voltar à loja
  </Link>
);

export default async function RetomarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyTrackingToken(decodeURIComponent(token));

  if (!orderId) return <Shell title="Link inválido"><p>Abra o link direto do e-mail da Bio Florais.</p>{home}</Shell>;

  const run = getAppSqlRunner();
  const view = await loadTrackingView(run, orderId);

  if (!view || view.isB2B) return <Shell title="Pedido não encontrado"><p>Não encontramos este pedido.</p>{home}</Shell>;
  if (view.status === "paid" || view.status === "approved") redirect(`/acompanhe/${token}`);

  const items = await loadOrderCartItems(run, orderId);

  if (items.length === 0) return <Shell title="Pedido sem itens"><p>Não conseguimos montar a sacola deste pedido.</p>{home}</Shell>;

  const offer = await loadRecoveryForOrder(run, orderId);

  if (offer && !offer.valid) {
    return (
      <Shell title="O cupom não vale mais">
        <p className="mb-4">O cupom {offer.code} venceu ou já foi usado, mas a sua sacola está pronta para concluir a compra.</p>
        <RestoreCart items={items} code={null} auto={false} />
      </Shell>
    );
  }

  return (
    <Shell title="Retomando seu pedido">
      <RestoreCart items={items} code={offer?.code ?? null} />
    </Shell>
  );
}
