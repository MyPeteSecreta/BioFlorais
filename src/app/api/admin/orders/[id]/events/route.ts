/**
 * ADMIN — andamento do pedido (Rodada 4): "Em separação", "Enviado"
 * (transportadora + rastreio + link) e "Entregue", com data, quem fez e
 * histórico (order_events, sql/b2b/23b). Atualiza orders.fulfillment_status
 * (e rastreio no "enviado"). Não mexe em pagamento. A data de "entregue" fica
 * gravada (útil depois para a Academia/UGC; o envio não foi implementado).
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS = ["separating", "shipped", "delivered"] as const;
type EventName = (typeof EVENTS)[number];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  try {
    const events = await getAppSqlRunner()(
      `SELECT event, carrier, tracking_code, tracking_url, note, created_by,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
         FROM order_events WHERE order_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] }); // SQL 23b ainda não aplicado
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const event = String(body.event ?? "") as EventName;

    if (!isUuid(id) || !EVENTS.includes(event)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const carrier = String(body.carrier ?? "").trim().slice(0, 80);
    const trackingCode = String(body.trackingCode ?? "").trim().slice(0, 80);
    const trackingUrl = String(body.trackingUrl ?? "").trim().slice(0, 300);
    const note = String(body.note ?? "").trim().slice(0, 300);

    const [order] = await db
      .select({ id: orders.id, status: orders.status, fulfillmentStatus: orders.fulfillmentStatus })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const paid = order.status === "paid" || order.status === "approved";

    if (!paid) return NextResponse.json({ error: "O pedido ainda não está pago." }, { status: 409 });

    if (order.fulfillmentStatus === "cancelled") {
      return NextResponse.json({ error: "Este pedido está cancelado." }, { status: 409 });
    }

    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      return NextResponse.json({ error: "O link de rastreio deve começar com http:// ou https://." }, { status: 400 });
    }

    if (event === "shipped" && (!carrier || !trackingCode)) {
      return NextResponse.json({ error: "Informe a transportadora e o código de rastreio." }, { status: 400 });
    }

    if (event === "delivered" && !["shipped", "delivered"].includes(order.fulfillmentStatus)) {
      return NextResponse.json({ error: "Marque como enviado antes de marcar como entregue." }, { status: 409 });
    }

    const patch: Record<string, unknown> = { fulfillmentStatus: event };

    if (event === "shipped") {
      patch.shippingServiceName = carrier;
      patch.trackingCode = trackingCode;
    }

    await db.update(orders).set(patch).where(eq(orders.id, id));

    try {
      await getAppSqlRunner()(
        `INSERT INTO order_events (order_id, event, carrier, tracking_code, tracking_url, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'admin')`,
        [id, event, carrier || null, trackingCode || null, trackingUrl || null, note || null]
      );
    } catch (error) {
      // SQL 23b ainda não aplicado: o status mudou, mas sem histórico.
      console.error("[admin/orders/events] sem order_events", error);
    }

    return NextResponse.json({ ok: true, fulfillmentStatus: event });
  } catch (error) {
    console.error("[admin/orders/events POST]", error);
    return NextResponse.json({ error: "Não foi possível registrar o andamento." }, { status: 500 });
  }
}
