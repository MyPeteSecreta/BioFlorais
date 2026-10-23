/**
 * Página de impressão do pedido/orçamento (Rodada 19b): a mesma para o link pessoal, o link geral e a sessão do vendedor.
 * Só apresentação: a autorização (order-access.ts) e o carregamento da folha ficam na página que a usa.
 */

import Link from "next/link";

import OrderSheet from "@/components/b2b/OrderSheet";
import PrintOrderButton, { PRINT_CSS } from "@/components/b2b/PrintOrderButton";
import type { OrderSheetData } from "@/lib/b2b/order-sheet";

export function OrderPrintUnavailable({ backHref, backLabel }: { backHref: string | null; backLabel: string }) {
  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]" data-testid="impressao-indisponivel">
      <p>Pedido não encontrado ou sem permissão para este acesso.</p>
      <p className="mt-2 text-sm text-[#746471]">Entre pelo seu link de compra ou, se for representante, faça login em /b2b/login.</p>
      {backHref && (
        <Link href={backHref} className="mt-4 inline-block text-sm font-bold text-[#63326d] underline underline-offset-4">
          {backLabel}
        </Link>
      )}
    </main>
  );
}

export default function OrderPrintView({ sheet, backHref, backLabel }: { sheet: OrderSheetData; backHref: string; backLabel: string }) {
  return (
    <main className="min-h-screen bg-[#fffaf6] px-4 py-6 text-[#422347]">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS.replaceAll(".order-print-root", ".order-print-page") }} />
      <div className="no-print mx-auto mb-4 flex max-w-[780px] flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
          {backLabel}
        </Link>
        <PrintOrderButton />
      </div>
      <div className="order-print-page">
        <OrderSheet data={sheet} />
      </div>
    </main>
  );
}
