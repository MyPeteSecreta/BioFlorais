/** "Não quero mais receber" do e-mail da sacola: confirma com um botão (o clique de leitores de e-mail não apaga sozinho). */

import UnsubscribeCartButton from "@/components/cart/UnsubscribeCartButton";
import { verifyTrackingToken } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sair da lista | Bio Florais", robots: { index: false, follow: false } };

export default async function SairPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = Boolean(verifyTrackingToken(decodeURIComponent(token)));

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-16 text-center text-[#422347]">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Lembretes da sacola</h1>
      <div className="mx-auto mt-3 max-w-md text-sm text-[#6c5b69]">
        {valid ? (
          <>
            <p className="mb-5">Ao confirmar, apagamos a sacola guardada e você não recebe mais e-mails sobre ela.</p>
            <UnsubscribeCartButton token={decodeURIComponent(token)} />
          </>
        ) : (
          <p>Link inválido. Abra o link direto do e-mail da Bio Florais.</p>
        )}
      </div>
    </main>
  );
}
