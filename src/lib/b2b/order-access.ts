/**
 * Quem pode VER (imprimir / reabrir) um pedido ou orçamento B2B (Rodada 19b). Três caminhos, o primeiro que servir vale:
 *
 *  1. link pessoal do lojista  — o token resolve o cliente e o pedido é DELE;
 *  2. link geral (/parceiros, "storefront") — o token é público e não identifica o cliente: vale só para pedido de origem
 *     "parceiros" daquele vendedor da vitrine (o id do pedido é um UUID aleatório, como nas rotas de pagamento);
 *  3. sessão B2B logada (o representante, inclusive no modo "lançar pedido") — vale para os pedidos DELE.
 *
 * A decisão é pura (decideOrderAccess, testada); o carregamento do banco fica em authorizeOrderView.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { loadPublicB2BOfferContext, type PublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { readB2BResponsibleSession } from "@/lib/b2b/responsible-session";

export const STOREFRONT_ORIGIN_VALUE = "parceiros";

export type AccessOrder = {
  id: string;
  status: string;
  clientId: string | null;
  responsibleId: string | null;
  origin: string | null;
  originCode: string | null;
};

export type AccessVia = "client-link" | "storefront-link" | "vendor-session";

export type OrderAccess = { ok: true; via: AccessVia; order: AccessOrder } | { ok: false; status: number; error: string };

export const ORDER_NOT_FOUND: OrderAccess = { ok: false, status: 404, error: "Pedido não encontrado." };

/** Decisão pura. `storefrontReferral` = código de indicação do vendedor da vitrine do token (link geral). */
export function decideOrderAccess(input: {
  order: AccessOrder;
  context: Pick<PublicB2BOfferContext, "clientId" | "isStorefront"> | null;
  storefrontReferral: string | null;
  sessionResponsibleId: string | null;
  sessionActive: boolean;
}): AccessVia | null {
  const { order, context } = input;

  if (context && !context.isStorefront && order.clientId && context.clientId === order.clientId) return "client-link";

  if (context?.isStorefront && order.origin === STOREFRONT_ORIGIN_VALUE) {
    if (!order.originCode || (input.storefrontReferral && order.originCode === input.storefrontReferral)) return "storefront-link";
  }

  if (input.sessionResponsibleId && input.sessionActive && order.responsibleId && order.responsibleId === input.sessionResponsibleId) return "vendor-session";

  return null;
}

export async function loadAccessOrder(run: SqlRunner, orderId: string): Promise<AccessOrder | null> {
  if (!isUuid(orderId)) return null;

  const [row] = await run(
    `SELECT o.id::text AS id, o.status, o.b2b_client_id::text AS client_id, o.b2b_responsible_id::text AS responsible_id,
            to_jsonb(o) ->> 'origin' AS origin, to_jsonb(o) ->> 'origin_code' AS origin_code
       FROM orders o
      WHERE o.id = $1::uuid AND o.b2b_offer_id IS NOT NULL AND to_jsonb(o) ->> 'archived_at' IS NULL`,
    [orderId]
  );

  return row
    ? {
        id: String(row.id),
        status: String(row.status ?? ""),
        clientId: row.client_id ? String(row.client_id) : null,
        responsibleId: row.responsible_id ? String(row.responsible_id) : null,
        origin: row.origin ? String(row.origin) : null,
        originCode: row.origin_code ? String(row.origin_code) : null,
      }
    : null;
}

export async function authorizeOrderView(
  run: SqlRunner,
  input: { orderId: string; token?: string | null; sessionCookie?: string | null }
): Promise<OrderAccess> {
  const order = await loadAccessOrder(run, input.orderId);

  if (!order) return ORDER_NOT_FOUND;

  let context: PublicB2BOfferContext | null = null;
  let storefrontReferral: string | null = null;

  if (input.token) {
    const resolution = await loadPublicB2BOfferContext(input.token);

    if (resolution.ok) {
      context = resolution.context;

      if (context.isStorefront) {
        const [seller] = await run(`SELECT referral_code FROM b2b_responsibles WHERE id = $1::uuid`, [context.responsibleId]).catch(() => [undefined]);
        storefrontReferral = seller?.referral_code ? String(seller.referral_code) : null;
      }
    }
  }

  const session = readB2BResponsibleSession(input.sessionCookie ?? undefined);
  let sessionActive = false;

  if (session) {
    const [row] = await run(`SELECT status FROM b2b_responsibles WHERE id = $1::uuid LIMIT 1`, [session.responsibleId]).catch(() => [undefined]);
    sessionActive = row?.status === "active";
  }

  const via = decideOrderAccess({
    order,
    context,
    storefrontReferral,
    sessionResponsibleId: session?.responsibleId ?? null,
    sessionActive,
  });

  // Sem permissão é "não encontrado": não revela que o pedido existe.
  return via ? { ok: true, via, order } : ORDER_NOT_FOUND;
}
