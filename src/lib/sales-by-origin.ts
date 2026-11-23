/**
 * "Vendas por origem" (admin, 23/11): pedidos do B2C agrupados por canal, campanha e anúncio, pagos × não pagos, num período.
 * Só leitura e SEM dado pessoal (só contagens e valores). Origem = utm_source (ou o domínio do referrer, ou "direto"),
 * utm_medium, utm_campaign e utm_content (o anúncio). Sem as colunas novas (SQL 59b), "anúncio" fica "—"; sem as colunas da origem
 * básica (SQL 45b), tudo cai em "direto". Pedido do lojista (B2B), boleto B2B e orçamento ficam de fora.
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

export type SalesByOrigin = {
  from: string;
  to: string;
  rows: OriginRow[];
  /** Totais por canal (soma das linhas). */
  channels: OriginRow[];
  totals: OriginRow;
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

export async function loadSalesByOrigin(run: SqlRunner, options: { from?: string | null; to?: string | null; notArchivedSql?: string; now?: Date } = {}): Promise<SalesByOrigin> {
  const { from, to } = resolvePeriod(options.from, options.to, options.now);
  const params = [from, to];
  const where = `WHERE o.created_at >= $1::date AND o.created_at < ($2::date + 1) AND ${COUNTED}
      AND o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL${options.notArchivedSql ?? ""}`;

  const build = (source: string, medium: string, campaign: string, content: string) => `
    SELECT ${source} AS canal, ${medium} AS meio, ${campaign} AS campanha, ${content} AS anuncio,
           count(*)::int AS pedidos,
           (count(*) FILTER (WHERE ${PAID}))::int AS pagos,
           (count(*) FILTER (WHERE NOT (${PAID})))::int AS nao_pagos,
           COALESCE(sum(o.total_cents) FILTER (WHERE ${PAID}), 0)::bigint AS valor_pago,
           COALESCE(sum(o.total_cents) FILTER (WHERE NOT (${PAID})), 0)::bigint AS valor_nao_pago
      FROM orders o ${where}
     GROUP BY 1, 2, 3, 4
     ORDER BY valor_pago DESC, pedidos DESC
     LIMIT 500`;

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

  const rows: OriginRow[] = data.map((row) => ({
    canal: clean(row.canal, "direto"),
    meio: clean(row.meio, "—"),
    campanha: clean(row.campanha, "—"),
    anuncio: clean(row.anuncio, "—"),
    pedidos: Number(row.pedidos ?? 0),
    pagos: Number(row.pagos ?? 0),
    naoPagos: Number(row.nao_pagos ?? 0),
    valorPagoCents: Number(row.valor_pago ?? 0),
    valorNaoPagoCents: Number(row.valor_nao_pago ?? 0),
  }));

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

  const channels = [...byChannel.values()].sort((a, b) => b.valorPagoCents - a.valorPagoCents || b.pedidos - a.pedidos);

  return { from, to, rows, channels, totals };
}
