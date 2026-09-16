import Link from "next/link";
import OrderBatchSelection from "@/components/admin/OrderBatchSelection";
import { desc, eq, ne} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  addresses,
  customers,
  orders,
} from "@/lib/db/schema";

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

function orderStatusLabel(status: string) {
  switch (status) {
    case "paid":
    case "approved":
      return "Pago";

    case "pending":
      return "Aguardando pagamento";

    case "cancelled":
    case "canceled":
      return "Cancelado";

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

export default async function AdminOrdersPage() {
  const orderRows = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,

      status: orders.status,
      fulfillmentStatus:
        orders.fulfillmentStatus,

      subtotalCents:
        orders.subtotalCents,
      discountCents:
        orders.discountCents,
      shippingCents:
        orders.shippingCents,
      totalCents:
        orders.totalCents,

      couponCode:
        orders.couponCode,
      couponDiscountCents:
        orders.couponDiscountCents,

      partnerCouponCode:
        orders.partnerCouponCode,
      partnerCouponDiscountCents:
        orders.partnerCouponDiscountCents,

      shippingServiceName:
        orders.shippingServiceName,
      trackingCode:
        orders.trackingCode,

      customerName:
        customers.name,
      customerEmail:
        customers.email,
      customerPhone:
        customers.phone,

      street:
        addresses.street,
      number:
        addresses.number,
      complement:
        addresses.complement,
      district:
        addresses.district,
      city:
        addresses.city,
      state:
        addresses.state,
      cep:
        addresses.cep,
    })
    .from(orders)
    .leftJoin(
      customers,
      eq(orders.customerId, customers.id)
    )
    .leftJoin(
      addresses,
      eq(
        orders.shippingAddressId,
        addresses.id
      )
    )
    // BIO_ADMIN_HIDE_CHECKOUT_PENDING_V1
    // Tentativa tecnica de pagamento com cartao nao e pedido
    // comercial e nao entra na operacao da Central.
    .where(
      ne(
        orders.status,
        "checkout_pending"
      )
    )
    .orderBy(
      desc(orders.createdAt)
    );

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10 lg:px-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#a0742b]">
        Administração Bio Florais
      </p>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-[#422347]">
            Pedidos
          </h1>

          <p className="mt-3 text-sm text-[#756674]">
            {orderRows.length}{" "}
            {orderRows.length === 1
              ? "pedido cadastrado"
              : "pedidos cadastrados"}
          </p>
        </div>
      </div>

      {orderRows.length === 0 ? (
        <div className="mt-8 rounded-[28px] border border-[#eadfd9] bg-white p-8 text-center shadow-sm">
          <p className="font-bold text-[#422347]">
            Nenhum pedido encontrado.
          </p>

          <p className="mt-2 text-sm text-[#756674]">
            Os novos pedidos do Bio Florais aparecerão aqui.
          </p>
        </div>
      ) : (
        <OrderBatchSelection>
          <div className="mt-8 space-y-5">
          {orderRows.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-[26px] border border-[#eadfd9] bg-white shadow-sm"
            >
              <div className="flex flex-col gap-4 border-b border-[#eee5df] p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-xs font-extrabold text-[#422347]">
                    <input
                      type="checkbox"
                      name="ids"
                      value={order.id}
                      className="h-4 w-4 accent-[#422347]"
                    />
                    Selecionar
                  </label>

                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#a0742b]">
                    Pedido
                  </p>

                  <p className="mt-1 break-all font-mono text-sm font-bold text-[#422347]">
                    {order.id}
                  </p>

                  <p className="mt-1 text-xs text-[#8a7a87]">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#f3ece6] px-4 py-2 text-xs font-extrabold text-[#422347]">
                    {orderStatusLabel(order.status)}
                  </span>

                  <span className="rounded-full bg-[#edf5ee] px-4 py-2 text-xs font-extrabold text-[#355c3d]">
                    {fulfillmentLabel(
                      order.fulfillmentStatus
                    )}
                  </span>
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[1.15fr_1.15fr_0.9fr]">
                <section className="border-b border-[#eee5df] p-5 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#a0742b]">
                    Cliente
                  </p>

                  <p className="mt-3 font-bold text-[#422347]">
                    {order.customerName ??
                      "Cliente não identificado"}
                  </p>

                  <p className="mt-1 text-sm text-[#756674]">
                    {order.customerEmail ?? "—"}
                  </p>

                  <p className="mt-1 text-sm text-[#756674]">
                    {order.customerPhone ?? "—"}
                  </p>

                  <div className="mt-4 border-t border-[#eee5df] pt-4">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-[#a0742b]">
                      Entrega
                    </p>

                    <div className="mt-2 text-sm leading-relaxed text-[#756674]">
                      {order.street ? (
                        <>
                          <p>
                            {order.street}
                            {order.number
                              ? `, ${order.number}`
                              : ""}
                            {order.complement
                              ? ` — ${order.complement}`
                              : ""}
                          </p>

                          <p>
                            {order.district ?? ""}
                          </p>

                          <p>
                            {order.city ?? ""}
                            {order.state
                              ? ` / ${order.state}`
                              : ""}
                          </p>

                          <p>
                            {order.cep
                              ? `CEP ${order.cep}`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <p>Endereço não informado.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="border-b border-[#eee5df] p-5 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#a0742b]">
                    Valores
                  </p>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#756674]">
                        Mercadorias
                      </span>

                      <strong>
                        {formatMoney(
                          order.subtotalCents
                        )}
                      </strong>
                    </div>

                    {order.discountCents > 0 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-[#756674]">
                          Descontos
                        </span>

                        <strong>
                          -{" "}
                          {formatMoney(
                            order.discountCents
                          )}
                        </strong>
                      </div>
                    )}

                    <div className="flex justify-between gap-4">
                      <span className="text-[#756674]">
                        Frete
                      </span>

                      <strong>
                        {formatMoney(
                          order.shippingCents
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4 border-t border-[#eee5df] pt-3 text-base">
                      <strong>Total</strong>

                      <strong className="text-[#422347]">
                        {formatMoney(
                          order.totalCents
                        )}
                      </strong>
                    </div>
                  </div>

                  {(order.couponCode ||
                    order.partnerCouponCode) && (
                    <div className="mt-4 border-t border-[#eee5df] pt-4">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-[#a0742b]">
                        Cupons
                      </p>

                      {order.couponCode && (
                        <p className="mt-2 text-sm text-[#756674]">
                          Comercial:{" "}
                          <strong className="text-[#422347]">
                            {order.couponCode}
                          </strong>
                          {" · -"}
                          {formatMoney(
                            order.couponDiscountCents
                          )}
                        </p>
                      )}

                      {order.partnerCouponCode && (
                        <p className="mt-2 text-sm text-[#756674]">
                          UGC:{" "}
                          <strong className="text-[#422347]">
                            {order.partnerCouponCode}
                          </strong>
                          {" · -"}
                          {formatMoney(
                            order.partnerCouponDiscountCents
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </section>

                <section className="p-5">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#a0742b]">
                    Expedição
                  </p>

                  <p className="mt-3 text-sm text-[#756674]">
                    {order.shippingServiceName ??
                      "Transportadora ainda não informada"}
                  </p>

                  {order.trackingCode && (
                    <p className="mt-2 break-all font-mono text-xs font-bold text-[#422347]">
                      {order.trackingCode}
                    </p>
                  )}

                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="mt-6 inline-flex rounded-full bg-[#422347] px-5 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
                  >
                    Ver pedido
                  </Link>
                </section>
              </div>
            </article>
          ))}
        </div>
        </OrderBatchSelection>
      )}
    </main>
  );
}
