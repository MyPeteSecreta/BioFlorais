import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { createMercadoPagoCardAdapter } from "@angelblancdigital/payments";

import { db } from "@/lib/db/client";
import { finalizeMercadoPagoPaid } from "@/lib/payments/finalize-mercadopago-paid";
import { customers, orders, payments } from "@/lib/db/schema";

export const runtime = "nodejs";

type CardRequest = {
  orderId?: string;
  cardToken?: string;
  paymentMethodId?: string;
  installments?: number;
  payerEmail?: string;
};


export async function POST(request: Request) {
  try {
    const accessToken =
      process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Mercado Pago nÃƒÂ£o configurado." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as CardRequest;

    const orderId = body.orderId?.trim();
    const cardToken = body.cardToken?.trim();
    const paymentMethodId =
      body.paymentMethodId?.trim();
    const payerEmail = body.payerEmail?.trim();
    const installments = Number(body.installments);

    if (
      !orderId ||
      !cardToken ||
      !paymentMethodId ||
      !payerEmail ||
      !Number.isInteger(installments) ||
      installments < 1
    ) {
      return NextResponse.json(
        { error: "Dados do cartÃƒÂ£o incompletos." },
        { status: 400 }
      );
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalCents: orders.totalCents,
        customerId: orders.customerId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: "Pedido nÃƒÂ£o encontrado." },
        { status: 404 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json(
        { error: "Pedido jÃƒÂ¡ estÃƒÂ¡ pago." },
        { status: 409 }
      );
    }

    if (
      !Number.isInteger(order.totalCents) ||
      order.totalCents <= 0
    ) {
      return NextResponse.json(
        { error: "Valor do pedido invÃƒÂ¡lido." },
        { status: 409 }
      );
    }

    /*
     * O navegador NÃƒÆ’O define o valor.
     * O total enviado ao Mercado Pago vem exclusivamente
     * do snapshot server-authoritative do pedido.
     */
    let authoritativeEmail = payerEmail;

    if (order.customerId) {
      const [customer] = await db
        .select({
          email: customers.email,
        })
        .from(customers)
        .where(eq(customers.id, order.customerId))
        .limit(1);

      if (customer?.email) {
        authoritativeEmail = customer.email;
      }
    }

        // B2C_CARD_INSTALLMENT_RULE
    // Regra autoritativa:
    // sem pedido minimo,
    // parcela minima R$ 50,
    // maximo absoluto 3x.
    const B2C_MIN_INSTALLMENT_CENTS =
      5000;
    const B2C_MAX_INSTALLMENTS = 3;

    const allowedInstallments =
      Math.max(
        1,
        Math.min(
          B2C_MAX_INSTALLMENTS,
          Math.floor(
            order.totalCents /
              B2C_MIN_INSTALLMENT_CENTS
          )
        )
      );

    if (
      !Number.isInteger(installments) ||
      installments < 1 ||
      installments >
        allowedInstallments
    ) {
      return NextResponse.json(
        {
          error:
            "Parcelamento invÃ¡lido para o valor deste pedido.",
        },
        { status: 400 }
      );
    }
    // BIO_MP_SERVER_IDEMPOTENCY_V1
    // A identidade da tentativa de pagamento pertence ao servidor.
    // Retry/F5/duplo envio do mesmo checkout_pending reutiliza a
    // mesma chave no Mercado Pago.
    const idempotencyKey =
      `bio-card-order-${order.id}`;
const adapter = createMercadoPagoCardAdapter({
      accessToken,
    });

    const result = await adapter.createPayment({
      orderId: order.id,
      amountCents: order.totalCents,
      payerEmail: authoritativeEmail,
      cardToken,
      paymentMethodId,
      installments,
      idempotencyKey,
    });

    await db.insert(payments).values({
      orderId: order.id,
      provider: "mercadopago",
      externalId: result.externalId,
      method: "card",
      status: result.status,
    });

    if (result.status === "paid") {
      // BIO_MP_SHARED_PAID_FINALIZER_CARD_V1
      await finalizeMercadoPagoPaid({
        orderId: order.id,
        providerPaymentId:
          String(result.externalId),
        paidAt:
          new Date().toISOString(),
      });
    }
    return NextResponse.json({
      ok: true,
      payment: {
        provider: "mercadopago",
        externalId: result.externalId,
        status: result.status,
      },
      order: {
        id: order.id,
        totalCents: order.totalCents,
      },
    });
  } catch (error) {
    console.error(
      "[mercadopago/card] payment failed",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "NÃƒÂ£o foi possÃƒÂ­vel processar o cartÃƒÂ£o.",
      },
      { status: 500 }
    );
  }
}
