import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  customers,
  orders,
  payments,
} from "@/lib/db/schema";

type RequestBody = {
  orderId?: string;
};

type PixGoCreateResponse = {
  success?: boolean;

  data?: {
    payment_id?: string;
    external_id?: string | null;
    amount?: number;
    status?: string;
    qr_code?: string;
    qr_image_url?: string;
    expires_at?: string;
    created_at?: string;
  };

  error?: string;
  message?: string;
};

function onlyDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export async function POST(
  request: NextRequest
) {
  try {
    const apiKey =
      process.env.PIXGO_API_KEY?.trim();

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "PIXGO_API_KEY não configurada.",
        },
        { status: 500 }
      );
    }

    if (!siteUrl) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SITE_URL não configurada.",
        },
        { status: 500 }
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const orderId =
      body.orderId?.trim() ?? "";

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "Pedido não informado.",
        },
        { status: 400 }
      );
    }

    const result = await db
      .select({
        orderId:
          orders.id,

        totalCents:
          orders.totalCents,

        status:
          orders.status,

        customerName:
          customers.name,

        customerEmail:
          customers.email,

        customerPhone:
          customers.phone,

        personType:
          customers.personType,

        cpf:
          customers.cpf,

        cnpj:
          customers.cnpj,
      })
      .from(orders)
      .leftJoin(
        customers,
        eq(
          customers.id,
          orders.customerId
        )
      )
      .where(
        eq(
          orders.id,
          orderId
        )
      )
      .limit(1);

    const order = result[0];

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Pedido não encontrado.",
        },
        { status: 404 }
      );
    }

    const existingPayments =
      await db
        .select({
          externalId:
            payments.externalId,

          status:
            payments.status,

          rawPayload:
            payments.rawPayload,
        })
        .from(payments)
        .where(
          eq(
            payments.orderId,
            order.orderId
          )
        );

    const existingPix =
      existingPayments.find(
        (item) => {
          const raw =
            item.rawPayload as
              | PixGoCreateResponse
              | null;

          return Boolean(
            item.externalId &&
            raw?.data?.qr_code
          );
        }
      );

    if (existingPix) {
      const raw =
        existingPix.rawPayload as
          PixGoCreateResponse;

      const existing =
        raw.data!;

      return NextResponse.json({
        success: true,

        reused: true,

        provider:
          "pixgo",

        paymentId:
          existingPix.externalId,

        externalId:
          existing.external_id ??
          order.orderId,

        status:
          existingPix.status ??
          existing.status ??
          "pending",

        expiresAt:
          existing.expires_at ??
          null,

        pix: {
          qrCode:
            existing.qr_code!,

          qrImageUrl:
            existing.qr_image_url ??
            null,
        },
      });
    }
    if (order.status === "paid") {
      return NextResponse.json(
        {
          error:
            "Este pedido já está pago.",
        },
        { status: 409 }
      );
    }

    if (
      !Number.isInteger(
        order.totalCents
      ) ||
      order.totalCents <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Pedido possui valor inválido.",
        },
        { status: 400 }
      );
    }

    const payerDocument =
      order.personType === "pj"
        ? onlyDigits(order.cnpj)
        : onlyDigits(order.cpf);

    if (
      payerDocument.length !== 11 &&
      payerDocument.length !== 14
    ) {
      return NextResponse.json(
        {
          error:
            "CPF ou CNPJ do pagador inválido.",
        },
        { status: 400 }
      );
    }

    const amount =
      Number(
        (
          order.totalCents / 100
        ).toFixed(2)
      );

    const pixgoResponse =
      await fetch(
        "https://pixgo.org/api/v1/payment/create",
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            "X-API-Key":
              apiKey,
          },

          body: JSON.stringify({
            amount,

            description:
              `Pedido Bio Florais ${order.orderId}`,

            receiver_name:
              order.customerName ??
              undefined,

            receiver_cpf:
              payerDocument,

            receiver_email:
              order.customerEmail ??
              undefined,

            receiver_phone:
              onlyDigits(
                order.customerPhone
              ) || undefined,

            external_id:
              order.orderId,

            webhook_url:
              `${siteUrl.replace(/\/+$/, "")}/api/webhooks/pixgo`,
          }),
        }
      );

    const data =
      (await pixgoResponse.json()) as
        PixGoCreateResponse;

    if (!pixgoResponse.ok) {
      console.error(
        "Erro PixGo:",
        data
      );

      return NextResponse.json(
        {
          error:
            data.message ??
            "Não foi possível gerar o Pix neste momento.",

          details:
            data,
        },
        {
          status:
            pixgoResponse.status,
        }
      );
    }

    const payment =
      data.data;

    if (
      !payment?.payment_id ||
      !payment.qr_code
    ) {
      console.error(
        "Resposta incompleta PixGo:",
        data
      );

      return NextResponse.json(
        {
          error:
            "PixGo retornou uma resposta incompleta.",
        },
        { status: 502 }
      );
    }

    await db
      .insert(payments)
      .values({
        orderId:
          order.orderId,

        provider:
          "pixgo",

        externalId:
          payment.payment_id,

        method:
          "pix",

        status:
          payment.status ??
          "pending",

        rawPayload:
          data,
      });

    return NextResponse.json({
      success: true,

      provider:
        "pixgo",

      paymentId:
        payment.payment_id,

      externalId:
        payment.external_id ??
        order.orderId,

      status:
        payment.status ??
        "pending",

      expiresAt:
        payment.expires_at ??
        null,

      pix: {
        qrCode:
          payment.qr_code,

        qrImageUrl:
          payment.qr_image_url ??
          null,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao criar Pix PixGo:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar o pagamento Pix.",
      },
      { status: 500 }
    );
  }
}

