import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  orders,
  payments,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const LUNIUM_API_URL =
  "https://api.luniumpay.com";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  }
) {
  try {
    const { orderId } =
      await context.params;

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "Pedido n\u00e3o informado.",
        },
        { status: 400 }
      );
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
      })
      .from(orders)
      .where(
        eq(
          orders.id,
          orderId
        )
      )
      .limit(1);

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Pedido n\u00e3o encontrado.",
        },
        { status: 404 }
      );
    }

    let currentStatus =
      order.status;

    if (
      currentStatus !== "paid" &&
      currentStatus !== "cancelled"
    ) {
      const apiKey =
        process.env.LUNIUM_API_KEY?.trim();

      if (apiKey) {
        try {
          const luniumResponse =
            await fetch(
              LUNIUM_API_URL +
                "/cashin/charges",
              {
                method: "GET",

                headers: {
                  "X-API-Key":
                    apiKey,
                },

                cache: "no-store",
              }
            );

          const luniumData =
            await luniumResponse
              .json()
              .catch(() => null);

          if (luniumResponse.ok) {
            const charges =
              Array.isArray(
                luniumData?.charges
              )
                ? luniumData.charges
                : [];

            const charge =
              charges.find(
                (item: any) =>
                  item.external_id ===
                  orderId
              );

            if (
              charge?.status ===
                "paid" &&
              charge?.settlement_status ===
                "sent"
            ) {
              const existingPayments =
                await db
                  .select()
                  .from(payments)
                  .where(
                    eq(
                      payments.externalId,
                      charge.cashin_id
                    )
                  )
                  .limit(1);

              if (
                existingPayments.length >
                0
              ) {
                await db
                  .update(payments)
                  .set({
                    provider:
                      "lunium",

                    method:
                      "pix",

                    status:
                      "paid",

                    rawPayload:
                      charge,
                  })
                  .where(
                    eq(
                      payments.id,
                      existingPayments[0].id
                    )
                  );
              } else {
                await db
                  .insert(payments)
                  .values({
                    orderId,

                    provider:
                      "lunium",

                    externalId:
                      charge.cashin_id,

                    method:
                      "pix",

                    status:
                      "paid",

                    rawPayload:
                      charge,
                  });
              }

              await db
                .update(orders)
                .set({
                  status:
                    "paid",

                  fulfillmentStatus:
                    "paid_to_prepare",
                })
                .where(
                  eq(
                    orders.id,
                    orderId
                  )
                );

              currentStatus =
                "paid";

              console.log(
                "Pagamento Lunium confirmado:",
                {
                  orderId,

                  cashinId:
                    charge.cashin_id,

                  usdtAmount:
                    charge.usdt_amount,

                  settlementTxHash:
                    charge.settlement_tx_hash,
                }
              );
            }
          } else {
            console.error(
              "Erro ao consultar Lunium:",
              {
                status:
                  luniumResponse.status,

                data:
                  luniumData,
              }
            );
          }
        } catch (luniumError) {
          console.error(
            "Erro na conciliacao Lunium:",
            luniumError
          );
        }
      }
    }

    return NextResponse.json(
      {
        orderId:
          order.id,

        status:
          currentStatus,

        paid:
          currentStatus === "paid",
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Erro ao consultar status do pedido:",
      error
    );

    return NextResponse.json(
      {
        error:
          "N\u00e3o foi poss\u00edvel consultar o status do pedido.",
      },
      { status: 500 }
    );
  }
}
