import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

const ALLOWED_STATUSES = [
  "awaiting_payment",
  "paid_to_prepare",
  "separating",
  "ready_to_ship",
  "cancelled",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const status = String(body?.status ?? "");

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Status inválido." },
        { status: 400 }
      );
    }

    const [order] = await db
      .select({
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
      order.fulfillmentStatus === "shipped" ||
      order.fulfillmentStatus === "completed"
    ) {
      return NextResponse.json(
        { error: "Pedido enviado ou concluído não pode voltar de etapa." },
        { status: 409 }
      );
    }

    const paymentApproved =
      order.status === "paid" ||
      order.status === "approved";

    if (!paymentApproved && status !== "cancelled") {
      return NextResponse.json(
        { error: "Pedido ainda não está pago." },
        { status: 409 }
      );
    }

    await db
      .update(orders)
      .set({ fulfillmentStatus: status })
      .where(eq(orders.id, id));

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Erro ao atualizar status operacional:", error);

    return NextResponse.json(
      { error: "Não foi possível atualizar o pedido." },
      { status: 500 }
    );
  }
}
