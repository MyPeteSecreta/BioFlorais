import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/client";
import {
  addresses,
  customers,
  orderItems,
  orders,
  payments,
  products,
} from "@/lib/db/schema";

import FulfillmentControls from "@/components/admin/FulfillmentControls";
import ShippingControls from "@/components/admin/ShippingControls";

export const dynamic = "force-dynamic";

function formatMoney(cents: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

function formatDate(value: Date | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function paymentLabel(method: string | null) {
  if (method === "pix") return "Pix";
  if (method === "credit_card") return "Cartão";
  return method ?? "—";
}

function orderStatusLabel(status: string) {
  switch (status) {
    case "paid":
    case "approved":
      return "Pago";
    case "cancelled":
    case "canceled":
      return "Cancelado";
    case "pending":
      return "Aguardando pagamento";
    default:
      return status;
  }
}

function fulfillmentLabel(status: string) {
  switch (status) {
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "paid_to_prepare":
      return "A preparar";
    case "separating":
      return "Em separação";
    case "ready_to_ship":
      return "Pronto para envio";
    case "shipped":
      return "Enviado";
    case "completed":
      return "Concluído";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    notFound();
  }

  const [
    customerRows,
    addressRows,
    paymentRows,
    itemRows,
  ] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(eq(customers.id, order.customerId))
      .limit(1),

    db
      .select()
      .from(addresses)
      .where(eq(addresses.id, order.shippingAddressId))
      .limit(1),

    db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id)),

    db
      .select({
        id: orderItems.id,
        qty: orderItems.qty,
        unitPriceCents: orderItems.unitPriceCents,
        productName: products.name,
        productSlug: products.slug,
        productLineSlug: products.lineSlug,
        category: products.category,
      })
      .from(orderItems)
      .leftJoin(
        products,
        eq(orderItems.productId, products.id)
      )
      .where(eq(orderItems.orderId, order.id)),
  ]);

  const customer = customerRows[0];
  const address = addressRows[0];
  const payment = paymentRows[0];

  const paymentApproved =
    order.status === "paid" ||
    order.status === "approved";

  return (
    <main className="min-h-screen bg-[#faf8f3] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <Link
          href="/admin/pedidos"
          className="text-sm font-bold text-amber-800 hover:underline"
        >
          ← Voltar aos pedidos
        </Link>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-800">
              Pedido
            </span>

            <h1 className="mt-2 break-all font-mono text-xl font-bold text-stone-900 md:text-2xl">
              {order.id}
            </h1>

            <p className="mt-2 text-sm text-stone-500">
              {formatDate(order.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="w-fit rounded-full bg-amber-100 px-5 py-2.5 text-sm font-extrabold text-amber-900">
              {orderStatusLabel(order.status)}
            </span>

            <span className="w-fit rounded-full bg-emerald-100 px-5 py-2.5 text-sm font-extrabold text-emerald-900">
              {fulfillmentLabel(order.fulfillmentStatus)}
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-stone-900">
              Cliente e entrega
            </h2>

            <div className="mt-5 space-y-1 text-sm text-stone-600">
              <p className="font-bold text-stone-900">
                {customer?.name ?? "Nome não informado"}
              </p>

              <p>{customer?.email ?? "—"}</p>
              <p>{customer?.phone ?? "—"}</p>

              {customer?.cpf && (
                <p>CPF: {customer.cpf}</p>
              )}
            </div>

            {address && (
              <div className="mt-6 border-t border-stone-200 pt-5">
                <p className="font-bold text-stone-900">
                  Endereço
                </p>

                <div className="mt-2 text-sm leading-relaxed text-stone-600">
                  <p>
                    {address.street}, {address.number}
                    {address.complement
                      ? ` — ${address.complement}`
                      : ""}
                  </p>

                  <p>{address.district}</p>

                  <p>
                    {address.city} / {address.state}
                  </p>

                  <p>CEP {address.cep}</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-stone-900">
              Pagamento
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">
                  Forma
                </span>
                <strong>
                  {paymentLabel(payment?.method ?? null)}
                </strong>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-stone-500">
                  Status
                </span>
                <strong>
                  {payment?.status ?? "—"}
                </strong>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-stone-500">
                  ID do pagamento
                </span>

                <span className="max-w-[60%] break-all text-right font-mono text-xs">
                  {payment?.externalId ?? "—"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-stone-900">
              Produtos
            </h2>

            <div className="mt-5 space-y-3">
              {itemRows.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#faf8f3] p-4"
                >
                  <p className="font-bold text-stone-900">
                    {item.category
                      ? `${item.category} — ${item.productName ?? "Produto"}`
                      : item.productName ?? "Produto"}
                  </p>

                  {item.productLineSlug && (
                    <p className="mt-1 text-xs text-stone-500">
                      Linha: {item.productLineSlug}
                    </p>
                  )}


                  <div className="mt-2 flex justify-between gap-4 text-sm text-stone-600">
                    <span>
                      {item.qty} ×{" "}
                      {formatMoney(item.unitPriceCents)}
                    </span>

                    <strong className="text-stone-900">
                      {formatMoney(
                        item.qty * item.unitPriceCents
                      )}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-stone-900">
              Expedição
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <div>
                <p className="text-stone-500">
                  Transportadora / serviço
                </p>
                <p className="mt-1 font-bold text-stone-900">
                  {order.shippingServiceName ??
                    "Ainda não informado"}
                </p>
              </div>

              <div>
                <p className="text-stone-500">
                  Código de rastreio
                </p>
                <p className="mt-1 break-all font-mono font-bold text-amber-800">
                  {order.trackingCode ??
                    "Ainda não disponível"}
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-stone-900">
            Resumo financeiro
          </h2>

          <div className="mt-5 ml-auto max-w-md space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">
                Mercadorias
              </span>
              <span>{formatMoney(order.subtotalCents)}</span>
            </div>

            {order.offerDiscountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">
                  Ofertas / combos
                </span>
                <span>
                  - {formatMoney(order.offerDiscountCents)}
                </span>
              </div>
            )}

            {order.promotionDiscountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">
                  Promoções
                </span>
                <span>
                  - {formatMoney(order.promotionDiscountCents)}
                </span>
              </div>
            )}

            {order.couponDiscountCents > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">
                  Cupom comercial
                  {order.couponCode
                    ? ` · ${order.couponCode}`
                    : ""}
                </span>
                <span>
                  - {formatMoney(order.couponDiscountCents)}
                </span>
              </div>
            )}

            {order.partnerCouponDiscountCents > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">
                  Cupom UGC
                  {order.partnerCouponCode
                    ? ` · ${order.partnerCouponCode}`
                    : ""}
                </span>
                <span>
                  - {formatMoney(
                    order.partnerCouponDiscountCents
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-stone-500">
                Frete
              </span>
              <span>
                {formatMoney(order.shippingCents)}
              </span>
            </div>

            <div className="flex justify-between border-t border-stone-200 pt-4 text-lg font-extrabold text-stone-900">
              <span>Total</span>
              <span>{formatMoney(order.totalCents)}</span>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-dashed border-stone-300 bg-white p-6">
          <p className="font-extrabold text-stone-900">
            Ações do pedido
          </p>

          <p className="mt-2 text-sm text-stone-600">
            Separe, confira e acompanhe o processamento deste pedido.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/admin/pedidos/${order.id}/imprimir`}
              target="_blank"
              className="rounded-full bg-amber-800 px-6 py-3 text-sm font-extrabold text-white"
            >
              Imprimir separação
            </Link>
          </div>

          <FulfillmentControls
            orderId={order.id}
            currentStatus={order.fulfillmentStatus}
            paymentApproved={paymentApproved}
          />

          <ShippingControls
            orderId={order.id}
            initialServiceName={
              order.shippingServiceName ?? ""
            }
            initialTrackingCode={
              order.trackingCode ?? ""
            }
            fulfillmentStatus={
              order.fulfillmentStatus
            }
          />
        </section>
      </div>
    </main>
  );
}
