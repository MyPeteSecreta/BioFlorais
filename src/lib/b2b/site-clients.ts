/**
 * Admin → "Clientes do site (B2C)" (Rodada 19b): compradores do site, SÓ LEITURA, agrupados por e-mail a partir dos pedidos B2C
 * (pedido sem oferta B2B). Nome e cidade/UF são os do pedido mais recente. Pedidos de teste arquivados e orçamentos ficam de fora.
 * Sem exportação de dados pessoais por enquanto.
 */

import { andNotArchived } from "@/lib/b2b/archive";
import type { SqlRunner } from "@/lib/b2b/ownership";

export type SiteClient = {
  email: string;
  name: string;
  city: string | null;
  state: string | null;
  orders: number;
  paidOrders: number;
  totalPaidCents: number;
  lastOrderAt: string | null;
};

export async function searchSiteClients(run: SqlRunner, query: string, limit = 50): Promise<SiteClient[]> {
  const q = String(query ?? "").trim().slice(0, 80);
  const notArchived = await andNotArchived(run, "orders", "o");
  const params: unknown[] = [];
  let filter = "";

  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`);
    filter = `WHERE (email ILIKE $1 OR name ILIKE $1 OR city ILIKE $1)`;
  }

  params.push(Math.max(1, Math.min(limit, 100)));

  const rows = await run(
    `WITH base AS (
       SELECT lower(btrim(c.email)) AS email, c.name, a.city, a.state, o.status, o.total_cents, o.created_at
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         LEFT JOIN addresses a ON a.id = o.shipping_address_id
        WHERE o.b2b_offer_id IS NULL
          AND o.status NOT IN ('checkout_pending', 'quote', 'quote_converted', 'quote_replaced')
          AND coalesce(btrim(c.email), '') <> ''${notArchived}
     )
     SELECT email,
            (array_agg(name ORDER BY created_at DESC))[1] AS name,
            (array_agg(city ORDER BY created_at DESC))[1] AS city,
            (array_agg(state ORDER BY created_at DESC))[1] AS state,
            count(*)::int AS orders,
            (count(*) FILTER (WHERE status IN ('paid', 'approved')))::int AS paid_orders,
            coalesce(sum(total_cents) FILTER (WHERE status IN ('paid', 'approved')), 0)::bigint AS total_paid_cents,
            to_char(max(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_order_at
       FROM base
       ${filter}
      GROUP BY email
      ORDER BY max(created_at) DESC
      LIMIT $${params.length}`,
    params
  );

  return rows.map((row) => ({
    email: String(row.email),
    name: String(row.name ?? ""),
    city: row.city ? String(row.city) : null,
    state: row.state ? String(row.state) : null,
    orders: Number(row.orders ?? 0),
    paidOrders: Number(row.paid_orders ?? 0),
    totalPaidCents: Number(row.total_paid_cents ?? 0),
    lastOrderAt: row.last_order_at ? String(row.last_order_at) : null,
  }));
}
