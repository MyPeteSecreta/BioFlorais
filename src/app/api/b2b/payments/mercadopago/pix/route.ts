/**
 * BIO FLORAIS B2B — Pix via Mercado Pago (Order API).
 *
 * Usado enquanto NEXT_PUBLIC_PIX_PROVIDER !== "lunium" (mesma chave do
 * checkout B2C). Mesmo padrão da rota B2C /api/payments/mercadopago/pix,
 * com as travas B2B:
 * - token da oferta obrigatório e conferido contra orders.b2b_offer_id;
 * - só pedidos "pending" precificados para Pix (payment_method = "pix");
 * - valor SEMPRE orders.total_cents (já com o desconto Pix de 7%);
 * - reaproveita o Pix Mercado Pago ainda válido do mesmo valor.
 * A confirmação vem do webhook /api/webhooks/mercadopago (por externalId),
 * do polling de /api/orders/[orderId]/status e do cron
 * /api/cron/reconcile-mp-pix — todos usam finalizeMercadoPagoPaid.
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { customers, orders, payments } from "@/lib/db/schema";
import { verifyB2BOrderOfferToken } from "@/lib/b2b/public-offer-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PIX_TTL_MINUTES = 30;
// Reaproveita só se ainda restar folga razoável para o comprador pagar.
const PIX_REUSE_MAX_AGE_MS = (PIX_TTL_MINUTES - 5) * 60 * 1000;

type RequestBody = {
  orderId?: string;
  b2bToken?: string;
};

type MercadoPagoOrderResponse = {
  id?: string;
  status?: string;
  total_amount?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      payment_method?: {
        qr_code?: string;
        qr_code_base64?: string;
      };
    }>;
  };
};

function centsToAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

function pixFromOrder(data: MercadoPagoOrderResponse | null) {
  const method = data?.transactions?.payments?.[0]?.payment_method;

  return {
    qrCode: method?.qr_code ?? null,
    qrImageUrl: method?.qr_code_base64
      ? `data:image/png;base64,${method.qr_code_base64}`
      : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Pix temporariamente indisponível." },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const orderId = body.orderId?.trim() ?? "";

    if (!orderId) {
      return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalCents: orders.totalCents,
        b2bOfferId: orders.b2bOfferId,
        paymentMethod: orders.paymentMethod,
        customerEmail: customers.email,
        customerName: customers.name,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const tokenCheck = await verifyB2BOrderOfferToken(order.b2bOfferId, body.b2bToken);

    if (!tokenCheck.ok) {
      return NextResponse.json({ error: tokenCheck.error }, { status: tokenCheck.status });
    }

    if (order.paymentMethod !== "pix") {
      return NextResponse.json(
        {
          error:
            "Este pedido foi precificado para outra forma de pagamento e não pode ser pago via Pix.",
        },
        { status: 409 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json({ error: "Este pedido já está pago." }, { status: 409 });
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Este pedido não está mais elegível para pagamento." },
        { status: 409 }
      );
    }

    if (!Number.isInteger(order.totalCents) || order.totalCents <= 0) {
      return NextResponse.json({ error: "Pedido possui valor inválido." }, { status: 400 });
    }

    if (!order.customerEmail) {
      return NextResponse.json({ error: "Pedido sem e-mail do comprador." }, { status: 400 });
    }

    // Reaproveita o Pix Mercado Pago ainda válido deste pedido (mesmo valor).
    const existing = await db
      .select({
        externalId: payments.externalId,
        status: payments.status,
        rawPayload: payments.rawPayload,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.orderId, order.id),
          eq(payments.provider, "mercadopago"),
          eq(payments.method, "pix")
        )
      );

    const reusable = existing
      .filter(
        (payment) =>
          payment.externalId &&
          payment.createdAt &&
          Date.now() - payment.createdAt.getTime() < PIX_REUSE_MAX_AGE_MS &&
          !["failed", "cancelled", "canceled", "expired", "rejected"].includes(
            payment.status ?? ""
          )
      )
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
      .find((payment) => {
        const raw = payment.rawPayload as MercadoPagoOrderResponse | null;
        return (
          raw?.total_amount === centsToAmount(order.totalCents) &&
          Boolean(pixFromOrder(raw).qrCode)
        );
      });

    if (reusable) {
      const pix = pixFromOrder(reusable.rawPayload as MercadoPagoOrderResponse);

      return NextResponse.json({
        success: true,
        reused: true,
        provider: "mercadopago",
        paymentId: reusable.externalId,
        status: reusable.status ?? "pending",
        expiresAt: new Date(
          reusable.createdAt!.getTime() + PIX_TTL_MINUTES * 60 * 1000
        ).toISOString(),
        totalCents: order.totalCents,
        pix,
      });
    }

    const firstName = order.customerName?.trim().split(/\s+/)[0] || "Cliente";

    const response = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        type: "online",
        external_reference: order.id,
        total_amount: centsToAmount(order.totalCents),
        processing_mode: "automatic",
        transactions: {
          payments: [
            {
              amount: centsToAmount(order.totalCents),
              payment_method: { id: "pix", type: "bank_transfer" },
              expiration_time: `PT${PIX_TTL_MINUTES}M`,
            },
          ],
        },
        payer: { email: order.customerEmail.trim(), first_name: firstName },
      }),
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as MercadoPagoOrderResponse | null;

    if (!response.ok) {
      console.error("[b2b/mercadopago/pix] erro ao criar Pix", {
        status: response.status,
      });

      return NextResponse.json(
        { error: "Não foi possível gerar o Pix neste momento." },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const pix = pixFromOrder(data);

    if (!data?.id || !pix.qrCode) {
      console.error("[b2b/mercadopago/pix] resposta incompleta");

      return NextResponse.json(
        { error: "Mercado Pago retornou uma resposta incompleta ao gerar o Pix." },
        { status: 502 }
      );
    }

    const status = data.transactions?.payments?.[0]?.status ?? data.status ?? "pending";

    await db.insert(payments).values({
      orderId: order.id,
      provider: "mercadopago",
      externalId: data.id,
      method: "pix",
      status,
      rawPayload: data,
    });

    return NextResponse.json({
      success: true,
      reused: false,
      provider: "mercadopago",
      paymentId: data.id,
      status,
      expiresAt: new Date(Date.now() + PIX_TTL_MINUTES * 60 * 1000).toISOString(),
      totalCents: order.totalCents,
      pix,
    });
  } catch (error) {
    console.error("[b2b/mercadopago/pix]", error);

    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento Pix." },
      { status: 500 }
    );
  }
}
