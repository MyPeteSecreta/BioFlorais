/**
 * BIO FLORAIS B2B — cartão via Mercado Pago (mesmo adapter do B2C).
 *
 * Diferenças em relação a /api/payments/mercadopago/card (B2C):
 * - token da oferta obrigatório e conferido contra orders.b2b_offer_id;
 * - trava: só pedidos precificados para cartão (orders.payment_method);
 * - até 3x com parcela mínima R$ 500,00;
 * - valor SEMPRE orders.total_cents; e-mail do pagador do cadastro.
 * A confirmação "paid" usa o finalizador compartilhado do B2C.
 */

import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createMercadoPagoCardAdapter } from "@angelblancdigital/payments";

import { db } from "@/lib/db/client";
import { customers, orders, payments } from "@/lib/db/schema";
import { verifyB2BOrderOfferToken } from "@/lib/b2b/public-offer-context";
import { isB2BInstallmentCountValid } from "@/lib/b2b/pricing";
import { finalizeMercadoPagoPaid } from "@/lib/payments/finalize-mercadopago-paid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CardRequest = {
  orderId?: string;
  b2bToken?: string;
  cardToken?: string;
  paymentMethodId?: string;
  installments?: number;
};

const BLOCKING_CARD_STATUSES = new Set(["paid", "authorized", "pending"]);

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as CardRequest;

    const orderId = body.orderId?.trim() ?? "";
    const cardToken = body.cardToken?.trim() ?? "";
    const paymentMethodId = body.paymentMethodId?.trim() ?? "";
    const installments = Number(body.installments);

    if (!orderId || !cardToken || !paymentMethodId) {
      return NextResponse.json({ error: "Dados do cartão incompletos." }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalCents: orders.totalCents,
        b2bOfferId: orders.b2bOfferId,
        paymentMethod: orders.paymentMethod,
        customerEmail: customers.email,
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

    if (order.paymentMethod !== "card") {
      return NextResponse.json(
        {
          error:
            "Este pedido foi precificado para outra forma de pagamento e não pode ser pago com cartão.",
        },
        { status: 409 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Este pedido não está mais elegível para pagamento." },
        { status: 409 }
      );
    }

    if (!Number.isInteger(order.totalCents) || order.totalCents <= 0) {
      return NextResponse.json({ error: "Valor do pedido inválido." }, { status: 409 });
    }

    if (!isB2BInstallmentCountValid(order.totalCents, installments)) {
      return NextResponse.json(
        {
          error:
            "Parcelamento inválido para este valor (parcela mínima R$ 500,00, máximo 3x).",
        },
        { status: 400 }
      );
    }

    if (!order.customerEmail) {
      return NextResponse.json({ error: "Pedido sem e-mail do comprador." }, { status: 409 });
    }

    // Nunca abre uma segunda cobrança enquanto outra está aprovada/em análise.
    const previous = await db
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.orderId, order.id));

    if (
      previous.some(
        (payment) => payment.status !== null && BLOCKING_CARD_STATUSES.has(payment.status)
      )
    ) {
      return NextResponse.json(
        { error: "Já existe um pagamento em processamento para este pedido." },
        { status: 409 }
      );
    }

    // O card token é de uso único: mesma chave para reenvio do mesmo
    // token (duplo clique/F5), chave nova para nova tentativa com outro cartão.
    const idempotencyKey = `bio-b2b-card-${order.id}-${createHash("sha256")
      .update(cardToken)
      .digest("hex")
      .slice(0, 32)}`;

    const adapter = createMercadoPagoCardAdapter({ accessToken });

    const result = await adapter.createPayment({
      orderId: order.id,
      amountCents: order.totalCents,
      payerEmail: order.customerEmail,
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
      rawPayload: {
        installments,
        paymentMethodId,
        amountCents: order.totalCents,
        b2b: true,
      },
    });

    if (result.status === "paid") {
      await finalizeMercadoPagoPaid({
        orderId: order.id,
        providerPaymentId: String(result.externalId),
        paidAt: new Date().toISOString(),
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
    console.error("[b2b/mercadopago/card]", error);

    return NextResponse.json(
      { error: "Não foi possível processar o cartão." },
      { status: 500 }
    );
  }
}
