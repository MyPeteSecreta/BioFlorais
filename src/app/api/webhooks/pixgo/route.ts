import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  orders,
  payments,
} from "@/lib/db/schema";

type PixGoWebhook = {
  event?: string;

  data?: {
    payment_id?: string;
    external_id?: string | null;
    amount?: number;
    status?: string;
    completed_at?: string;
    expired_at?: string;
    refunded_at?: string;
  };
};

function safeCompare(
  calculated: string,
  received: string
) {
  try {
    const a =
      Buffer.from(
        calculated,
        "hex"
      );

    const b =
      Buffer.from(
        received,
        "hex"
      );

    if (
      a.length === 0 ||
      b.length === 0 ||
      a.length !== b.length
    ) {
      return false;
    }

    return timingSafeEqual(
      a,
      b
    );
  } catch {
    return false;
  }
}

function validateSignature({
  rawBody,
  timestamp,
  signature,
  secret,
}: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
}) {
  const signedPayload =
    `${timestamp}.${rawBody}`;

  const calculated =
    createHmac(
      "sha256",
      secret
    )
      .update(signedPayload)
      .digest("hex");

  return safeCompare(
    calculated,
    signature
  );
}

function mapOrderStatus(
  event: string,
  paymentStatus: string
) {
  if (
    event === "payment.completed" ||
    paymentStatus === "completed" ||
    paymentStatus === "paid"
  ) {
    return "paid";
  }

  if (
    event === "payment.expired" ||
    paymentStatus === "expired"
  ) {
    return "cancelled";
  }

  /*
   * Refund não é tratado como
   * cancelamento automático neste
   * momento. Mantemos o pedido para
   * tratamento administrativo.
   */
  return "pending";
}

export async function POST(
  request: NextRequest
) {
  try {
    const webhookSecret =
      process.env
        .PIXGO_WEBHOOK_SECRET
        ?.trim();

    if (!webhookSecret) {
      console.error(
        "PIXGO_WEBHOOK_SECRET não configurado."
      );

      return NextResponse.json(
        {
          error:
            "Webhook PixGo não configurado.",
        },
        { status: 500 }
      );
    }

    /*
     * IMPORTANTE:
     * assinatura PixGo depende do
     * body bruto. Não usar
     * request.json() antes daqui.
     */
    const rawBody =
      await request.text();

    const timestamp =
      request.headers.get(
        "x-webhook-timestamp"
      ) ?? "";

    const signature =
      request.headers.get(
        "x-webhook-signature"
      ) ?? "";

    if (
      !timestamp ||
      !signature
    ) {
      console.warn(
        "Webhook PixGo sem assinatura."
      );

      return NextResponse.json(
        {
          error:
            "Assinatura inválida.",
        },
        { status: 401 }
      );
    }

    const validSignature =
      validateSignature({
        rawBody,
        timestamp,
        signature,
        secret:
          webhookSecret,
      });

    if (!validSignature) {
      console.warn(
        "Webhook PixGo rejeitado por assinatura inválida."
      );

      return NextResponse.json(
        {
          error:
            "Assinatura inválida.",
        },
        { status: 401 }
      );
    }

    let body:
      PixGoWebhook;

    try {
      body =
        JSON.parse(
          rawBody
        ) as PixGoWebhook;
    } catch {
      return NextResponse.json(
        {
          error:
            "Payload inválido.",
        },
        { status: 400 }
      );
    }

    const event =
      body.event?.trim() ?? "";

    const payment =
      body.data;

    const paymentId =
      payment
        ?.payment_id
        ?.trim() ?? "";

    const localOrderId =
      payment
        ?.external_id
        ?.trim() ?? "";

    const paymentStatus =
      payment
        ?.status
        ?.trim() ??
      "pending";

    if (
      !paymentId ||
      !localOrderId
    ) {
      console.warn(
        "Webhook PixGo sem payment_id ou external_id.",
        body
      );

      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    /*
     * Só processamos eventos que
     * conhecemos.
     */
    if (
      event !== "payment.completed" &&
      event !== "payment.expired" &&
      event !== "payment.refunded"
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
        event,
      });
    }

    const localOrders =
      await db
        .select({
          id:
            orders.id,

          status:
            orders.status,
        })
        .from(orders)
        .where(
          eq(
            orders.id,
            localOrderId
          )
        )
        .limit(1);

    if (
      localOrders.length === 0
    ) {
      console.warn(
        "Pedido PixGo não encontrado no My Pet:",
        {
          paymentId,
          localOrderId,
          event,
        }
      );

      return NextResponse.json({
        received: true,
        ignored: true,
        reason:
          "order_not_found",
      });
    }

    /*
     * Atualização idempotente do
     * registro de pagamento.
     */
    const existingPayments =
      await db
        .select()
        .from(payments)
        .where(
          eq(
            payments.externalId,
            paymentId
          )
        )
        .limit(1);

    if (
      existingPayments.length > 0
    ) {
      await db
        .update(payments)
        .set({
          status:
            paymentStatus,

          rawPayload:
            body,
        })
        .where(
          eq(
            payments.id,
            existingPayments[0].id
          )
        );
    } else {
      await db
        .insert(payments)
        .values({
          orderId:
            localOrderId,

          provider:
            "pixgo",

          externalId:
            paymentId,

          method:
            "pix",

          status:
            paymentStatus,

          rawPayload:
            body,
        });
    }

    const localOrderStatus =
      mapOrderStatus(
        event,
        paymentStatus
      );

    /*
     * payment.completed:
     * libera pedido imediatamente.
     *
     * payment.expired:
     * cancela pedido pendente.
     *
     * payment.refunded:
     * não sobrescreve automaticamente
     * um pedido que já estava pago.
     */
    if (
      event ===
        "payment.completed" ||
      (
        event ===
          "payment.expired" &&
        localOrders[0].status !==
          "paid"
      )
    ) {
      await db
        .update(orders)
        .set({
          status:
            localOrderStatus,
        })
        .where(
          eq(
            orders.id,
            localOrderId
          )
        );
    }

    console.log(
      "Webhook PixGo processado:",
      {
        event,
        paymentId,
        localOrderId,
        paymentStatus,
        localOrderStatus,
      }
    );

    return NextResponse.json({
      received: true,
      event,
      paymentId,
      orderId:
        localOrderId,

      status:
        event ===
        "payment.refunded"
          ? localOrders[0].status
          : localOrderStatus,
    });
  } catch (error) {
    console.error(
      "Erro no webhook PixGo:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro ao processar webhook PixGo.",
      },
      { status: 500 }
    );
  }
}
