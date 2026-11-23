/**
 * "Vendas por origem" (admin, 23/11): pedidos do SITE agrupados por canal, campanha e anúncio, pagos × não pagos, num período,
 * SEPARADOS em consumidor (B2C) e lojista (B2B, feito pelo site). Só leitura e SEM dado pessoal (só contagens e valores).
 * Origem = utm_source (ou o domínio do referrer, ou "direto"), utm_medium, utm_campaign e utm_content (o anúncio). Sem as colunas
 * novas (SQL 59b), "anúncio" fica "—"; sem as colunas da origem básica (SQL 45b), tudo cai em "direto". Orçamento, pedido lançado pelo
 * vendedor e mostruário (orders.origin) ficam de fora: não vieram do site.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

export type OriginRow = {
  canal: string;
  meio: string;
  campanha: string;
  anuncio: string;
  pedidos: number;
  pagos: number;
  naoPagos: number;
  valorPagoCents: number;
  valorNaoPagoCents: number;
};

export type SegmentReport = {
  rows: OriginRow[];
  /** Totais por canal (soma das linhas). */
  channels: OriginRow[];
  totals: OriginRow;
};

export type SalesByOrigin = {
  from: string;
  to: string;
  b2c: SegmentReport;
  b2b: SegmentReport;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAID = `o.status IN ('paid', 'approved')`;
const COUNTED = `o.status NOT IN ('quote', 'quote_converted', 'quote_replaced')`;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Período padrão: últimos 30 dias (datas AAAA-MM-DD; inválida volta ao padrão). */
export function resolvePeriod(from: string | null | undefined, to: string | null | undefined, now: Date = new Date()): { from: string; to: string } {
  const end = to && DATE.test(to) ? to : isoDay(now);
  const start = from && DATE.test(from) ? from : isoDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));

  return { from: start, to: end };
}

const clean = (value: unknown, fallback: string) => {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
};

const emptyRow = (canal: string): OriginRow => ({ canal, meio: "—", campanha: "—", anuncio: "—", pedidos: 0, pagos: 0, naoPagos: 0, valorPagoCents: 0, valorNaoPagoCents: 0 });

function summarize(rows: OriginRow[]): SegmentReport {
  const add = (target: OriginRow, row: OriginRow) => {
    target.pedidos += row.pedidos;
    target.pagos += row.pagos;
    target.naoPagos += row.naoPagos;
    target.valorPagoCents += row.valorPagoCents;
    target.valorNaoPagoCents += row.valorNaoPagoCents;
  };

  const byChannel = new Map<string, OriginRow>();
  const totals = emptyRow("Total");

  for (const row of rows) {
    const channel = byChannel.get(row.canal) ?? emptyRow(row.canal);
    add(channel, row);
    byChannel.set(row.canal, channel);
    add(totals, row);
  }

  return { rows, channels: [...byChannel.values()].sort((a, b) => b.valorPagoCents - a.valorPagoCents || b.pedidos - a.pedidos), totals };
}

export async function loadSalesByOrigin(run: SqlRunner, options: { from?: string | null; to?: string | null; notArchivedSql?: string; now?: Date } = {}): Promise<SalesByOrigin> {
  const { from, to } = resolvePeriod(options.from, options.to, options.now);
  const params = [from, to];

  // orders.origin (SQL 37b) pode não existir: sem ela, nada a excluir por origem
  const hasOrigin = await run(`SELECT origin FROM orders LIMIT 0`).then(() => true, () => false);
  const where = `WHERE o.created_at >= $1::date AND o.created_at < ($2::date + 1) AND ${COUNTED}${hasOrigin ? ` AND o.origin IS NULL` : ""}${options.notArchivedSql ?? ""}`;
  const segment = `CASE WHEN o.b2b_offer_id IS NOT NULL OR o.b2b_client_id IS NOT NULL THEN 'b2b' ELSE 'b2c' END`;

  const build = (source: string, medium: string, campaign: string, content: string) => `
    SELECT ${segment} AS segmento, ${source} AS canal, ${medium} AS meio, ${campaign} AS campanha, ${content} AS anuncio,
           count(*)::int AS pedidos,
           (count(*) FILTER (WHERE ${PAID}))::int AS pagos,
           (count(*) FILTER (WHERE NOT (${PAID})))::int AS nao_pagos,
           COALESCE(sum(o.total_cents) FILTER (WHERE ${PAID}), 0)::bigint AS valor_pago,
           COALESCE(sum(o.total_cents) FILTER (WHERE NOT (${PAID})), 0)::bigint AS valor_nao_pago
      FROM orders o ${where}
     GROUP BY 1, 2, 3, 4, 5
     ORDER BY valor_pago DESC, pedidos DESC
     LIMIT 1000`;

  const variants = [
    build(`COALESCE(NULLIF(o.utm_source, ''), NULLIF(o.referrer_domain, ''), 'direto')`, `COALESCE(NULLIF(o.utm_medium, ''), '—')`, `COALESCE(NULLIF(o.utm_campaign, ''), '—')`, `COALESCE(NULLIF(o.utm_content, ''), '—')`),
    build(`COALESCE(NULLIF(o.utm_source, ''), NULLIF(o.referrer_domain, ''), 'direto')`, `COALESCE(NULLIF(o.utm_medium, ''), '—')`, `COALESCE(NULLIF(o.utm_campaign, ''), '—')`, `'—'`),
    build(`'direto'`, `'—'`, `'—'`, `'—'`),
  ];

  let data: Array<Record<string, unknown>> = [];

  for (const [index, text] of variants.entries()) {
    try {
      data = await run(text, params);
      break;
    } catch (error) {
      if (index === variants.length - 1) throw error;
    }
  }

  const toRow = (row: Record<string, unknown>): OriginRow => ({
    canal: clean(row.canal, "direto"),
    meio: clean(row.meio, "—"),
    campanha: clean(row.campanha, "—"),
    anuncio: clean(row.anuncio, "—"),
    pedidos: Number(row.pedidos ?? 0),
    pagos: Number(row.pagos ?? 0),
    naoPagos: Number(row.nao_pagos ?? 0),
    valorPagoCents: Number(row.valor_pago ?? 0),
    valorNaoPagoCents: Number(row.valor_nao_pago ?? 0),
  });

  return {
    from,
    to,
    b2c: summarize(data.filter((row) => row.segmento !== "b2b").map(toRow)),
    b2b: summarize(data.filter((row) => row.segmento === "b2b").map(toRow)),
  };
}
