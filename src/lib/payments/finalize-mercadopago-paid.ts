import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  couponRedemptions,
  coupons,
  customers,
  orders,
} from "@/lib/db/schema";
import { confirmPartnerPaid } from "@/lib/partners/confirm-paid";

type FinalizeMercadoPagoPaidInput = {
  orderId: string;
  providerPaymentId: string;
  paidAt?: string;
};

/*
 * BIO_MP_PAID_FINALIZER_V1
 *
 * Autoridade unica dos efeitos comerciais depois
 * que o Mercado Pago confirmou PAID.
 *
 * Nao cria cobranca.
 * Nao toca Pix/Lunium.
 *
 * O cupom comercial e protegido por:
 * - advisory lock por orderId;
 * - verificacao de redemption existente.
 *
 * Partner permanece efeito secundario e idempotente.
 */
export async function finalizeMercadoPagoPaid(
  input: FinalizeMercadoPagoPaidInput
) {
  const paidAt =
    input.paidAt ?? new Date().toISOString();

  const result = await db.transaction(
    async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${input.orderId}))`
      );

      const [order] = await tx
        .select({
          id: orders.id,
          customerId:
            orders.customerId,
          couponCode:
            orders.couponCode,
          couponDiscountCents:
            orders.couponDiscountCents,
          partnerCouponId:
            orders.partnerCouponId,
        })
        .from(orders)
        .where(
          eq(
            orders.id,
            input.orderId
          )
        )
        .limit(1);

      if (!order) {
        throw new Error(
          `Pedido ${input.orderId} nao encontrado na finalizacao Mercado Pago.`
        );
      }

      await tx
        .update(orders)
        .set({
          status: "paid",
          fulfillmentStatus:
            "paid_to_prepare",

          ...(order.partnerCouponId
            ? {
                partnerCommissionStatus:
                  "pending_return_window",
              }
            : {}),
        })
        .where(
          eq(
            orders.id,
            order.id
          )
        );

      let commercialCouponStatus:
        | "no_commercial_coupon"
        | "already_recorded"
        | "recorded" =
        "no_commercial_coupon";

      if (
        order.couponCode &&
        order.couponDiscountCents &&
        order.couponDiscountCents > 0
      ) {
        const [existing] =
          await tx
            .select({
              id:
                couponRedemptions.id,
            })
            .from(
              couponRedemptions
            )
            .where(
              eq(
                couponRedemptions.orderId,
                order.id
              )
            )
            .limit(1);

        if (existing) {
          commercialCouponStatus =
            "already_recorded";
        } else {
          const normalizedCode =
            order.couponCode
              .trim()
              .toUpperCase();

          const [coupon] =
            await tx
              .select({
                id: coupons.id,
              })
              .from(coupons)
              .where(
                eq(
                  coupons.code,
                  normalizedCode
                )
              )
              .limit(1);

          if (!coupon) {
            throw new Error(
              `Cupom comercial ${normalizedCode} do pedido ${order.id} nao foi encontrado.`
            );
          }

          const [customer] =
            await tx
              .select({
                email:
                  customers.email,
              })
              .from(customers)
              .where(
                eq(
                  customers.id,
                  order.customerId
                )
              )
              .limit(1);

          if (!customer?.email) {
            throw new Error(
              `Cliente do pedido ${order.id} nao possui email para registrar o cupom.`
            );
          }

          await tx
            .insert(
              couponRedemptions
            )
            .values({
              couponId:
                coupon.id,
              customerEmail:
                customer.email,
              orderId:
                order.id,
              discountCents:
                order
                  .couponDiscountCents,
            });

          await tx
            .update(coupons)
            .set({
              usedCount:
                sql`${coupons.usedCount} + 1`,
            })
            .where(
              eq(
                coupons.id,
                coupon.id
              )
            );

          commercialCouponStatus =
            "recorded";
        }
      }

      return {
        orderId:
          order.id,
        commercialCouponStatus,
      };
    }
  );

  try {
    await confirmPartnerPaid(
      input.orderId,
      {
        provider:
          "mercadopago",
        providerPaymentId:
          input.providerPaymentId,
        paidAt,
      }
    );
  } catch (partnerError) {
    console.error(
      "[mercadopago/finalize-paid] pagamento aprovado; Partner pendente de reconciliacao",
      partnerError
    );
  }

  return result;
}