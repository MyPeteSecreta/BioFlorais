import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  orders,
  partnerEventOutbox,
} from "@/lib/db/schema";
import {
  dispatchPartnerOutbox,
} from "@/lib/partners/outbox";

const BRAND = "bio-florais";

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
