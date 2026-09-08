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

import {
  confirmPartnerPaid,
} from "@/lib/partners/confirm-paid";

type LuniumWebhookBody = {
  event?: string;
  event_id?: string;
  created_at?: string;

  data?: {
    cashin_id?: string;
    external_id?: string;
    status?: string;
    settlement_status?: string;
    amount_cents?: number;
    depix_received_cents?: number;
    usdt_amount?: string;
    settlement_tx_hash?: string;
    settlement_tx_url?: string;
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

function validateLuniumSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
) {
  const match =
    /^t=(\d+),v1=([0-9a-f]{64})$/i.exec(
      signatureHeader
    );

  if (!match) {
    return false;
  }

  const timestamp =
    Number(match[1]);

  const receivedSignature =
    match[2];

  if (
    !Number.isFinite(timestamp) ||
    Math.abs(
      Date.now() / 1000 -
        timestamp
    ) > toleranceSeconds
  ) {
    return false;
  }

  const calculatedSignature =
    createHmac(
      "sha256",
      secret
    )
      .update(
        `${match[1]}.${rawBody}`
      )
      .digest("hex");

  return safeCompare(
    calculatedSignature,
    receivedSignature
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const webhookSecret =
      process.env
        .LUNIUM_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "LUNIUM_WEBHOOK_SECRET not configured."
      );

      return NextResponse.json(
        {
          error:
            "Webhook not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const rawBody =
      await request.text();

    const signature =
      request.headers.get(
        "x-lunium-signature"
      ) ?? "";

    if (
      !signature ||
      !validateLuniumSignature(
        rawBody,
        signature,
        webhookSecret
      )
    ) {
      console.warn(
        "Lunium webhook rejected: invalid signature."
      );

      return NextResponse.json(
        {
          error:
            "Invalid signature.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      JSON.parse(
        rawBody
      ) as LuniumWebhookBody;

    if (
      body.event !==
      "cashin.settled"
    ) {
      return NextResponse.json({
        received: true,
        event:
          body.event ?? null,
        eventId:
          body.event_id ?? null,
      });
    }

    const charge =
      body.data;

    if (
      !charge?.cashin_id ||
      !charge.external_id
    ) {
      console.error(
        "Lunium settled webhook missing identifiers."
      );

      return NextResponse.json(
        {
          error:
            "Invalid webhook payload.",
        },
        {
          status: 400,
        }
      );
    }

    const orderId =
      charge.external_id;

    const existingOrders =
      await db
        .select()
        .from(orders)
        .where(
          eq(
            orders.id,
            orderId
          )
        )
        .limit(1);

    if (
      existingOrders.length === 0
    ) {
      console.warn(
        "Lunium webhook order not found:",
        {
          orderId,
          cashinId:
            charge.cashin_id,
          eventId:
            body.event_id ?? null,
        }
      );

      return NextResponse.json({
        received: true,
        ignored: true,
        reason:
          "order_not_found",
      });
    }

    const existingPayments =
      await db
        .select()
        .from(payments)
        .where(
          eq(
            payments.externalId,
            charge.cashin_id
          )
        )
        .limit(1);

    const rawPayload = {
      event:
        body.event,
      event_id:
        body.event_id,
      created_at:
        body.created_at,
      data:
        charge,
    };

    if (
      existingPayments.length > 0
    ) {
      await db
        .update(payments)
        .set({
          provider:
            "lunium",
          method:
            "pix",
          status:
            "paid",
          rawPayload,
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
          orderId,
          provider:
            "lunium",
          externalId:
            charge.cashin_id,
          method:
            "pix",
          status:
            "paid",
          rawPayload,
        });
    }

    await db
      .update(orders)
      .set({
        status:
          "paid",
        fulfillmentStatus:
          "paid_to_prepare",
      })
      .where(
        eq(
          orders.id,
          orderId
        )
      );

    await confirmPartnerPaid(
      orderId,
      {
        provider:
          "lunium",
        providerPaymentId:
          charge.cashin_id,
        paidAt:
          new Date().toISOString(),
      }
    );

    console.log(
      "Pagamento Lunium confirmado via webhook:",
      {
        orderId,
        cashinId:
          charge.cashin_id,
        eventId:
          body.event_id ?? null,
        usdtAmount:
          charge.usdt_amount ??
          null,
        settlementTxHash:
          charge
            .settlement_tx_hash ??
          null,
      }
    );

    return NextResponse.json({
      received: true,
      processed: true,
      event:
        body.event,
      eventId:
        body.event_id ?? null,
    });
  } catch (error) {
    console.error(
      "Error processing Lunium webhook:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing error.",
      },
      {
        status: 500,
      }
    );
  }
}
