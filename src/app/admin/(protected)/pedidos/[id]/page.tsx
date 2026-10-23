import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/client";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { displayByKey, displayOmieObservation } from "@/lib/b2b/displays";
import { loadShowcaseOrderIds } from "@/lib/b2b/showcase";
import { formatOrigin } from "@/lib/attribution";
import { loadOrderAttribution } from "@/lib/attribution-server";
import { loadOrderNote } from "@/lib/order-note-server";
import QuoteActions from "@/components/b2b/QuoteActions";
import { readActiveOfferLink } from "@/lib/b2b/offer-link";
import { continueQuotePath } from "@/lib/b2b/quote-links";
import { isQuoteExpired } from "@/lib/b2b/quote-order";
import {
  addresses,
  customers,
  orderItems,
  orders,
  payments,
  products,
} from "@/lib/db/schema";

import ArchiveOrderButton from "@/components/admin/ArchiveOrderButton";
import FulfillmentControls from "@/components/admin/FulfillmentControls";
import ShippingControls from "@/components/admin/ShippingControls";
import OrderEventsPanel from "@/components/admin/OrderEventsPanel";

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
    case "quote":
      return "Orçamento (pendente)";

    case "quote_converted":
      return "Orçamento convertido em pedido";

    case "quote_replaced":
      return "Orçamento substituído";

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
    case "delivered":
      return "Entregue";
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

  // Origem da venda (utm_* / domínio do referrer, SQL 45b). Sem as colunas ou sem origem = Direto.
  const origin = formatOrigin(await loadOrderAttribution(getAppSqlRunner(), order.id));

  // Observações escritas pelo cliente no checkout (SQL 46b); seguem ao Omie na observação do pedido.
  const customerNote = await loadOrderNote(getAppSqlRunner(), order.id);

  // Pedido de MOSTRUÁRIO do vendedor: selo visível; a observação segue para o Omie.
  const isShowcase = (await loadShowcaseOrderIds(getAppSqlRunner())).has(order.id);

  // Displays do kit (brinde): não são item do pedido; seguem ao Omie como observação.
  const displayNotes: string[] = [];

  try {
    const adjustments = order.commercialAdjustmentsJson
      ? (JSON.parse(order.commercialAdjustmentsJson) as { displays?: Array<{ key?: string; count?: number }> })
      : null;

    for (const entry of adjustments?.displays ?? []) {
      const display = displayByKey(String(entry.key ?? ""));
      if (display) displayNotes.push(displayOmieObservation(display, Math.max(1, Number(entry.count ?? 1))));
    }
  } catch {
    // ajuste ilegível: sem observação
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
        // Nome completo dos itens B2B (product_name_snapshot, SQL 21b). Pedido B2C: nulo = igual a antes.
        productNameSnapshot: sql<string | null>`to_jsonb("order_items") ->> 'product_name_snapshot'`,
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

  // Orçamento (pedido sem pagamento): botão principal "Continuar compra" (loja do link do cliente), imprimir e compartilhar.
  let quoteContinueHref: string | null = null;
  let quoteExpires: string | null = null;

  if (order.status === "quote") {
    try {
      const [expiresRow] = await getAppSqlRunner()(
        `SELECT to_char(quote_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at FROM orders WHERE id = $1::uuid`,
        [order.id]
      );
      quoteExpires = expiresRow?.expires_at ? String(expiresRow.expires_at) : null;
    } catch {
      quoteExpires = null;
    }

    if (order.b2bOfferId) {
      const link = await readActiveOfferLink(order.b2bOfferId, {
        clientName: customer?.name ?? "cliente",
        clientPhone: customer?.phone ?? null,
        responsibleName: order.b2bResponsibleName ?? "Bio Florais",
      });
      const token = link ? link.path.split("/").filter(Boolean).pop() : null;
      quoteContinueHref = token ? continueQuotePath(token, order.id, false) : null;
    }
  }

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

            <p className="mt-1 text-sm font-bold text-stone-700" data-testid="pedido-origem">
              Origem: {origin}
            </p>

            {order.status === "quote" && (
              <section className="mt-3 max-w-[640px] rounded-2xl border border-amber-300 bg-amber-50 p-4" data-testid="admin-orcamento">
                <p className="text-sm font-extrabold text-amber-950">
                  Orçamento (pendente){quoteExpires ? ` · ${isQuoteExpired(quoteExpires) ? "venceu" : "válido"} até ${formatDate(new Date(quoteExpires))}` : ""}
                </p>
                <p className="mt-1 text-xs text-amber-900">Sem forma de pagamento: não reserva produtos, não vai ao Omie e não gera comissão.</p>
                {quoteContinueHref ? (
                  <QuoteActions className="mt-3" continueHref={quoteContinueHref} printHref={`/admin/pedidos/${order.id}/folha`} phone={customer?.phone ?? null} who={customer?.name ?? null} />
                ) : (
                  <p className="mt-2 text-xs font-bold text-amber-950">
                    O link da oferta deste cliente não tem cópia guardada: gere um novo link no painel do representante para continuar a compra.
                  </p>
                )}
              </section>
            )}

            {customerNote && (
              <p
                className="mt-2 max-w-[640px] whitespace-pre-line rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                data-testid="pedido-observacoes"
              >
                <strong>Observações do cliente:</strong> {customerNote}
              </p>
            )}

            {displayNotes.length > 0 && (
              <p className="mt-1 text-sm font-bold text-emerald-800" data-testid="pedido-display">
                {displayNotes.join(" | ")}
              </p>
            )}

            {isShowcase && (
              <p className="mt-1 text-sm font-bold text-fuchsia-800">
                PEDIDO DE MOSTRUÁRIO – vendedor {order.b2bResponsibleName ?? "—"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isShowcase && (
              <span className="w-fit rounded-full bg-fuchsia-700 px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white" data-testid="showcase-badge">
                Mostruário
              </span>
            )}
            <span className="w-fit rounded-full bg-amber-100 px-5 py-2.5 text-sm font-extrabold text-amber-900">
              {orderStatusLabel(order.status)}
            </span>

            {!order.status.startsWith("quote") && (
              <span className="w-fit rounded-full bg-emerald-100 px-5 py-2.5 text-sm font-extrabold text-emerald-900">
                {fulfillmentLabel(order.fulfillmentStatus)}
              </span>
            )}
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
                    {item.productNameSnapshot
                      ? item.productNameSnapshot
                      : item.category
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

          <ArchiveOrderButton orderId={order.id} />

          <FulfillmentControls
            orderId={order.id}
            currentStatus={order.fulfillmentStatus}
            paymentApproved={paymentApproved}
          />

          <OrderEventsPanel
            orderId={order.id}
            paymentApproved={paymentApproved}
            fulfillmentStatus={order.fulfillmentStatus}
            initialCarrier={order.shippingServiceName ?? ""}
            initialTracking={order.trackingCode ?? ""}
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
