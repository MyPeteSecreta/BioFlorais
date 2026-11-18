import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  orders,
  partnerEventOutbox,
} from "@/lib/db/schema";
import {
  dispatchPartnerOutbox,
} from "@/lib/partners/outbox";

const BRAND = "bio-florais";

/**
 * Item 20 (18/11): o "order_created" de um checkout de CARTÃO fica na fila estacionado (próxima tentativa nesta data; o
 * despachante só pega o que já venceu). No pagamento aprovado ele é liberado ANTES do "paid", e a Academia recebe os dois
 * na ordem. Cartão recusado: o evento fica parado para sempre e nunca é mandado.
 */
export const PARTNER_EVENT_PARKED_UNTIL = new Date("2999-01-01T00:00:00.000Z");

/**
 * Pedido com cupom de criadora cancelado no admin: avisa a Academia (evento "cancelled", uma vez por pedido) para ela
 * estornar a comissão. Pedido sem cupom de criadora: nada. Nunca lança: falha de envio fica na fila e o cron tenta de novo.
 */
export async function enqueuePartnerCancelled(orderId: string, occurredAt = new Date().toISOString()) {
  try {
    const [order] = await db
      .select({ partnerCouponId: orders.partnerCouponId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order?.partnerCouponId) return { partner: false as const };

    const eventId = `${BRAND}:${orderId}:cancelled`;

    await db
      .insert(partnerEventOutbox)
      .values({
        eventId,
        eventType: "cancelled",
        brand: BRAND,
        externalOrderId: orderId,
        partnerCouponId: order.partnerCouponId,
        payload: { schemaVersion: 1, eventId, eventType: "cancelled", brand: BRAND, externalOrderId: orderId, occurredAt },
        status: "pending",
      })
      .onConflictDoNothing({ target: partnerEventOutbox.eventId });

    await dispatchPartnerOutbox(10);

    return { partner: true as const, eventId };
  } catch (error) {
    console.error("[partners] cancelamento não registrado", error instanceof Error ? error.message : error);

    return { partner: false as const };
  }
}

export async function confirmPartnerPaid(
  orderId: string,
  payment: {
    provider: string;
    providerPaymentId: string;
    paidAt: string;
  }
) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const order = rows[0];

  if (!order?.partnerCouponId) {
    return {
      partner: false,
      reason: "no_partner_coupon",
    };
  }

  // Cartão: libera o "order_created" estacionado (criado com o pedido) para sair antes do "paid".
  await db
    .update(partnerEventOutbox)
    .set({ nextAttemptAt: null })
    .where(
      and(
        eq(partnerEventOutbox.eventId, `${BRAND}:${orderId}:order_created`),
        eq(partnerEventOutbox.status, "pending")
      )
    );

  const eventId =
    `${BRAND}:${orderId}:paid`;

  const payload = {
    schemaVersion: 1,
    eventId,
    eventType: "paid" as const,
    brand: BRAND,
    externalOrderId: orderId,
    occurredAt:
      payment.paidAt,

    payment: {
      provider:
        payment.provider,
      providerPaymentId:
        payment.providerPaymentId,
      paidAmountCents:
        order.totalCents,
      currency: "BRL" as const,
      paidAt:
        payment.paidAt,
    },
  };

  await db
    .insert(partnerEventOutbox)
    .values({
      eventId,
      eventType: "paid",
      brand: BRAND,
      externalOrderId: orderId,
      partnerCouponId:
        order.partnerCouponId,
      payload,
      status: "pending",
    })
    .onConflictDoNothing({
      target:
        partnerEventOutbox.eventId,
    });

  await dispatchPartnerOutbox(10);

  return {
    partner: true,
    eventId,
  };
}
