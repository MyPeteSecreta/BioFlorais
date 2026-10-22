/**
 * Orçamento B2B (Rodada 19d): regras PURAS e acesso ao banco do "pedido sem pagamento".
 *
 * Um orçamento é um pedido com status 'quote' ("Orçamento (pendente)"), sem forma de pagamento. NÃO reserva estoque, NÃO vai ao
 * Omie/Central (só leem pedido pago), NÃO conta como compra e NÃO gera comissão (nada disso olha status 'quote').
 * Validade: 15 dias (B2B_QUOTE_VALIDITY_DAYS, de 1 a 90). Ao virar pedido o orçamento passa a 'quote_converted'; ao ser salvo
 * de novo, o anterior passa a 'quote_replaced' (nunca apaga).
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";

export const QUOTE_STATUS = "quote";
export const QUOTE_CONVERTED = "quote_converted";
export const QUOTE_REPLACED = "quote_replaced";
export const QUOTE_DEFAULT_VALIDITY_DAYS = 15;
export const QUOTE_LABEL = "Orçamento (pendente)";
export const SQL_48B_MESSAGE = "Aplique o SQL 48b (orçamento B2B) para salvar orçamentos.";

/** Dias de validade: B2B_QUOTE_VALIDITY_DAYS (1 a 90); inválido = 15. */
export function quoteValidityDays(raw: string | undefined = process.env.B2B_QUOTE_VALIDITY_DAYS): number {
  const value = Number(String(raw ?? "").trim());

  return Number.isInteger(value) && value >= 1 && value <= 90 ? value : QUOTE_DEFAULT_VALIDITY_DAYS;
}

export function quoteExpiry(from: Date = new Date(), days: number = quoteValidityDays()): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isQuoteExpired(expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;

  const time = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(String(expiresAt));

  return Number.isFinite(time) && time < now.getTime();
}

/** Rótulo do status para listas e admin: orçamento pendente, vencido, convertido ou substituído. */
export function quoteStatusLabel(status: string, expiresAt?: Date | string | null, now: Date = new Date()): string | null {
  if (status === QUOTE_STATUS) return isQuoteExpired(expiresAt, now) ? "Orçamento vencido" : QUOTE_LABEL;
  if (status === QUOTE_CONVERTED) return "Orçamento convertido em pedido";
  if (status === QUOTE_REPLACED) return "Orçamento substituído por outro";

  return null;
}

export const isQuoteStatus = (status: string | null | undefined) => status === QUOTE_STATUS || status === QUOTE_CONVERTED || status === QUOTE_REPLACED;

let columnChecked: { ready: boolean; at: number } | null = null;

/** A coluna quote_expires_at existe (SQL 48b)? Positivo é lembrado; negativo é reverificado a cada 30 s. */
export async function quoteColumnReady(run: SqlRunner): Promise<boolean> {
  if (columnChecked && (columnChecked.ready || Date.now() - columnChecked.at < 30_000)) return columnChecked.ready;

  let ready = false;

  try {
    const rows = await run(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'quote_expires_at' LIMIT 1`
    );
    ready = rows.length > 0;
  } catch {
    ready = false;
  }

  columnChecked = { ready, at: Date.now() };

  return ready;
}

export function resetQuoteColumnCache() {
  columnChecked = null;
}

/** Marca a validade no orçamento recém-criado. */
export async function setQuoteExpiry(run: SqlRunner, orderId: string, expiresAt: Date): Promise<boolean> {
  if (!isUuid(orderId)) return false;

  const rows = await run(`UPDATE orders SET quote_expires_at = $2 WHERE id = $1::uuid AND status = 'quote' RETURNING id`, [orderId, expiresAt.toISOString()]);

  return rows.length > 0;
}

/**
 * Fecha o orçamento anterior (só se for DESTE cliente e ainda pendente): 'quote_converted' (virou pedido) ou
 * 'quote_replaced' (foi salvo de novo). Não apaga nada. true = marcou.
 */
export async function closeQuote(
  run: SqlRunner,
  quoteId: string,
  clientId: string,
  as: typeof QUOTE_CONVERTED | typeof QUOTE_REPLACED
): Promise<boolean> {
  if (!isUuid(quoteId) || !isUuid(clientId)) return false;

  try {
    const rows = await run(`UPDATE orders SET status = $3 WHERE id = $1::uuid AND b2b_client_id = $2::uuid AND status = 'quote' RETURNING id`, [
      quoteId,
      clientId,
      as,
    ]);

    return rows.length > 0;
  } catch {
    return false;
  }
}

export type StoredQuote = {
  orderId: string;
  offerId: string;
  status: string;
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
  totalCents: number;
  origin: string | null;
};

/** Orçamentos pendentes de um cliente (os já convertidos/substituídos não entram). */
export async function listClientQuotes(run: SqlRunner, clientId: string, limit = 30): Promise<StoredQuote[]> {
  if (!isUuid(clientId)) return [];

  try {
    const rows = await run(
      `SELECT o.id::text AS id, o.b2b_offer_id::text AS offer_id, o.status, o.total_cents, to_jsonb(o) ->> 'origin' AS origin,
              to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
              to_char(o.quote_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at
         FROM orders o
        WHERE o.b2b_client_id = $1::uuid AND o.status = 'quote' AND o.b2b_offer_id IS NOT NULL
        ORDER BY o.created_at DESC LIMIT $2`,
      [clientId, limit]
    );

    return rows.map((row) => ({
      orderId: String(row.id),
      offerId: String(row.offer_id),
      status: String(row.status),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      expired: isQuoteExpired(row.expires_at ? String(row.expires_at) : null),
      createdAt: String(row.created_at),
      totalCents: Number(row.total_cents ?? 0),
      origin: row.origin ? String(row.origin) : null,
    }));
  } catch {
    return [];
  }
}
