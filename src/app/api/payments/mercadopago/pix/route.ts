import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/client";
import {
  customers,
  orders,
  payments,
} from "@/lib/db/schema";
import { PIX_NO_CODE_MESSAGE, PIX_REUSE_MAX_AGE_MINUTES, PIX_VALIDITY_MINUTES, pixResponseFromOrder, reusablePix } from "@/lib/payments/pix-reuse";

type RequestBody = {
  orderId?: string;
};

type MercadoPagoOrderResponse = {
  id?: string;
  status?: string;
  status_detail?: string;

  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      status_detail?: string;

      payment_method?: {
        id?: string;
        type?: string;
        ticket_url?: string;
        qr_code?: string;
        qr_code_base64?: string;
      };
    }>;
  };

  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};

function centsToAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

function getFirstName(name?: string | null) {
  const normalized =
    name?.trim() ?? "";

  if (!normalized) {
    return "Cliente";
  }

  return (
    normalized.split(/\s+/)[0] ||
    "Cliente"
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const accessToken =
      process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "MERCADOPAGO_ACCESS_TOKEN não configurado.",
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

    /*
     * Buscamos o valor e os dados
     * diretamente no Neon.
     *
     * Nunca confiamos no valor
     * enviado pelo navegador.
     */
    const result = await db
      .select({
        orderId:
          orders.id,

        totalCents:
          orders.totalCents,

        status:
          orders.status,

        customerId:
          customers.id,

        customerEmail:
          customers.email,

        customerName:
          customers.name,
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

    /*
     * Pedido já pago não pode gerar
     * um novo Pix.
     */
    if (
      order.status === "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Este pedido já está pago.",
        },
        { status: 409 }
      );
    }

    if (!order.customerEmail) {
      return NextResponse.json(
        {
          error:
            "Pedido sem e-mail de cliente.",
        },
        { status: 400 }
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

    /*
     * Pix pendente do MESMO pedido e valor, com código e criado há menos de 25 min: devolve o mesmo, em vez de criar outro
     * (aprovado pelo Luis em 10/11: um pedido gerou 11 Pix em 6 minutos, a cada "Tentar novamente" ou nova abertura da página).
     */
    const recentPix = await db
      .select({ status: payments.status, rawPayload: payments.rawPayload, createdAt: payments.createdAt })
      .from(payments)
      .where(
        and(
          eq(payments.orderId, order.orderId),
          eq(payments.provider, "mercadopago"),
          eq(payments.method, "pix"),
          sql`${payments.createdAt} > (now() AT TIME ZONE 'UTC') - make_interval(mins => ${PIX_REUSE_MAX_AGE_MINUTES})`
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(5);

    const totalAmount = centsToAmount(order.totalCents);

    for (const candidate of recentPix) {
      const reused = reusablePix(candidate, totalAmount);

      if (reused) return NextResponse.json({ success: true, reused: true, ...reused });
    }

    /*
     * PRODUÇÃO
     *
     * Sempre usamos os dados reais
     * do comprador.
     *
     * APRO e @testuser.com eram
     * exclusivamente do sandbox e
     * não devem existir aqui.
     */
    const payerEmail =
      order.customerEmail.trim();

    const payerFirstName =
      getFirstName(
        order.customerName
      );

    /*
     * O Mercado Pago exige uma
     * X-Idempotency-Key exclusiva
     * para a criação da order.
     */
    const idempotencyKey =
      randomUUID();

    const mercadoPagoResponse =
      await fetch(
        "https://api.mercadopago.com/v1/orders",
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${accessToken}`,

            "X-Idempotency-Key":
              idempotencyKey,
          },

          body: JSON.stringify({
            type:
              "online",

            external_reference:
              order.orderId,

            total_amount:
              centsToAmount(
                order.totalCents
              ),

            processing_mode:
              "automatic",

            transactions: {
              payments: [
                {
                  amount:
                    centsToAmount(
                      order.totalCents
                    ),

                  payment_method: {
                    id:
                      "pix",

                    type:
                      "bank_transfer",
                  },

                  /*
                   * Pix válido por
                   * 30 minutos.
                   */
                  expiration_time:
                    "PT30M",
                },
              ],
            },

            payer: {
              email:
                payerEmail,

              first_name:
                payerFirstName,
            },
          }),
        }
      );

    const data =
      (await mercadoPagoResponse.json()) as
        MercadoPagoOrderResponse;

    if (
      !mercadoPagoResponse.ok
    ) {
      console.error(
        "Erro Mercado Pago Pix:",
        data
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível gerar o Pix neste momento.",

          details:
            data,
        },
        {
          status:
            mercadoPagoResponse.status,
        }
      );
    }

    const mpPayment =
      data.transactions
        ?.payments?.[0];

    const paymentMethod =
      mpPayment
        ?.payment_method;

    if (
      !data.id ||
      !mpPayment ||
      !paymentMethod
    ) {
      console.error(
        "Resposta incompleta Mercado Pago Pix:",
        data
      );

      return NextResponse.json(
        {
          error:
            "Mercado Pago retornou uma resposta incompleta ao gerar o Pix.",
        },
        { status: 502 }
      );
    }

    /*
     * Registramos no Neon a
     * tentativa/pagamento Pix.
     */
    await db
      .insert(payments)
      .values({
        orderId:
          order.orderId,

        provider:
          "mercadopago",

        externalId:
          data.id,

        method:
          "pix",

        status:
          mpPayment.status ??
          data.status ??
          "pending",

        rawPayload:
          data,
      });

    // Sem o código do Pix não dá para pagar: a tentativa fica registrada acima, e a tela recebe um erro claro (antes: 200 sem
    // código, "Não foi possível carregar o Pix" e um Pix novo a cada "Tentar novamente").
    if (!pixResponseFromOrder(data)) {
      return NextResponse.json({ error: PIX_NO_CODE_MESSAGE }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      expiresAt: new Date(Date.now() + PIX_VALIDITY_MINUTES * 60 * 1000).toISOString(),

      mercadoPagoOrderId:
        data.id,

      mercadoPagoPaymentId:
        mpPayment.id ??
        null,

      status:
        mpPayment.status ??
        data.status ??
        "pending",

      statusDetail:
        mpPayment.status_detail ??
        data.status_detail ??
        null,

      pix: {
        ticketUrl:
          paymentMethod.ticket_url ??
          null,

        qrCode:
          paymentMethod.qr_code ??
          null,

        qrCodeBase64:
          paymentMethod.qr_code_base64 ??
          null,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao criar Pix Mercado Pago:",
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