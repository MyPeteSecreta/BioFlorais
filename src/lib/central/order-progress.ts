/**
 * Andamento do pedido pedido pela Central (V3). Grava o MESMO que o admin da Bio grava:
 * orders.fulfillment_status (+ transportadora/rastreio no "enviado") e o histórico em
 * order_events (sql/b2b/23b), que o cliente vê no "Acompanhe seu pedido". Autor: "Central · <nome>".
 * "Separado / Embalado" vira ready_to_ship (a Bio mostra "Em separação" até enviar).
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import type { ProgressAction } from "@/lib/central/contract";

export type ProgressResult =
  | { ok: true; fulfillmentStatus: string }
  | { ok: false; error: string; status: number };

const PAID = ["paid", "approved"];

export async function applyOrderProgress(
  run: SqlRunner,
  input: {
    orderId: string;
    action: ProgressAction;
    actor: string;
    carrier?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
  }
): Promise<ProgressResult> {
  if (!isUuid(input.orderId)) return { ok: false, error: "Pedido inválido.", status: 400 };

  const carrier = String(input.carrier ?? "").trim().slice(0, 80);
  const trackingCode = String(input.trackingCode ?? "").trim().slice(0, 80);
  const trackingUrl = String(input.trackingUrl ?? "").trim().slice(0, 300);

  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
    return { ok: false, error: "O link de rastreio deve começar com http:// ou https://.", status: 400 };
  }

  if (input.action === "shipped" && (!carrier || !trackingCode)) {
    return { ok: false, error: "Informe a transportadora e o código de rastreio.", status: 400 };
  }

  const [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [input.orderId]);

  if (!order) return { ok: false, error: "Pedido não encontrado.", status: 404 };

  const current = String(order.fulfillment_status ?? "");

  if (!PAID.includes(String(order.status))) return { ok: false, error: "O pedido ainda não está pago.", status: 409 };
  if (current === "cancelled") return { ok: false, error: "Este pedido está cancelado.", status: 409 };

  let next: string;
  let event: "separating" | "shipped" | "delivered";
  let note: string | null = null;

  if (input.action === "separating" || input.action === "separated") {
    if (current === "shipped" || current === "delivered") {
      return { ok: false, error: "Pedido enviado ou concluído não pode voltar de etapa.", status: 409 };
    }

    next = input.action === "separated" ? "ready_to_ship" : "separating";
    event = "separating";
    note = input.action === "separated" ? "Separado e embalado" : null;
  } else if (input.action === "shipped") {
    if (current === "delivered") return { ok: false, error: "Pedido já entregue.", status: 409 };

    next = "shipped";
    event = "shipped";
  } else {
    if (!["shipped", "delivered"].includes(current)) {
      return { ok: false, error: "Marque como enviado antes de marcar como entregue.", status: 409 };
    }

    next = "delivered";
    event = "delivered";
  }

  if (input.action === "shipped") {
    await run(`UPDATE orders SET fulfillment_status = $2, shipping_service_name = $3, tracking_code = $4 WHERE id = $1`, [
      input.orderId,
      next,
      carrier,
      trackingCode,
    ]);
  } else {
    await run(`UPDATE orders SET fulfillment_status = $2 WHERE id = $1`, [input.orderId, next]);
  }

  try {
    await run(
      `INSERT INTO order_events (order_id, event, carrier, tracking_code, tracking_url, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.orderId,
        event,
        event === "shipped" ? carrier : null,
        event === "shipped" ? trackingCode : null,
        event === "shipped" ? trackingUrl || null : null,
        note,
        input.actor,
      ]
    );
  } catch (error) {
    // SQL 23b ainda não aplicado: o status mudou, mas sem histórico (igual ao admin).
    console.error("[central/order-progress] sem order_events", error);
  }

  return { ok: true, fulfillmentStatus: next };
}
