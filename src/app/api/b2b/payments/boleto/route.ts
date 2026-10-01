/**
 * BIO FLORAIS B2B — solicitação de boleto.
 *
 * NÃO emite boleto real: registra uma solicitação pendente em
 * b2b_boleto_requests (+ linha em payments) para emissão manual.
 * - exige o token da oferta (orderId sozinho não autoriza);
 * - só pedidos "pending" precificados para boleto (trava por método);
 * - até 3x, parcela mínima R$ 500, composição exata em centavos;
 * - vencimentos 28/42/56 dias da data do pedido (São Paulo), gravados
 *   em b2b_boleto_requests.schedule com data e valor de cada parcela;
 * - idempotente pelo banco: índice único em b2b_boleto_requests.order_id
 *   e índice único parcial em payments(order_id) WHERE method='boleto'.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bBoletoRequests, customers, orders, payments } from "@/lib/db/schema";
import { verifyB2BOrderOfferToken } from "@/lib/b2b/public-offer-context";
import {
  buildB2BBoletoSchedule,
  isB2BInstallmentCountValid,
  splitB2BInstallments,
} from "@/lib/b2b/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoletoBody = {
  orderId?: string;
  b2bToken?: string;
  installments?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as BoletoBody;
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
        createdAt: orders.createdAt,
        personType: customers.personType,
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

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Este pedido não está mais elegível para solicitação de boleto." },
        { status: 409 }
      );
    }

    if (order.paymentMethod !== "boleto") {
      return NextResponse.json(
        {
          error:
            "Este pedido foi precificado para outra forma de pagamento e não pode ser pago por boleto.",
        },
        { status: 409 }
      );
    }

    // Regra B2B: pessoa física paga só com Pix ou cartão.
    if (order.personType !== "pj") {
      return NextResponse.json(
        { error: "Boleto disponível apenas para pessoa jurídica." },
        { status: 409 }
      );
    }

    const installments = Number(body.installments ?? 1);

    if (!isB2BInstallmentCountValid(order.totalCents, installments)) {
      return NextResponse.json(
        {
          error:
            "Número de parcelas inválido para este valor (parcela mínima R$ 500,00, máximo 3x).",
        },
        { status: 400 }
      );
    }

    const { installmentAmountCents, lastInstallmentAmountCents } =
      splitB2BInstallments(order.totalCents, installments);

    // Vencimentos 28/42/56 dias da DATA DO PEDIDO (calendário de São Paulo).
    const schedule = buildB2BBoletoSchedule(
      order.totalCents,
      installments,
      order.createdAt ?? new Date()
    );

    // Uma instrução por tabela; xmax = 0 indica linha recém-inserida.
    const [boleto] = await db
      .insert(b2bBoletoRequests)
      .values({
        orderId: order.id,
        amountCents: order.totalCents,
        installments,
        installmentAmountCents,
        lastInstallmentAmountCents,
        schedule,
        status: "pending_request",
      })
      .onConflictDoUpdate({
        target: b2bBoletoRequests.orderId,
        set: {
          amountCents: order.totalCents,
          installments,
          installmentAmountCents,
          lastInstallmentAmountCents,
          schedule,
        },
        setWhere: sql`${b2bBoletoRequests.status} = 'pending_request'`,
      })
      .returning({
        id: b2bBoletoRequests.id,
        installments: b2bBoletoRequests.installments,
        installmentAmountCents: b2bBoletoRequests.installmentAmountCents,
        lastInstallmentAmountCents: b2bBoletoRequests.lastInstallmentAmountCents,
        schedule: b2bBoletoRequests.schedule,
        wasInserted: sql<boolean>`(xmax = 0)`,
      });

    const [existingPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.method, "boleto")))
      .limit(1);

    if (!existingPayment) {
      await db
        .insert(payments)
        .values({
          orderId: order.id,
          provider: "boleto-manual",
          method: "boleto",
          status: "pending_request",
          rawPayload: {
            installments,
            installmentAmountCents,
            lastInstallmentAmountCents,
            amountCents: order.totalCents,
            schedule,
          },
        })
        .onConflictDoNothing();
    }

    // Se a operação já mudou o status da solicitação, o UPDATE não
    // ocorre e nada volta; o registro existente é preservado.
    const current =
      boleto ??
      (
        await db
          .select({
            id: b2bBoletoRequests.id,
            installments: b2bBoletoRequests.installments,
            installmentAmountCents: b2bBoletoRequests.installmentAmountCents,
            lastInstallmentAmountCents: b2bBoletoRequests.lastInstallmentAmountCents,
            schedule: b2bBoletoRequests.schedule,
          })
          .from(b2bBoletoRequests)
          .where(eq(b2bBoletoRequests.orderId, order.id))
          .limit(1)
      )[0];

    const repeated = !boleto?.wasInserted;

    return NextResponse.json({
      success: true,
      repeated,
      boleto: current
        ? {
            installments: current.installments,
            installmentAmountCents: current.installmentAmountCents,
            lastInstallmentAmountCents: current.lastInstallmentAmountCents,
            totalCents: order.totalCents,
            schedule: current.schedule ?? [],
          }
        : null,
      message: repeated
        ? "A solicitação de boleto deste pedido já estava registrada."
        : "Solicitação de boleto registrada. Nossa equipe enviará o boleto para o e-mail informado.",
    });
  } catch (error) {
    console.error("[b2b/payments/boleto]", error);

    return NextResponse.json(
      { error: "Não foi possível registrar a solicitação de boleto." },
      { status: 500 }
    );
  }
}
