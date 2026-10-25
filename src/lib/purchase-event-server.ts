/**
 * Dados do evento de compra (Google purchase / Meta Purchase) de um pedido PAGO. Sem dado pessoal: só id do pedido, valor e
 * itens (slug, quantidade, preço). Mesmas regras da Image Tag: pedido pago/aprovado, não boleto, não arquivado, valor > 0.
 * O id do pedido é o event_id/transaction_id (o Google e a Meta deduplicam por ele).
 */

import { isUuid } from "@/lib/b2b/admin-input";
import { andNotArchived } from "@/lib/b2b/archive";
import type { SqlRunner } from "@/lib/b2b/ownership";
import type { PurchasePayload } from "@/lib/measurement";

export async function loadPurchasePayload(run: SqlRunner, orderId: string): Promise<PurchasePayload | null> {
  if (!isUuid(orderId)) return null;

  try {
    const notArchived = await andNotArchived(run, "orders", "o");
    const [order] = await run(
      `SELECT o.id::text AS id, o.total_cents
         FROM orders o
        WHERE o.id = $1::uuid
          AND o.status IN ('paid', 'approved')
          AND o.payment_method IS DISTINCT FROM 'boleto'
          AND o.total_cents > 0${notArchived}`,
      [orderId]
    );

    if (!order) return null;

    const rows = await run(
      `SELECT p.slug, i.qty, i.unit_price_cents
         FROM order_items i JOIN products p ON p.id = i.product_id
        WHERE i.order_id = $1::uuid AND i.unit_price_cents > 0
        ORDER BY p.slug`,
      [orderId]
    );

    return {
      orderId: String(order.id),
      valueCents: Number(order.total_cents),
      items: rows.map((row) => ({ id: String(row.slug), quantity: Number(row.qty), priceCents: Number(row.unit_price_cents) })),
    };
  } catch {
    return null;
  }
}
