/**
 * Admin → Pedidos: "Marcar como teste e arquivar" (qualquer pedido, não só os com "teste" no nome).
 * Fluxo do navegador: confirma; se algum pedido for PAGO DE VERDADE, pede uma confirmação extra e só
 * então manda de novo com a lista confirmada. Nada é apagado: o lote aparece em
 * Admin → B2B → Dados de teste, com "Desfazer".
 */
export type ArchiveOutcome = { archived: number; cancelled: boolean; message: string };

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/orders/archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; orders?: number; skippedPaid?: string[] };

  return { ok: response.ok, status: response.status, data };
}

export async function archiveOrdersAsTest(orderIds: string[]): Promise<ArchiveOutcome> {
  const count = orderIds.length;

  if (count === 0) return { archived: 0, cancelled: true, message: "Selecione pelo menos um pedido." };

  const sure = window.confirm(
    `Marcar como teste e arquivar ${count === 1 ? "este pedido" : `${count} pedidos`}?\n\n` +
      "Ele(s) some(m) de Pedidos, Comissões, Boletos e Acompanhamento. Nada é apagado e dá para desfazer em Admin → B2B → Dados de teste."
  );

  if (!sure) return { archived: 0, cancelled: true, message: "" };

  const first = await post({ orderIds });

  if (!first.ok) return { archived: 0, cancelled: false, message: first.data.error ?? "Não foi possível arquivar." };

  let archived = first.data.orders ?? 0;
  const paid = first.data.skippedPaid ?? [];

  if (paid.length > 0) {
    const really = window.confirm(
      `ATENÇÃO: ${paid.length === 1 ? "1 pedido está PAGO" : `${paid.length} pedidos estão PAGOS`} de verdade (sem cupom de teste).\n\n` +
        "Arquivar um pedido pago real tira a venda, a comissão e a separação das telas. Arquivar mesmo assim?"
    );

    if (really) {
      const second = await post({ orderIds: paid, confirmedPaidOrderIds: paid });

      if (!second.ok) return { archived, cancelled: false, message: second.data.error ?? "Não foi possível arquivar os pedidos pagos." };

      archived += second.data.orders ?? 0;
    }
  }

  return {
    archived,
    cancelled: false,
    message:
      archived > 0
        ? `${archived} pedido(s) arquivado(s) como teste. Para desfazer: Admin → B2B → Dados de teste → Lotes arquivados.`
        : "Nenhum pedido foi arquivado.",
  };
}
