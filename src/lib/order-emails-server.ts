/**
 * Disparo dos e-mails de andamento do pedido (src/lib/order-emails.ts) a partir das rotas e do webhook.
 * Nunca lança erro e nunca atrapalha o pedido. Dentro de uma requisição roda DEPOIS da resposta (after() do Next);
 * fora dela (script, teste) roda na hora.
 */

import { after } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { mailConfigured, sendEmail } from "@/lib/mail";
import { notifyOrderProgress } from "@/lib/order-emails";
import { getSiteUrl } from "@/lib/seo/site-url";

export async function notifyOrderProgressSafe(orderId: string): Promise<void> {
  try {
    const result = await notifyOrderProgress(getAppSqlRunner(), orderId, {
      send: (mail) => sendEmail(mail),
      configured: mailConfigured(),
      siteUrl: getSiteUrl(),
    });

    if (result.sent || (result.reason !== "no_stage" && result.reason !== "already_sent")) {
      console.log("[order-emails]", orderId.slice(0, 8), result);
    }
  } catch (error) {
    console.error("[order-emails] falha (o pedido segue normal)", error instanceof Error ? error.message : error);
  }
}

/** Agenda o e-mail da etapa atual do pedido para depois da resposta. */
export function scheduleOrderEmail(orderId: string | null | undefined): void {
  if (!orderId) return;

  try {
    after(() => notifyOrderProgressSafe(orderId));
  } catch {
    void notifyOrderProgressSafe(orderId);
  }
}
