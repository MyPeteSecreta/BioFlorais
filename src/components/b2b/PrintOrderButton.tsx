"use client";

/**
 * Botão "Imprimir / salvar PDF" (Rodada 19c). Abre o diálogo de impressão do navegador (que também salva em PDF).
 * Com `sheet`, renderiza a folha escondida na tela e só ela aparece na impressão (a revisão do checkout, antes do pedido
 * existir). Sem `sheet`, imprime a página atual (a página de impressão do pedido já é a própria folha).
 */

import type { ReactNode } from "react";

import OrderSheet from "@/components/b2b/OrderSheet";
import { PRINT_CSS } from "@/lib/b2b/print-css";
import type { OrderSheetData } from "@/lib/b2b/order-sheet";


export default function PrintOrderButton({
  sheet,
  label = "Imprimir / salvar PDF",
  className = "rounded-full border-2 border-[#55245f] px-5 py-2.5 text-sm font-extrabold text-[#55245f] transition hover:bg-[#f6eef7]",
  children,
}: {
  sheet?: OrderSheetData;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <button type="button" onClick={() => window.print()} className={`no-print ${className}`} data-testid="imprimir-pedido">
        {children ?? label}
      </button>
      {sheet && (
        <>
          <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
          <div className="order-print-root hidden" aria-hidden="true" data-testid="folha-oculta">
            <OrderSheet data={sheet} />
          </div>
        </>
      )}
    </>
  );
}
