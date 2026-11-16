/**
 * Contagem das tentativas de cartão de um pedido na última hora (Luis, 16/11): usada pelas rotas de cartão B2C e B2B antes de
 * chamar o Mercado Pago. Regra e mensagem em card-decline.ts (CARD_ATTEMPTS_PER_HOUR).
 */
import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { CARD_ATTEMPT_WINDOW_MS } from "@/lib/payments/card-decline";

export async function countRecentCardAttempts(orderId: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - CARD_ATTEMPT_WINDOW_MS);
  const [row] = await db
    .select({ total: count() })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.method, "card"), gte(payments.createdAt, since)));

  return Number(row?.total ?? 0);
}
