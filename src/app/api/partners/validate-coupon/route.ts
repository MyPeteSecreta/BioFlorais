import { NextResponse } from "next/server";

import { validatePartnerCoupon } from "@/lib/partners/academia";

type PartnerCouponRequest = {
  code?: string;
  subtotalCents?: number;
};

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as PartnerCouponRequest;

    const code =
      typeof body.code === "string"
        ? body.code.trim().toUpperCase()
        : "";

    const subtotalCents =
      Number(body.subtotalCents);

    if (!code) {
      return NextResponse.json(
        { error: "Informe um cupom UGC/parceira." },
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

    const partner =
      await validatePartnerCoupon(
        code,
        subtotalCents
      );

    if (!partner) {
      return NextResponse.json(
        {
          error:
            "Cupom UGC/parceira não encontrado ou não disponível.",
        },
        { status: 404 }
      );
    }

    const discountCents =
      Math.max(
        0,
        Math.min(
          subtotalCents,
          Math.round(
            subtotalCents *
              (partner.discountPercent / 100)
          )
        )
      );

    return NextResponse.json({
      valid: true,

      coupon: {
        code: partner.code,
        discountType: "percentage",
        discountValue:
          partner.discountPercent,
        couponType: "partner",
        partnerId: partner.partnerId,
        commissionPercent:
          partner.commissionPercent,
      },

      partnerCouponId:
        partner.partnerCouponId,

      campaign:
        partner.campaign,

      discountCents,
    });
  } catch (error) {
    console.error(
      "Erro ao validar cupom Partner Bio Florais:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível validar o cupom UGC/parceira.",
      },
      { status: 500 }
    );
  }
}
