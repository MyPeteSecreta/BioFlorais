import { createHmac, timingSafeEqual } from "crypto";

import { createMercadoPagoCardAdapter } from "@angelblancdigital/payments";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { finalizeMercadoPagoPaid } from "@/lib/payments/finalize-mercadopago-paid";
import {
  orders,
  payments,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  live_mode?: boolean;
  data?: {
    id?: string | number;
  };
};

/*
 * BIO_MP_ORDER_WEBHOOK_V1
 *
 * IMPORTANTE:
 * - este webhook NUNCA cria cobranÃ§a;
 * - ele somente reconcilia uma Order Mercado Pago jÃ¡ existente;
 * - a origem Ã© validada por HMAC SHA-256;
 * - a verdade final do pagamento vem da consulta autenticada
 *   Ã  API do Mercado Pago, nunca do body recebido.
 */

function parseSignature(
  value: string
): {
  ts: string;
  v1: string;
} | null {
  const parts =
    value.split(",");

  let ts = "";
  let v1 = "";

  for (const part of parts) {
    const separator =
      part.indexOf("=");

    if (separator < 0) {
      continue;
    }

    const key =
      part.slice(0, separator).trim();

    const val =
      part.slice(separator + 1).trim();

    if (key === "ts") {
      ts = val;
    }

    if (key === "v1") {
      v1 = val;
    }
  }

  if (!ts || !v1) {
    return null;
  }

  return {
    ts,
    v1,
  };
}

function secureHexEqual(
  expected: string,
  received: string
): boolean {
  try {
    const expectedBuffer =
      Buffer.from(expected, "hex");

    const receivedBuffer =
      Buffer.from(received, "hex");

    if (
      expectedBuffer.length === 0 ||
      expectedBuffer.length !==
        receivedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    );
  } catch {
    return false;
  }
}

function validateMercadoPagoSignature(input: {
  signature: string;
  requestId: string;
  dataId: string;
  secret: string;
}): boolean {
  const parsed =
    parseSignature(input.signature);

  if (!parsed) {
    return false;
  }

  /*
   * Mercado Pago orienta usar data.id em lowercase
   * para validaÃ§Ã£o quando o identificador for
   * alfanumÃ©rico, como ORD...
   */
  const normalizedDataId =
    input.dataId.toLowerCase();

  const manifest =
    `id:${normalizedDataId};` +
    `request-id:${input.requestId};` +
    `ts:${parsed.ts};`;

  const expected =
    createHmac(
      "sha256",
      input.secret
    )
      .update(manifest)
      .digest("hex");

  return secureHexEqual(
    expected,
    parsed.v1
  );
}

export async function POST(
  request: Request
) {
  try {
    const accessToken =
      process.env
        .MERCADOPAGO_ACCESS_TOKEN
        ?.trim();

    const webhookSecret =
      process.env
        .MERCADOPAGO_WEBHOOK_SECRET
        ?.trim();

    if (
      !accessToken ||
      !webhookSecret
    ) {
      console.error(
        "[mercadopago/webhook] configuracao incompleta"
      );

      return NextResponse.json(
        {
          error:
            "Webhook Mercado Pago nÃ£o configurado.",
        },
        {
          status: 503,
        }
      );
    }

    const url =
      new URL(request.url);

    const queryDataId =
      url.searchParams
        .get("data.id")
        ?.trim() ||
      url.searchParams
        .get("data_id")
        ?.trim() ||
      "";

    const queryType =
      url.searchParams
        .get("type")
        ?.trim()
        .toLowerCase() ||
      "";

    const xSignature =
      request.headers
        .get("x-signature")
        ?.trim() ||
      "";

    const xRequestId =
      request.headers
        .get("x-request-id")
        ?.trim() ||
      "";

    if (
      !queryDataId ||
      !xSignature ||
      !xRequestId
    ) {
      return NextResponse.json(
        {
          error:
            "NotificaÃ§Ã£o Mercado Pago incompleta.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !validateMercadoPagoSignature({
        signature: xSignature,
        requestId: xRequestId,
        dataId: queryDataId,
        secret: webhookSecret,
      })
    ) {
      console.error(
        "[mercadopago/webhook] assinatura invalida",
        {
          requestId: xRequestId,
          type: queryType || null,
        }
      );

      return NextResponse.json(
        {
          error:
            "Assinatura invÃ¡lida.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | MercadoPagoWebhookBody
        | null;

    const bodyType =
      body?.type
        ?.trim()
        .toLowerCase() ||
      "";

    const notificationType =
      queryType ||
      bodyType;

    /*
     * Nossa integraÃ§Ã£o usa Orders API.
     * Eventos de outros tÃ³picos sÃ£o reconhecidos
     * mas nÃ£o alteram pedido.
     */
    if (
      notificationType &&
      notificationType !== "order"
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason:
          "unsupported_notification_type",
      });
    }

    const externalId =
      queryDataId;

    /*
     * O webhook sÃ³ pode atuar sobre uma cobranÃ§a
     * Mercado Pago que jÃ¡ pertenÃ§a ao Bio.
     *
     * NÃ£o cria payment a partir de payload externo.
     */
    const [localPayment] =
      await db
        .select({
          id: payments.id,
          orderId:
            payments.orderId,
          status:
            payments.status,
          externalId:
            payments.externalId,
        })
        .from(payments)
        .where(
          eq(
            payments.externalId,
            externalId
          )
        )
        .limit(1);

    if (
      !localPayment ||
      !localPayment.orderId
    ) {
      /*
       * Pode ocorrer se a notificaÃ§Ã£o chegar
       * antes de a resposta sÃ­ncrona terminar
       * de persistir o payment.
       *
       * Retornamos sucesso para nÃ£o transformar
       * recurso desconhecido em mutaÃ§Ã£o indevida.
       * A rota de status continua sendo fallback.
       */
      console.warn(
        "[mercadopago/webhook] order externa ainda sem payment local",
        {
          externalId,
          requestId: xRequestId,
        }
      );

      return NextResponse.json({
        ok: true,
        reconciled: false,
        reason:
          "local_payment_not_found",
      });
    }

    const [localOrder] =
      await db
        .select({
          id: orders.id,
          status:
            orders.status,
        })
        .from(orders)
        .where(
          eq(
            orders.id,
            localPayment.orderId
          )
        )
        .limit(1);

    if (!localOrder) {
      return NextResponse.json(
        {
          error:
            "Pedido local nÃ£o encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * O body do webhook NÃƒO decide se estÃ¡ pago.
     * Consultamos a Order autenticada no MP.
     */
    const mercadoPago =
      createMercadoPagoCardAdapter({
        accessToken,
      });

    const remote =
      await mercadoPago
        .getPaymentStatus({
          externalId,
        });

    if (
      remote.status !== "paid"
    ) {
      /*
       * Atualizamos apenas o payment local.
       * Pedido nÃ£o Ã© promovido sem confirmaÃ§Ã£o
       * remota de paid.
       */
      if (
        localPayment.status !==
          remote.status
      ) {
        await db
          .update(payments)
          .set({
            status:
              remote.status,
          })
          .where(
            eq(
              payments.id,
              localPayment.id
            )
          );
      }

      return NextResponse.json({
        ok: true,
        reconciled: true,
        paid: false,
        status:
          remote.status,
      });
    }

    /*
     * A partir daqui a API autenticada do MP
     * confirmou PAID.
     *
     * OperaÃ§Ãµes abaixo sÃ£o convergentes:
     * - payment -> paid
     * - order -> paid / paid_to_prepare
     * - Partner usa eventId idempotente
     */

    if (
      localPayment.status !== "paid"
    ) {
      await db
        .update(payments)
        .set({
          status: "paid",
        })
        .where(
          eq(
            payments.id,
            localPayment.id
          )
        );
    }

    // BIO_MP_SHARED_PAID_FINALIZER_WEBHOOK_V1
    await finalizeMercadoPagoPaid({
      orderId: localOrder.id,
      providerPaymentId:
        externalId,
      paidAt:
        new Date().toISOString(),
    });
    console.log(
      "[mercadopago/webhook] pagamento reconciliado",
      {
        orderId:
          localOrder.id,
        externalId,
        requestId:
          xRequestId,
      }
    );

    return NextResponse.json({
      ok: true,
      reconciled: true,
      paid: true,
      orderId:
        localOrder.id,
    });
  } catch (error) {
    console.error(
      "[mercadopago/webhook] erro",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro ao processar webhook Mercado Pago.",
      },
      {
        status: 500,
      }
    );
  }
}