import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const serviceName = String(body?.serviceName ?? "").trim();
    const trackingCode = String(body?.trackingCode ?? "").trim();
    const markAsShipped = body?.markAsShipped === true;

    if (!serviceName) {
      return NextResponse.json(
        { error: "Informe a transportadora ou serviço." },
        { status: 400 }
      );
    }

    if (markAsShipped && !trackingCode) {
      return NextResponse.json(
        { error: "Informe o código de rastreio antes de confirmar o envio." },
        { status: 400 }
      );
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        fulfillmentStatus: orders.fulfillmentStatus,
      })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: "Pedido não encontrado." },
        { status: 404 }
      );
    }

    if (
      markAsShipped &&
      order.status !== "paid" &&
      order.status !== "approved"
    ) {
      return NextResponse.json(
        { error: "Pedido ainda não está pago." },
        { status: 409 }
      );
    }

    await db
      .update(orders)
      .set({
        shippingServiceName: serviceName,
        trackingCode: trackingCode || null,
        ...(markAsShipped
          ? { fulfillmentStatus: "shipped" }
          : {}),
      })
      .where(eq(orders.id, id));

    return NextResponse.json({
      success: true,
      markedAsShipped: markAsShipped,
      fulfillmentStatus: markAsShipped
        ? "shipped"
        : order.fulfillmentStatus,
    });
  } catch (error) {
    console.error("Erro ao atualizar expedição:", error);

    return NextResponse.json(
      { error: "Não foi possível atualizar a expedição." },
      { status: 500 }
    );
  }
}
