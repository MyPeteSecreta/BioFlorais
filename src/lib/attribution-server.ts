/**
 * Origem da venda no servidor (Rodada 17): grava utm_source/utm_medium/utm_campaign/referrer_domain no pedido a partir do
 * cookie bio_origem e lê a origem para o admin e a exportação. Colunas do SQL 45b; sem elas tudo fica inerte
 * (nada quebra), como no oppref. Só preenche pedido ainda sem origem.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { ATTRIBUTION_COOKIE, hasAttribution, readAttributionCookie, type Attribution } from "@/lib/attribution";

/** Origem guardada no cookie da requisição (null = visita direta/sem cookie). */
export function attributionFromRequest(cookieValue: string | null | undefined): Attribution | null {
  return readAttributionCookie(cookieValue, false);
}

export { ATTRIBUTION_COOKIE };

export async function attachAttribution(run: SqlRunner, orderId: string, attribution: Attribution | null | undefined): Promise<boolean> {
  if (!attribution || !hasAttribution(attribution) || !isUuid(orderId)) return false;

  try {
    const rows = await run(
      `UPDATE orders
          SET utm_source = $2, utm_medium = $3, utm_campaign = $4, referrer_domain = $5
        WHERE id = $1::uuid AND utm_source IS NULL AND utm_medium IS NULL AND utm_campaign IS NULL AND referrer_domain IS NULL
      RETURNING id`,
      [orderId, attribution.utm_source, attribution.utm_medium, attribution.utm_campaign, attribution.referrer_domain]
    );

    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Origem de um pedido (admin). Sem as colunas (SQL 45b) ou sem origem = null. */
export async function loadOrderAttribution(run: SqlRunner, orderId: string): Promise<Attribution | null> {
  if (!isUuid(orderId)) return null;

  try {
    const rows = await run(`SELECT utm_source, utm_medium, utm_campaign, referrer_domain FROM orders WHERE id = $1::uuid`, [orderId]);
    const row = rows[0];
    if (!row) return null;

    const attribution: Attribution = {
      utm_source: row.utm_source ? String(row.utm_source) : null,
      utm_medium: row.utm_medium ? String(row.utm_medium) : null,
      utm_campaign: row.utm_campaign ? String(row.utm_campaign) : null,
      referrer_domain: row.referrer_domain ? String(row.referrer_domain) : null,
    };

    return hasAttribution(attribution) ? attribution : null;
  } catch {
    return null;
  }
}

const CSV_HEADER = ["pedido", "data", "status", "pagamento", "total_reais", "utm_source", "utm_medium", "utm_campaign", "referrer_domain", "origem"];

/** Célula de CSV: aspas duplicadas e proteção contra fórmula de planilha (=, +, -, @). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

/** CSV de pedidos com a origem (admin). Sem as colunas da origem exporta os pedidos com as colunas de origem vazias. */
export async function buildOrdersOriginCsv(run: SqlRunner, options: { from?: string | null; to?: string | null; notArchivedSql?: string } = {}): Promise<string> {
  const filters: string[] = [];
  const params: unknown[] = [];

  if (options.from && /^\d{4}-\d{2}-\d{2}$/.test(options.from)) {
    params.push(options.from);
    filters.push(`o.created_at >= $${params.length}::date`);
  }

  if (options.to && /^\d{4}-\d{2}-\d{2}$/.test(options.to)) {
    params.push(options.to);
    filters.push(`o.created_at < ($${params.length}::date + 1)`);
  }

  const where = `WHERE true${options.notArchivedSql ?? ""}${filters.map((filter) => ` AND ${filter}`).join("")}`;
  const base = `o.id::text AS id, o.created_at, o.status, o.payment_method, o.total_cents`;
  let rows: Array<Record<string, unknown>>;

  try {
    rows = await run(
      `SELECT ${base}, o.utm_source, o.utm_medium, o.utm_campaign, o.referrer_domain FROM orders o ${where} ORDER BY o.created_at DESC LIMIT 20000`,
      params
    );
  } catch {
    rows = await run(`SELECT ${base} FROM orders o ${where} ORDER BY o.created_at DESC LIMIT 20000`, params);
  }

  const lines = [CSV_HEADER.map(csvCell).join(",")];

  for (const row of rows) {
    const attribution: Attribution = {
      utm_source: row.utm_source ? String(row.utm_source) : null,
      utm_medium: row.utm_medium ? String(row.utm_medium) : null,
      utm_campaign: row.utm_campaign ? String(row.utm_campaign) : null,
      referrer_domain: row.referrer_domain ? String(row.referrer_domain) : null,
    };
    const created = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? "");
    const origem = hasAttribution(attribution)
      ? `${attribution.utm_source ?? attribution.referrer_domain ?? ""} / ${attribution.utm_medium ?? ""} / ${attribution.utm_campaign ?? ""}`
      : "direto";

    lines.push(
      [
        row.id,
        created,
        row.status,
        row.payment_method,
        (Number(row.total_cents ?? 0) / 100).toFixed(2),
        attribution.utm_source,
        attribution.utm_medium,
        attribution.utm_campaign,
        attribution.referrer_domain,
        origem,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return `﻿${lines.join("\r\n")}\r\n`;
}
