/**
 * Link "Voltar para a minha sacola" do e-mail de carrinho abandonado (src/lib/cart-recovery.ts). Link assinado (<id>.<assinatura>),
 * sem dado pessoal na URL. Remonta a sacola e abre o checkout; com a oferta válida, o cupom VOLTA já vai no campo.
 */

import Link from "next/link";

import RestoreCart from "@/components/payments/RestoreCart";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadCartForRestore } from "@/lib/cart-recovery";
import { verifyTrackingToken } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sua sacola | Bio Florais", robots: { index: false, follow: false } };

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

export default async function SacolaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = verifyTrackingToken(decodeURIComponent(token));

  if (!id) return <Shell title="Link inválido"><p>Abra o link direto do e-mail da Bio Florais.</p>{home}</Shell>;

  const cart = await loadCartForRestore(getAppSqlRunner(), id);

  if (!cart || cart.items.length === 0) {
    return <Shell title="Sacola não encontrada"><p>Esta sacola não está mais guardada (ela fica guardada por 30 dias).</p>{home}</Shell>;
  }

  if (cart.offer && !cart.offer.valid) {
    return (
      <Shell title="O cupom não vale mais">
        <p className="mb-4">O cupom {cart.offer.code} venceu ou já foi usado, mas a sua sacola está pronta para concluir a compra.</p>
        <RestoreCart items={cart.items} code={null} auto={false} />
      </Shell>
    );
  }

  return (
    <Shell title="Montando a sua sacola">
      <RestoreCart items={cart.items} code={cart.offer?.code ?? null} />
    </Shell>
  );
}
