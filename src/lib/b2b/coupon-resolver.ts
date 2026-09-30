/**
 * BIO FLORAIS B2B — validação e cálculo de cupom B2B.
 *
 * Compartilhado por /api/b2b/shipping/quote (preview) e
 * /api/b2b/orders/create (autoridade): as duas precisam chegar à MESMA
 * base pós-cupom, que decide o piso de R$ 450 do frete.
 *
 * Só cupons scope='b2b' valem aqui; o B2C filtra scope='b2c'
 * (mutuamente exclusivos). Cupom de parceira/UGC nunca vale no B2B.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { couponRedemptions, coupons } from "@/lib/db/schema";

export type B2BCouponResolution =
  | {
      ok: true;
      couponId: string | null;
      couponCode: string | null;
      couponDiscountCents: number;
      /**
       * Cupom de teste (discounts_shipping = true, só percentual): o mesmo
       * percentual também desconta o frete cobrado. 0 quando não se aplica.
       */
      shippingDiscountPercent: number;
    }
  | { ok: false; status: number; message: string };

const NO_COUPON: B2BCouponResolution = {
  ok: true,
  couponId: null,
  couponCode: null,
  couponDiscountCents: 0,
  shippingDiscountPercent: 0,
};

export async function resolveB2BCouponDiscount(
  rawCouponCode: string | null | undefined,
  subtotalCents: number,
  customerEmail?: string
): Promise<B2BCouponResolution> {
  const code = rawCouponCode?.trim().toUpperCase() ?? "";

  if (!code) {
    return NO_COUPON;
  }

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code), eq(coupons.scope, "b2b")))
    .limit(1);

  if (!coupon || !coupon.active || coupon.couponType === "partner") {
    return {
      ok: false,
      status: 400,
      message: "O cupom informado não é válido para pedidos B2B.",
    };
  }

  const now = new Date();

  if (coupon.startsAt && now < coupon.startsAt) {
    return { ok: false, status: 400, message: "Este cupom ainda não está disponível." };
  }

  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { ok: false, status: 400, message: "Este cupom expirou." };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return {
      ok: false,
      status: 400,
      message: "Este cupom atingiu o limite de utilizações.",
    };
  }

  if (subtotalCents < (coupon.minSubtotalCents ?? 0)) {
    return {
      ok: false,
      status: 400,
      message: "O valor desta compra não atende ao mínimo exigido pelo cupom.",
    };
  }

  if (coupon.onePerCustomer && customerEmail) {
    const [previous] = await db
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(
        and(
          eq(couponRedemptions.couponId, coupon.id),
          eq(couponRedemptions.customerEmail, customerEmail)
        )
      )
      .limit(1);

    if (previous) {
      return {
        ok: false,
        status: 400,
        message: "Este cupom já foi utilizado por este cliente.",
      };
    }
  }

  const isPercentage = coupon.discountType === "percentage";

  const rawDiscount = isPercentage
    ? Math.round(subtotalCents * (coupon.discountValue / 100))
    : coupon.discountValue;

  return {
    ok: true,
    couponId: coupon.id,
    couponCode: coupon.code,
    couponDiscountCents: Math.min(Math.max(0, rawDiscount), subtotalCents),
    shippingDiscountPercent:
      coupon.discountsShipping && isPercentage
        ? Math.min(100, Math.max(0, coupon.discountValue))
        : 0,
  };
}
