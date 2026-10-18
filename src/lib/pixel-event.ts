/**
 * Dados do evento "Compra" do pixel (ChatGPT Ads) para UM pedido — sem dado pessoal: id do pedido, total pago em
 * centavos e produtos (id/nome/quantidade). Só devolve se o pedido está PAGO (Pix confirmado ou cartão aprovado).
 * Boleto fica para a fase 2 (servidor). Pedido arquivado (dado de teste) nunca mede.
 */

import { andNotArchived } from "@/lib/b2b/archive";
import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { purchaseEventId, type PurchaseEvent } from "@/lib/pixel";

export async function loadPurchaseEvent(run: SqlRunner, orderId: string): Promise<PurchaseEvent | null> {
  if (!isUuid(orderId)) return null;

  const notArchived = await andNotArchived(run, "orders", "o");
  const [order] = await run(
    `SELECT o.id, o.status, o.payment_method, o.total_cents, o.b2b_offer_id FROM orders o WHERE o.id = $1${notArchived}`,
    [orderId]
  );

  if (!order) return null;
  if (order.status !== "paid" && order.status !== "approved") return null;
  if (order.payment_method === "boleto") return null;

  const amountCents = Math.round(Number(order.total_cents ?? 0));
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;

  const rows = await run(
    `SELECT i.qty, i.unit_price_cents, to_jsonb(i) ->> 'product_name_snapshot' AS snapshot,
            p.slug, p.name, p.category, p.line_slug
       FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      WHERE i.order_id = $1 ORDER BY i.unit_price_cents DESC, p.name`,
    [orderId]
  );

  return {
    eventId: purchaseEventId(orderId, Boolean(order.b2b_offer_id)),
    amountCents,
    // Só itens vendidos (brinde/bonificação de R$ 0,00 fica de fora).
    contents: rows
      .filter((row) => Number(row.unit_price_cents ?? 0) > 0 && Number(row.qty ?? 0) > 0)
      .map((row) => ({
        id: String(row.slug ?? "produto"),
        name: String(
          row.snapshot ??
            (row.slug
              ? b2bProductLabel({
                  slug: String(row.slug),
                  name: String(row.name ?? "Produto"),
                  category: (row.category as string | null) ?? null,
                  lineSlug: (row.line_slug as string | null) ?? null,
                }).full
              : "Produto")
        ),
        quantity: Math.round(Number(row.qty)),
      })),
  };
}
