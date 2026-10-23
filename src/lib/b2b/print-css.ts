/**
 * CSS de impressão do pedido (A4; só a folha sai no papel). Fica FORA dos componentes "use client": uma constante exportada
 * por um módulo cliente chega ao servidor como referência (não como texto) e quebra a página de impressão.
 */

export const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  body * { visibility: hidden !important; }
  .order-print-root, .order-print-root * { visibility: visible !important; }
  .order-print-root { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
  .no-print { display: none !important; }
}
`;

/** Variante para a página dedicada (a folha é a própria página). */
export const PRINT_PAGE_CSS = PRINT_CSS.split(".order-print-root").join(".order-print-page");
