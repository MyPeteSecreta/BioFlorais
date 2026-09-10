import {
  desc,
  inArray,
} from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/client";
import {
  customers,
  orderItems,
  orders,
  products,
} from "@/lib/db/schema";

type PageProps = {
  searchParams: Promise<{
    ids?: string | string[];
  }>;
};

function formatDate(
  value: Date | null
) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(value);
}

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default async function ImprimirPedidosPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const rawIds =
    Array.isArray(params.ids)
      ? params.ids
      : params.ids
        ? [params.ids]
        : [];

  const ids = Array.from(
    new Set(
      rawIds
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

  if (ids.length === 0) {
    notFound();
  }

  const orderRows =
    await db
      .select({
        id: orders.id,
        createdAt:
          orders.createdAt,
        customerName:
          customers.name,
      })
      .from(orders)
      .leftJoin(
        customers,
        inArray(
          customers.id,
          [orders.customerId] as never
        )
      )
      .where(
        inArray(
          orders.id,
          ids
        )
      )
      .orderBy(
        desc(orders.createdAt)
      );

  /*
   * O join acima não pode usar inArray
   * entre colunas. Fazemos a busca dos
   * clientes separadamente abaixo.
   */

  const cleanOrders =
    await db
      .select({
        id: orders.id,
        createdAt:
          orders.createdAt,
        customerId:
          orders.customerId,
      })
      .from(orders)
      .where(
        inArray(
          orders.id,
          ids
        )
      )
      .orderBy(
        desc(orders.createdAt)
      );

  if (
    cleanOrders.length === 0
  ) {
    notFound();
  }

  const customerIds =
    Array.from(
      new Set(
        cleanOrders
          .map(
            (order) =>
              order.customerId
          )
          .filter(Boolean)
      )
    );

  const customerRows =
    customerIds.length > 0
      ? await db
          .select({
            id: customers.id,
            name: customers.name,
          })
          .from(customers)
          .where(
            inArray(
              customers.id,
              customerIds
            )
          )
      : [];

  const customerMap =
    new Map(
      customerRows.map(
        (customer) => [
          customer.id,
          customer.name,
        ]
      )
    );

  const itemRows =
    await db
      .select({
        orderId:
          orderItems.orderId,
        qty:
          orderItems.qty,
        productName:
          products.name,
        productLineSlug:
          products.lineSlug,
        category:
          products.category,
      })
      .from(orderItems)
      .leftJoin(
        products,
        inArray(
          products.id,
          [orderItems.productId] as never
        )
      )
      .where(
        inArray(
          orderItems.orderId,
          ids
        )
      );

  /*
   * Assim como acima, fazemos o join
   * correto numa segunda consulta para
   * manter o SQL simples e tipado.
   */

  const items =
    await db
      .select({
        orderId:
          orderItems.orderId,
        qty:
          orderItems.qty,
        productName:
          products.name,
        productLineSlug:
          products.lineSlug,
        category:
          products.category,
      })
      .from(orderItems)
      .leftJoin(
        products,
        // igualdade real entre FK e PK
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("drizzle-orm")).eq(
          orderItems.productId,
          products.id
        )
      )
      .where(
        inArray(
          orderItems.orderId,
          ids
        )
      );

  const itemsByOrder =
    new Map<
      string,
      typeof items
    >();

  for (const item of items) {
    const current =
      itemsByOrder.get(
        item.orderId
      ) ?? [];

    current.push(item);

    itemsByOrder.set(
      item.orderId,
      current
    );
  }

  return (
    <>
      <main className="mx-auto max-w-[900px] bg-white px-5 py-5 text-black print:max-w-none print:px-0 print:py-0">
        <header className="mb-4 flex items-end justify-between border-b-2 border-black pb-3">
          <div>
            <h1 className="text-xl font-black">
              Bio Florais
            </h1>

            <p className="text-xs font-bold uppercase tracking-wide">
              Separação de pedidos
            </p>
          </div>

          <div className="text-right text-xs font-bold">
            {cleanOrders.length}{" "}
            {cleanOrders.length === 1
              ? "pedido"
              : "pedidos"}
          </div>
        </header>

        <div className="space-y-4 print:space-y-3">
          {cleanOrders.map(
            (order) => {
              const orderProducts =
                itemsByOrder.get(
                  order.id
                ) ?? [];

              const customerName =
                customerMap.get(
                  order.customerId
                ) ??
                "Cliente não identificado";

              return (
                <section
                  key={order.id}
                  className="batch-order border-2 border-black"
                >
                  <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 border-b border-black px-3 py-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase text-gray-500">
                        Pedido
                      </p>

                      <p className="text-sm font-black">
                        #
                        {shortOrderId(
                          order.id
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase text-gray-500">
                        Cliente
                      </p>

                      <p className="text-sm font-black">
                        {customerName}
                      </p>
                    </div>

                    <div className="text-right text-[10px]">
                      <p>
                        {formatDate(
                          order.createdAt
                        )}
                      </p>

                      <div className="mt-1 flex gap-3 font-bold">
                        <span>
                          ☐ Separado
                        </span>

                        <span>
                          ☐ Conferido
                        </span>

                        <span>
                          ☐ Embalado
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[48px_1fr] border-b border-black bg-gray-50 px-3 py-1 text-[9px] font-black uppercase">
                    <span>
                      Qtd.
                    </span>

                    <span>
                      Produto
                    </span>
                  </div>

                  {orderProducts.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${order.id}-${index}`}
                        className="grid grid-cols-[48px_1fr] items-center border-b border-gray-300 px-3 py-1.5 last:border-b-0"
                      >
                        <span className="text-sm font-black">
                          {item.qty}
                        </span>

                        <span className="text-xs font-bold">
                          ☐{" "}
                          {item.category
                            ? `${item.category} — ${item.productName || "Produto"}`
                            : item.productName ||
                              "Produto"}

                          {item.productLineSlug
                            ? ` · Linha: ${item.productLineSlug}`
                            : ""}
                        </span>
                      </div>
                    )
                  )}

                  <div className="flex items-center justify-between border-t border-black px-3 py-1.5 text-[9px]">
                    <span>
                      ID completo:{" "}
                      {order.id}
                    </span>

                    <div className="flex gap-5 font-bold">
                      <span>
                        Separado por:
                        ____________
                      </span>

                      <span>
                        Conferido por:
                        ____________
                      </span>
                    </div>
                  </div>
                </section>
              );
            }
          )}
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 7mm;
              }

              header,
              nav,
              body > footer {
                display: none !important;
              }

              body {
                background: white !important;
              }

              .batch-order {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          `,
        }}
      />
    </>
  );
}
