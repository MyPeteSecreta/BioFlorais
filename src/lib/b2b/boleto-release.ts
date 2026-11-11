/**
 * BOLETO A PRAZO (B2B, só CNPJ, 28/42/56 dias): a mercadoria é separada, faturada e enviada ANTES do pagamento. As parcelas são o
 * contas a receber e não seguram a expedição (mestre/Luis, 11/11, caso Gral Animal: o pedido ficava "aguardando pagamento").
 *  - "Liberado para separação" é separado de "pago": o pedido fica com status 'pending' (financeiro em "Boletos a receber") e
 *    fulfillment_status 'paid_to_prepare' (fila de separação, Central/Omie, etiqueta). Vira 'paid' só com todas as parcelas baixadas.
 *  - Libera sozinho ao registrar a solicitação do boleto; os pedidos que já estavam parados são liberados no admin do pedido,
 *    com registro de quem e quando (order_events, evento 'boleto_released'). Sem SQL.
 *  - Cancelado ('cancelled') sai da separação; desfazer baixa só volta o financeiro (a separação continua).
 *  - Nada aqui vale para B2C nem para Pix/cartão (continuam: separação só depois de pago).
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

export const BOLETO_RELEASED_EVENT = "boleto_released";

type OrderLike = { status: string | null; paymentMethod?: string | null; b2bOfferId?: string | null; fulfillmentStatus?: string | null };

/** Pedido B2B no boleto. */
export function isB2BBoleto(order: Pick<OrderLike, "paymentMethod" | "b2bOfferId">): boolean {
  return Boolean(order.b2bOfferId) && order.paymentMethod === "boleto";
}

/** Pode ser separado/enviado: pago (Pix, cartão, boleto quitado) OU boleto B2B já liberado para separação. */
export function canFulfillOrder(order: OrderLike): boolean {
  if (order.status === "paid" || order.status === "approved") return true;

  return isB2BBoleto(order) && order.status === "pending" && !["awaiting_payment", "cancelled", "", null, undefined].includes(order.fulfillmentStatus as string);
}

/** A mesma regra em SQL, para as listas (Central/Omie). `alias` = apelido da tabela orders. */
export const FULFILLABLE_ORDER_SQL = (alias: string) =>
  `(${alias}.status IN ('paid', 'approved') OR (${alias}.status = 'pending' AND ${alias}.b2b_offer_id IS NOT NULL AND to_jsonb(${alias}) ->> 'payment_method' = 'boleto' AND ${alias}.fulfillment_status NOT IN ('awaiting_payment', 'cancelled')))`;

/**
 * Libera o pedido B2B no boleto para a separação (só se ainda aguarda: idempotente). Registra quem e quando em order_events.
 * Devolve se liberou agora.
 */
export async function releaseBoletoForFulfillment(run: SqlRunner, orderId: string, actor: string, note: string): Promise<boolean> {
  const rows = await run(
    `UPDATE orders SET fulfillment_status = 'paid_to_prepare'
      WHERE id = $1 AND b2b_offer_id IS NOT NULL AND payment_method = 'boleto'
        AND status = 'pending' AND COALESCE(fulfillment_status, 'awaiting_payment') = 'awaiting_payment'
      RETURNING id`,
    [orderId]
  );

  if (rows.length === 0) return false;

  try {
    await run(`INSERT INTO order_events (order_id, event, note, created_by) VALUES ($1, $2, $3, $4)`, [orderId, BOLETO_RELEASED_EVENT, note.slice(0, 300), actor.slice(0, 80)]);
  } catch {
    // sem a tabela de eventos (SQL 23b): a liberação vale do mesmo jeito
  }

  return true;
}
