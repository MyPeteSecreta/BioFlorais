/**
 * Observações do pedido no servidor (Rodada 19a): grava orders.customer_note (SQL 46b) e lê para o admin. Sem a coluna,
 * tudo fica inerte (o pedido é criado normalmente), como no oppref.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { cleanNote } from "@/lib/order-note";

export async function attachOrderNote(run: SqlRunner, orderId: string, note: string | null | undefined): Promise<boolean> {
  const value = cleanNote(note);
  if (!value || !isUuid(orderId)) return false;

  try {
    const rows = await run(`UPDATE orders SET customer_note = $2 WHERE id = $1::uuid RETURNING id`, [orderId, value]);

    return rows.length > 0;
  } catch (error) {
    console.error("[order-note] sem orders.customer_note (SQL 46b)", error);

    return false;
  }
}

export async function loadOrderNote(run: SqlRunner, orderId: string): Promise<string | null> {
  if (!isUuid(orderId)) return null;

  try {
    const rows = await run(`SELECT customer_note FROM orders WHERE id = $1::uuid`, [orderId]);
    const note = rows[0]?.customer_note;

    return note ? String(note) : null;
  } catch {
    return null;
  }
}
