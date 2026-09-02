import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { coupons } from "@/lib/db/schema";

type CouponRequest = {
  code?: string;
  subtotalCents?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CouponRequest;

    const code =
      typeof body.code === "string"
        ? body.code.trim().toUpperCase()
        : "";

    const subtotalCents = Number(body.subtotalCents);

    if (!code) {
      return NextResponse.json(
        { error: "Informe um cupom." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(subtotalCents) ||
      subtotalCents <= 0
    ) {
      return NextResponse.json(
        { error: "Subtotal inválido." },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code))
      .limit(1);

    const coupon = result[0];

    if (!coupon) {
      return NextResponse.json(
        { error: "Cupom não encontrado." },
        { status: 404 }
      );
    }

    if (!coupon.active) {
      return NextResponse.json(
        { error: "Este cupom não está ativo." },
        { status: 400 }
      );
    }

    const now = new Date();

    if (
      coupon.startsAt &&
      now < coupon.startsAt
    ) {
      return NextResponse.json(
        { error: "Este cupom ainda não está disponível." },
        { status: 400 }
      );
    }

    if (
      coupon.expiresAt &&
      now > coupon.expiresAt
    ) {
      return NextResponse.json(
        { error: "Este cupom expirou." },
        { status: 400 }
      );
    }

    if (
      coupon.maxUses !== null &&
      coupon.maxUses !== undefined &&
      coupon.usedCount >= coupon.maxUses
    ) {
      return NextResponse.json(
        { error: "Este cupom atingiu o limite de utilizações." },
        { status: 400 }
      );
    }

    const minimum =
      coupon.minSubtotalCents ?? 0;

    if (subtotalCents < minimum) {
      return NextResponse.json(
        {
          error:
            "O pedido não atingiu o valor mínimo deste cupom.",
          minSubtotalCents: minimum,
        },
        { status: 400 }
      );
    }

    let discountCents = 0;

    if (coupon.discountType === "percentage") {
      discountCents = Math.round(
        subtotalCents *
          (coupon.discountValue / 100)
      );
    }
    else if (coupon.discountType === "fixed") {
      discountCents = coupon.discountValue;
    }
    else {
      return NextResponse.json(
        { error: "Configuração de desconto inválida." },
        { status: 500 }
      );
    }

    discountCents = Math.max(
      0,
      Math.min(discountCents, subtotalCents)
    );

    const couponType =
      coupon.couponType === "partner"
        ? "partner"
        : "normal";

    return NextResponse.json({
      valid: true,

      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,

        couponType,

        partnerId:
          couponType === "partner"
            ? coupon.partnerId ?? null
            : null,

        commissionPercent:
          couponType === "partner"
            ? coupon.commissionPercent ?? 0
            : 0,
      },

      discountCents,
    });
  }
  catch (error) {
    console.error(
      "Erro ao validar cupom Bio Florais:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível validar o cupom.",
      },
      { status: 500 }
    );
  }
}