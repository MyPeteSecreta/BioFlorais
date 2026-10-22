/**
 * Folha do pedido/orçamento para IMPRIMIR ou salvar em PDF (Rodada 19c). Só mostra pedidos DESTE cliente (vem do token do
 * link de oferta). Serve ao "Meus pedidos" (lojista), à tela de confirmação e ao "Lançar pedido" (vendedor).
 */

import Link from "next/link";

import OrderSheet from "@/components/b2b/OrderSheet";
import PrintOrderButton, { PRINT_CSS } from "@/components/b2b/PrintOrderButton";
import { loadOrderSheet } from "@/lib/b2b/order-sheet";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PrintOrderPage({ params }: { params: Promise<{ token: string; orderId: string }> }) {
  const { token, orderId } = await params;
  const resolution = await loadPublicB2BOfferContext(token);
  const back = `/b2b/oferta/${encodeURIComponent(token)}/pedidos`;

  if (!resolution.ok || resolution.context.isStorefront) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Este link não está disponível.</p>
      </main>
    );
  }

  const sheet = await loadOrderSheet(getAppSqlRunner(), orderId, resolution.context.clientId);

  if (!sheet) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Pedido não encontrado.</p>
        <Link href={back} className="mt-4 inline-block text-sm font-bold text-[#63326d] underline underline-offset-4">
          Voltar aos pedidos
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] px-4 py-6 text-[#422347]">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS.replaceAll(".order-print-root", ".order-print-page") }} />
      <div className="no-print mx-auto mb-4 flex max-w-[780px] flex-wrap items-center justify-between gap-3">
        <Link href={back} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
          ← Meus pedidos
        </Link>
        <PrintOrderButton />
      </div>
      <div className="order-print-page">
        <OrderSheet data={sheet} />
      </div>
    </main>
  );
}
