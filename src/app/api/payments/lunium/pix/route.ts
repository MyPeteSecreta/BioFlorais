import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  customers,
  orders,
  payments,
} from "@/lib/db/schema";

const LUNIUM_API_URL = "https://api.luniumpay.com";

type RequestBody = {
  orderId?: string;
};

type LuniumCreateResponse = {
  cashin_id?: string;
  status?: string;
  amount_cents?: number;
  payout_address?: string;
  chain?: string;
  qr_copypaste?: string;
  qr_image_url?: string;
  external_id?: string;
  expires_at?: string;
  erro?: string;
  acao?: string;
  request_id?: string;
};

function onlyDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      process.env.LUNIUM_API_KEY?.trim();

    const settlementAddress =
      process.env.LUNIUM_SETTLEMENT_ADDRESS?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "LUNIUM_API_KEY n\u00e3o configurada no servidor.",
        },
        { status: 500 }
      );
    }

    if (!settlementAddress) {
      return NextResponse.json(
        {
          error:
            "LUNIUM_SETTLEMENT_ADDRESS n\u00e3o configurado no servidor.",
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
            "Pedido n\u00e3o informado.",
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
            "Pedido n\u00e3o encontrado.",
        },
        { status: 404 }
      );
    }

    const existingPayments =
      await db
        .select({
          provider:
            payments.provider,

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
              | LuniumCreateResponse
              | null;

          return Boolean(
            item.provider === "lunium" &&
            item.externalId &&
            raw?.qr_copypaste
          );
        }
      );

    if (existingPix) {
      const existing =
        existingPix.rawPayload as
          LuniumCreateResponse;

      return NextResponse.json({
        success: true,

        reused: true,

        provider:
          "lunium",

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
            existing.qr_copypaste!,

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
            "Este pedido j\u00e1 est\u00e1 pago.",
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
            "Pedido possui valor inv\u00e1lido.",
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
            "CPF ou CNPJ do pagador inv\u00e1lido.",
        },
        { status: 400 }
      );
    }

    const luniumResponse =
      await fetch(
        LUNIUM_API_URL +
          "/cashin/charge",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-API-Key":
              apiKey,
          },

          body: JSON.stringify({
            amount_cents:
              order.totalCents,

            payer_tax_number:
              payerDocument,

            payer_name:
              order.customerName ??
              undefined,

            payout_address:
              settlementAddress,

            external_id:
              order.orderId,

            asset:
              "usdt",

            chain:
              "polygon",
          }),

          cache: "no-store",
        }
      );

    const data =
      (await luniumResponse
        .json()
        .catch(() => null)) as
          | LuniumCreateResponse
          | null;

    if (!luniumResponse.ok) {
      console.error(
        "Lunium cash-in error:",
        {
          status:
            luniumResponse.status,

          data,
        }
      );

      const payerRejected =
        data?.erro ===
          "pagador_recusado_pelo_provedor";

      return NextResponse.json(
        {
          error: payerRejected
            ? "N\u00e3o foi poss\u00edvel gerar o Pix com este CPF/CNPJ. Confira os dados informados ou escolha outra forma de pagamento."
            : "N\u00e3o foi poss\u00edvel gerar o Pix neste momento.",

          code:
            data?.erro ?? null,

          action:
            data?.acao ?? null,

          provider:
            "lunium",

          requestId:
            data?.request_id ?? null,
        },
        {
          status:
            luniumResponse.status,
        }
      );
    }

    if (
      !data?.cashin_id ||
      !data.qr_copypaste
    ) {
      console.error(
        "Resposta incompleta Lunium:",
        data
      );

      return NextResponse.json(
        {
          error:
            "Lunium retornou uma resposta incompleta.",
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
          "lunium",

        externalId:
          data.cashin_id,

        method:
          "pix",

        status:
          data.status ??
          "pending",

        rawPayload:
          data,
      });

    return NextResponse.json({
      success: true,

      provider:
        "lunium",

      paymentId:
        data.cashin_id,

      externalId:
        data.external_id ??
        order.orderId,

      status:
        data.status ??
        "pending",

      expiresAt:
        data.expires_at ??
        null,

      pix: {
        qrCode:
          data.qr_copypaste,

        qrImageUrl:
          data.qr_image_url ??
          null,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao criar Pix Lunium:",
      error
    );

    return NextResponse.json(
      {
        error:
          "N\u00e3o foi poss\u00edvel iniciar o pagamento Pix.",
      },
      { status: 500 }
    );
  }
}
