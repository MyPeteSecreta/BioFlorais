import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  customers,
  orderItems,
  orders,
  products,
} from "@/lib/db/schema";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: Date | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default async function ImprimirPedidoPage({
  params,
}: PageProps) {
  const { id } = await params;

  const [order] = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      customerId: orders.customerId,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    notFound();
  }

  const [customer] = await db
    .select({
      name: customers.name,
    })
    .from(customers)
    .where(eq(customers.id, order.customerId))
    .limit(1);

  const items = await db
    .select({
      qty: orderItems.qty,
      productName: products.name,
      productLineSlug: products.lineSlug,
      category: products.category,

    })
    .from(orderItems)
    .leftJoin(
      products,
      eq(orderItems.productId, products.id)
    )
    .where(eq(orderItems.orderId, order.id));

  return (
    <>
      <main className="mx-auto max-w-[760px] bg-white px-5 py-5 text-black print:max-w-none print:px-0 print:py-0">
        <header className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-xl font-black">
              Bio Florais
            </h1>

            <p className="text-xs font-bold uppercase tracking-wide">
              Separação de pedido
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold uppercase">
              Pedido
            </p>

            <p className="text-lg font-black">
              #{shortOrderId(order.id)}
            </p>

            <p className="text-xs">
              {formatDate(order.createdAt)}
            </p>
          </div>
        </header>

        <section className="border-b border-black py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500">
                Cliente
              </p>

              <p className="text-base font-black">
                {customer?.name ||
                  "Cliente não identificado"}
              </p>
            </div>

            <div className="flex gap-5 text-xs font-bold">
              <span>☐ Separado</span>
              <span>☐ Conferido</span>
              <span>☐ Embalado</span>
            </div>
          </div>
        </section>

        <section className="py-3">
          <div className="grid grid-cols-[55px_1fr] border-b border-black pb-2 text-[10px] font-black uppercase">
            <span>Qtd.</span>
            <span>Produto</span>
          </div>

          {items.map((item, index) => (
            <div
              key={`${item.productName}-${index}`}
              className="grid grid-cols-[55px_1fr] items-center border-b border-gray-300 py-2"
            >
              <span className="text-lg font-black">
                {item.qty}
              </span>

              <span className="pr-3 text-sm font-bold">
                ☐ {item.category
                  ? `${item.category} — ${item.productName || "Produto"}`
                  : item.productName || "Produto"}
                {item.productLineSlug
                  ? ` · Linha: ${item.productLineSlug}`
                  : ""}
              </span>

            </div>
          ))}
        </section>

        <footer className="mt-3 flex items-end justify-between border-t border-black pt-3">
          <div className="text-[10px]">
            Pedido completo: {order.id}
          </div>

          <div className="flex gap-8 text-xs font-bold">
            <span>
              Separado por: ______________
            </span>
            <span>
              Conferido por: ______________
            </span>
          </div>
        </footer>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 10mm;
              }

              header,
              nav,
              body > footer {
                display: none !important;
              }

              body {
                background: white !important;
              }
            }
          `,
        }}
      />
    </>
  );
}
