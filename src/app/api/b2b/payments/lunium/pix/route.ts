/**
 * BIO FLORAIS B2B — Pix EXCLUSIVAMENTE via Lunium.
 *
 * Mesma API/variáveis da rota B2C (/api/payments/lunium/pix), com:
 * - token da oferta obrigatório e conferido contra orders.b2b_offer_id;
 * - trava: só pedidos precificados para Pix (orders.payment_method);
 * - valor SEMPRE orders.total_cents (nunca do navegador);
 * - reaproveita a cobrança já criada para o pedido (sem duplicar).
 * A confirmação vem do webhook /api/webhooks/lunium e do polling de
 * /api/orders/[orderId]/status, que para pedido B2B só marcam pago se o
 * valor recebido for igual a orders.total_cents.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { customers, orders, payments } from "@/lib/db/schema";
import { verifyB2BOrderOfferToken } from "@/lib/b2b/public-offer-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LUNIUM_API_URL = "https://api.luniumpay.com";

type RequestBody = {
  orderId?: string;
  b2bToken?: string;
};

type LuniumCreateResponse = {
  cashin_id?: string;
  status?: string;
  amount_cents?: number;
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

function pixResponse(input: {
  reused: boolean;
  cashinId: string;
  status: string;
  expiresAt: string | null;
  qrCode: string;
  qrImageUrl: string | null;
  totalCents: number;
}) {
  return NextResponse.json({
    success: true,
    reused: input.reused,
    provider: "lunium",
    paymentId: input.cashinId,
    status: input.status,
    expiresAt: input.expiresAt,
    totalCents: input.totalCents,
    pix: {
      qrCode: input.qrCode,
      qrImageUrl: input.qrImageUrl,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LUNIUM_API_KEY?.trim();
    const settlementAddress = process.env.LUNIUM_SETTLEMENT_ADDRESS?.trim();

    if (!apiKey || !settlementAddress) {
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
        orderId: orders.id,
        totalCents: orders.totalCents,
        status: orders.status,
        b2bOfferId: orders.b2bOfferId,
        paymentMethod: orders.paymentMethod,
        customerName: customers.name,
        personType: customers.personType,
        cpf: customers.cpf,
        cnpj: customers.cnpj,
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

    // Reaproveita a cobrança Lunium existente do MESMO valor.
    const existing = await db
      .select({
        externalId: payments.externalId,
        status: payments.status,
        rawPayload: payments.rawPayload,
      })
      .from(payments)
      .where(eq(payments.orderId, order.orderId));

    for (const payment of existing) {
      const raw = payment.rawPayload as LuniumCreateResponse | null;

      if (
        payment.externalId &&
        raw?.qr_copypaste &&
        raw.amount_cents === order.totalCents
      ) {
        return pixResponse({
          reused: true,
          cashinId: payment.externalId,
          status: payment.status ?? raw.status ?? "pending",
          expiresAt: raw.expires_at ?? null,
          qrCode: raw.qr_copypaste,
          qrImageUrl: raw.qr_image_url ?? null,
          totalCents: order.totalCents,
        });
      }
    }

    const payerDocument =
      order.personType === "pj" ? onlyDigits(order.cnpj) : onlyDigits(order.cpf);

    if (payerDocument.length !== 11 && payerDocument.length !== 14) {
      return NextResponse.json(
        { error: "CPF ou CNPJ do pagador inválido." },
        { status: 400 }
      );
    }

    const luniumResponse = await fetch(`${LUNIUM_API_URL}/cashin/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        amount_cents: order.totalCents,
        payer_tax_number: payerDocument,
        payer_name: order.customerName ?? undefined,
        payout_address: settlementAddress,
        external_id: order.orderId,
        asset: "usdt",
        chain: "polygon",
      }),
      cache: "no-store",
    });

    const data = (await luniumResponse.json().catch(() => null)) as
      | LuniumCreateResponse
      | null;

    if (!luniumResponse.ok) {
      console.error("[b2b/lunium/pix] cash-in error", {
        status: luniumResponse.status,
        code: data?.erro ?? null,
        requestId: data?.request_id ?? null,
      });

      const payerRejected = data?.erro === "pagador_recusado_pelo_provedor";

      return NextResponse.json(
        {
          error: payerRejected
            ? "Não foi possível gerar o Pix com este CPF/CNPJ. Confira os dados informados."
            : "Não foi possível gerar o Pix neste momento.",
          code: data?.erro ?? null,
        },
        { status: luniumResponse.status >= 500 ? 502 : luniumResponse.status }
      );
    }

    if (!data?.cashin_id || !data.qr_copypaste) {
      console.error("[b2b/lunium/pix] resposta incompleta");

      return NextResponse.json(
        { error: "Lunium retornou uma resposta incompleta." },
        { status: 502 }
      );
    }

    await db.insert(payments).values({
      orderId: order.orderId,
      provider: "lunium",
      externalId: data.cashin_id,
      method: "pix",
      status: data.status ?? "pending",
      rawPayload: { ...data, amount_cents: data.amount_cents ?? order.totalCents },
    });

    return pixResponse({
      reused: false,
      cashinId: data.cashin_id,
      status: data.status ?? "pending",
      expiresAt: data.expires_at ?? null,
      qrCode: data.qr_copypaste,
      qrImageUrl: data.qr_image_url ?? null,
      totalCents: order.totalCents,
    });
  } catch (error) {
    console.error("[b2b/lunium/pix]", error);

    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento Pix." },
      { status: 500 }
    );
  }
}
