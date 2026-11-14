/**
 * Filtros e mudança em lote da tela /admin/pedidos (item 40, 13/11). Funções puras (testáveis sem banco).
 *  - Pagamento: Todos / Só pagos / Só não pagos. "Pago" = status pago OU boleto a prazo B2B liberado para separação (já está numa etapa
 *    de separação), igual à regra da expedição (canFulfillOrder). Cancelado só aparece em "Todos".
 *  - Etapa (só dentro dos pagos): as etapas que já existem.
 *  - Lote: só as etapas que a tela individual muda pela MESMA rota (PATCH /api/admin/orders/<id>/fulfillment). "Enviado" pede código de
 *    rastreio e fica na tela de cada pedido; "Cancelado" não vai em lote.
 */

export type PaymentFilter = "todos" | "pagos" | "nao-pagos";

export const PAYMENT_FILTERS: ReadonlyArray<{ key: PaymentFilter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "pagos", label: "Só pagos" },
  { key: "nao-pagos", label: "Só não pagos" },
];

export const STAGE_FILTERS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "paid_to_prepare", label: "A preparar" },
  { key: "separating", label: "Em separação" },
  { key: "ready_to_ship", label: "Pronto para envio" },
  { key: "shipped", label: "Enviado" },
  { key: "completed", label: "Concluído" },
];

/** Etapas para "Mover para etapa X" em lote (as mesmas que a tela individual muda pela rota de etapa). */
export const BATCH_STAGES: ReadonlyArray<{ key: string; label: string }> = STAGE_FILTERS.filter((stage) =>
  ["paid_to_prepare", "separating", "ready_to_ship"].includes(stage.key)
);

const PAID_STATUSES = ["paid", "approved"];
const FULFILLMENT_STAGES = ["paid_to_prepare", "separating", "ready_to_ship", "shipped", "completed"];
const CANCELLED = ["cancelled", "canceled"];

export type FilterableOrder = { status: string; fulfillmentStatus: string | null };

export function isPaidOrReleased(order: FilterableOrder): boolean {
  if (CANCELLED.includes(order.status)) return false;

  return PAID_STATUSES.includes(order.status) || FULFILLMENT_STAGES.includes(String(order.fulfillmentStatus ?? ""));
}

export function parsePaymentFilter(raw: unknown): PaymentFilter {
  const value = String(Array.isArray(raw) ? raw[0] : raw ?? "");

  return value === "pagos" || value === "nao-pagos" ? value : "todos";
}

export function parseStageFilter(raw: unknown): string | null {
  const value = String(Array.isArray(raw) ? raw[0] : raw ?? "");

  return STAGE_FILTERS.some((stage) => stage.key === value) ? value : null;
}

export function filterOrders<T extends FilterableOrder>(rows: T[], payment: PaymentFilter, stage: string | null): T[] {
  if (payment === "todos") return rows;

  if (payment === "nao-pagos") {
    return rows.filter((order) => !isPaidOrReleased(order) && !CANCELLED.includes(order.status));
  }

  const paid = rows.filter(isPaidOrReleased);

  return stage ? paid.filter((order) => order.fulfillmentStatus === stage) : paid;
}

/** Link dos filtros (mantém o filtro de cliente). */
export function ordersFilterHref(input: { payment: PaymentFilter; stage?: string | null; cliente?: string }): string {
  const params = new URLSearchParams();

  if (input.cliente) params.set("cliente", input.cliente);
  if (input.payment !== "todos") params.set("pagamento", input.payment);
  if (input.payment === "pagos" && input.stage) params.set("etapa", input.stage);

  const query = params.toString();

  return query ? `/admin/pedidos?${query}` : "/admin/pedidos";
}

/** Texto do relatório do lote. */
export function batchReport(label: string, total: number, failures: Array<{ number: string; error: string }>): string {
  const ok = total - failures.length;
  const head = `${ok} de ${total} ${total === 1 ? "pedido movido" : "pedidos movidos"} para ${label}.`;

  return failures.length ? `${head} Não foram: ${failures.map((failure) => `#${failure.number} (${failure.error})`).join("; ")}.` : head;
}
