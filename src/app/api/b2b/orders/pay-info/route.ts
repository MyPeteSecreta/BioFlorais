/**
 * BIO FLORAIS B2B — dados mínimos do pedido para a página do LINK DE PAGAMENTO no cartão
 * (/b2b/pagar): o vendedor nunca digita o cartão do cliente, ele envia este link e o cliente paga
 * no próprio celular. Autorização = o MESMO token da oferta do cliente, conferido contra o pedido.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";
import { verifyB2BOrderOfferToken } from "@/lib/b2b/public-offer-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const orderId = String(request.nextUrl.searchParams.get("pedido") ?? "").trim();
    const token = String(request.nextUrl.searchParams.get("b2b") ?? "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalCents: orders.totalCents,
        b2bOfferId: orders.b2bOfferId,
        paymentMethod: orders.paymentMethod,
        email: customers.email,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const check = await verifyB2BOrderOfferToken(order.b2bOfferId, token);

    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        number: order.id.slice(0, 8).toUpperCase(),
        status: order.status,
        paid: order.status === "paid" || order.status === "approved",
        totalCents: order.totalCents,
        paymentMethod: order.paymentMethod,
        payerEmail: order.email ?? "",
      },
    });
  } catch (error) {
    console.error("[b2b/orders/pay-info]", error);
    return NextResponse.json({ error: "Não foi possível carregar o pedido." }, { status: 500 });
  }
}
