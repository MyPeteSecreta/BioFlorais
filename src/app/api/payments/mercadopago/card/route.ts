import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { createMercadoPagoCardAdapter } from "@angelblancdigital/payments";

import { db } from "@/lib/db/client";
import { finalizeMercadoPagoPaid } from "@/lib/payments/finalize-mercadopago-paid";
import { cardAttemptIdempotencyKey, cardDeclineMessage, outcomeFromAdapterError, outcomeFromPayload } from "@/lib/payments/card-decline";
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
        paymentMethodDiscountCents: orders.paymentMethodDiscountCents,
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

    // Pedido criado para pagar no Pix tem o desconto do Pix dentro do total: não pode ser pago no cartão (o desconto é só do Pix).
    if ((order.paymentMethodDiscountCents ?? 0) > 0) {
      return NextResponse.json(
        { error: "Este pedido foi criado com desconto para pagamento no Pix. Para pagar no cartão, volte ao checkout e escolha cartão." },
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
    // BIO_MP_SERVER_IDEMPOTENCY_V2 (09/11): a chave é POR TENTATIVA (pedido + token do cartão). O duplo envio do mesmo
    // cartão reaproveita a chave; outra tentativa ou outro cartão não herda a recusa da anterior.
    const idempotencyKey = cardAttemptIdempotencyKey(order.id, cardToken);
const adapter = createMercadoPagoCardAdapter({
      accessToken,
    });

    let result: Awaited<ReturnType<typeof adapter.createPayment>>;

    try {
      result = await adapter.createPayment({
        orderId: order.id,
        amountCents: order.totalCents,
        payerEmail: authoritativeEmail,
        cardToken,
        paymentMethodId,
        installments,
        idempotencyKey,
      });
    } catch (paymentError) {
      // Recusa do MP (ex.: 402 high_risk): grava a tentativa como "failed" com o motivo, sem token nem dado do cartão,
      // e devolve uma mensagem clara (antes o cliente via o JSON do MP e nada ficava em payments).
      const declined = outcomeFromAdapterError(paymentError);

      if (!declined) throw paymentError;

      console.error("[mercadopago/card] recusado", { orderId: order.id, ...declined });

      await db.insert(payments).values({
        orderId: order.id,
        provider: "mercadopago",
        externalId: declined.mpOrderId,
        method: "card",
        status: "failed",
        rawPayload: { installments, paymentMethodId, ...declined },
      });

      return NextResponse.json(
        { error: cardDeclineMessage(declined.mpStatusDetail), statusDetail: declined.mpStatusDetail },
        { status: 402 }
      );
    }

    const outcome = outcomeFromPayload(result.rawPayload);

    await db.insert(payments).values({
      orderId: order.id,
      provider: "mercadopago",
      externalId: result.externalId,
      method: "card",
      status: result.status,
      rawPayload: {
        installments,
        paymentMethodId,
        mpStatus: outcome.mpStatus,
        mpStatusDetail: outcome.mpStatusDetail,
      },
    });

    // Recusa sem erro HTTP: a mesma mensagem clara.
    if (result.status === "failed" || result.status === "cancelled") {
      return NextResponse.json({ error: cardDeclineMessage(outcome.mpStatusDetail), statusDetail: outcome.mpStatusDetail }, { status: 402 });
    }

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
