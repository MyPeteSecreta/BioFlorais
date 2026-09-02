import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

export const dynamic =
  "force-dynamic";

export default async function AdminOrdersPage() {
  const orderRows =
    await db
      .select()
      .from(orders)
      .orderBy(
        desc(
          orders.createdAt
        )
      );

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10 lg:px-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#a0742b]">
        Administração Bio Florais
      </p>

      <h1 className="mt-2 font-serif text-4xl font-semibold text-[#422347]">
        Pedidos
      </h1>

      <p className="mt-3 text-sm text-[#756674]">
        {orderRows.length}
        {" "}
        {orderRows.length === 1
          ? "pedido cadastrado"
          : "pedidos cadastrados"}
      </p>

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
        <div className="mt-8 space-y-4">
          {orderRows.map(
            (order) => (
              <div
                key={
                  order.id
                }
                className="rounded-[22px] border border-[#eadfd9] bg-white p-5"
              >
                <p className="font-bold text-[#422347]">
                  Pedido {order.id}
                </p>

                <p className="mt-2 text-sm text-[#756674]">
                  Status:
                  {" "}
                  {order.status}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}
