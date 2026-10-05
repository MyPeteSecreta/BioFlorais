/**
 * BIO FLORAIS B2B — "Minhas comissões" do vendedor e baixa pelo admin (C9).
 *
 * PADRÃO (o Luis confirma):
 *  - base = valor PAGO dos produtos (total do pedido menos o frete, ou seja,
 *    depois de promoção, cupom e desconto Pix/cartão);
 *  - % = média ponderada pelo valor de cada item do snapshot congelado no
 *    pedido (base + extra = total); comissão = base x %;
 *  - a comissão fica "A receber" no dia 10 do mês seguinte ao RECEBIMENTO do
 *    dinheiro; pedido cancelado/estornado zera;
 *  - boleto: NUNCA pela data de vencimento. Só depois da BAIXA da parcela
 *    (C10). Enquanto não houver baixa, fica "Aguardando pagamento".
 *
 * A data de recebimento de Pix/cartão é a do pagamento confirmado
 * (payments.created_at do pagamento "paid"; a Bio ainda não guarda paid_at —
 * o webhook/finalizador é compartilhado com o B2C e não foi alterado).
 * Só leitura sobre pedidos; o único dado novo é b2b_commission_payouts
 * (sql/b2b/18b), com a data em que o admin pagou a comissão ao vendedor.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { loadCompletedVendorIds } from "@/lib/b2b/vendor-profile";
import { loadBoletoInstallments, type BoletoInstallment } from "@/lib/b2b/boleto-installments";
import { isUuid } from "@/lib/b2b/admin-input";

/** "retida": já seria "a receber", mas o vendedor ainda não completou o cadastro. */
export type CommissionState = "aguardando" | "a_receber" | "retida" | "paga" | "cancelada";

/** Um item do pedido na abertura da comissão (base R$, % e comissão R$ do item). */
export type CommissionItem = {
  /** Nome completo: "Shampoo Agressividade · Cosméticos Pet · 500 ml". */
  name: string;
  qty: number;
  /** Item bonificado (valor 0): aparece como "bonificado", sem base nem comissão. */
  bonified: boolean;
  basePercent: number | null;
  extraPercent: number | null;
  totalPercent: number | null;
  /** Base de cálculo do item em R$ (parte do valor pago dos produtos, sem frete). */
  baseCents: number;
  commissionCents: number | null;
};

export type CommissionRow = {
  /** Itens do pedido (na parcela do boleto, proporcionais ao valor da parcela). */
  items: CommissionItem[];
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  responsibleId: string;
  responsibleName: string;
  clientId: string | null;
  clientName: string;
  paymentMethod: string | null;
  orderStatus: string;
  baseCents: number;
  /** Média ponderada pelo valor dos itens; null = pedido sem snapshot de comissão. */
  basePercent: number | null;
  extraPercent: number | null;
  totalPercent: number | null;
  commissionCents: number | null;
  basis: string | null;
  receivedAt: Date | null;
  payableOn: Date | null;
  paidOutAt: Date | null;
  state: CommissionState;
  /** Boleto: nº da parcela (a comissão é por parcela, pela data da BAIXA); 0 = pedido inteiro (Pix/cartão). */
  installment: number;
  installmentLabel: string | null;
};

const CANCELLED = new Set(["cancelled", "canceled", "failed", "expired", "refunded", "rejected"]);

/** Dia 10 do mês seguinte ao recebimento (data civil de São Paulo, devolvida às 12:00 UTC). */
export function payableOnFor(receivedAt: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(receivedAt)
    .split("-")
    .map(Number);

  return new Date(Date.UTC(parts[0], parts[1] /* mês seguinte (0-based = parts[1]) */, 10, 12, 0, 0));
}

export function commissionState(input: {
  orderStatus: string;
  paymentMethod: string | null;
  receivedAt: Date | null;
  paidOutAt: Date | null;
  /** Boleto: a PARCELA foi baixada (o pedido só vira "paid" quando todas forem). */
  parcelBaixada?: boolean;
}): CommissionState {
  if (CANCELLED.has(input.orderStatus)) return "cancelada";
  if (input.paidOutAt) return "paga";
  if (input.orderStatus !== "paid" && !input.parcelBaixada) return "aguardando";
  // Boleto: sem baixa (receivedAt) não é "a receber", nunca pelo vencimento.
  if (!input.receivedAt) return "aguardando";
  return "a_receber";
}

export const STATE_LABEL: Record<CommissionState, string> = {
  aguardando: "Aguardando pagamento",
  a_receber: "A receber",
  retida: "Retida até completar o cadastro",
  paga: "Paga",
  cancelada: "Cancelada",
};

export type CommissionFilters = {
  /** Vendedor da sessão (painel) ou, no admin, opcional. */
  responsibleId?: string | null;
  clientId?: string | null;
  /** AAAA-MM do mês do PEDIDO. */
  month?: string | null;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Pedidos B2B com a comissão calculada. `responsibleId` filtra NO SQL: o
 * vendedor só enxerga os próprios pedidos (b2b_responsible_id do pedido).
 */
export async function loadCommissionRows(run: SqlRunner, filters: CommissionFilters): Promise<CommissionRow[]> {
  const responsibleId = filters.responsibleId && isUuid(filters.responsibleId) ? filters.responsibleId : null;
  const clientId = filters.clientId && isUuid(filters.clientId) ? filters.clientId : null;
  const month = filters.month && MONTH_RE.test(filters.month) ? filters.month : null;

  const query = `SELECT o.id, o.status, o.payment_method, o.total_cents, o.shipping_cents,
            o.b2b_responsible_id, o.b2b_client_id,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            coalesce(o.b2b_responsible_name, r.name, '') AS responsible_name,
            coalesce(c.display_name, '') AS client_name,
            w.base_pct, w.extra_pct, w.total_pct, w.basis,
            CASE WHEN o.payment_method = 'boleto' THEN NULL
                 ELSE to_char(coalesce(
                        (SELECT min(p.created_at) FROM payments p WHERE p.order_id = o.id AND p.status = 'paid'),
                        o.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END AS received_at,
            NULL::text AS paid_out_at
       FROM orders o
       LEFT JOIN b2b_responsibles r ON r.id = o.b2b_responsible_id
       LEFT JOIN b2b_clients c ON c.id = o.b2b_client_id
       LEFT JOIN LATERAL (
         SELECT sum(i.unit_price_cents::numeric * i.qty * i.commission_base_percent) / nullif(sum(i.unit_price_cents::numeric * i.qty), 0) AS base_pct,
                sum(i.unit_price_cents::numeric * i.qty * i.commission_extra_percent) / nullif(sum(i.unit_price_cents::numeric * i.qty), 0) AS extra_pct,
                sum(i.unit_price_cents::numeric * i.qty * i.commission_total_percent) / nullif(sum(i.unit_price_cents::numeric * i.qty), 0) AS total_pct,
                string_agg(DISTINCT i.commission_basis, ', ') AS basis
           FROM order_items i
          WHERE i.order_id = o.id AND i.unit_price_cents > 0 AND i.commission_total_percent IS NOT NULL
       ) w ON true
      WHERE o.b2b_offer_id IS NOT NULL
        AND ($1::uuid IS NULL OR o.b2b_responsible_id = $1::uuid)
        AND ($2::uuid IS NULL OR o.b2b_client_id = $2::uuid)
        AND ($3::text IS NULL OR to_char(o.created_at, 'YYYY-MM') = $3::text)
      ORDER BY o.created_at DESC
      LIMIT 500`;
  const params = [responsibleId, clientId, month];

  const rows = await run(query, params);

  // Pagamentos da comissão ao vendedor (por pedido; boleto: por parcela). Tolera o SQL 18b/20b ausente.
  const orderIds = rows.map((row) => String(row.id));
  const payouts = new Map<string, Date>();

  if (orderIds.length > 0) {
    let payoutRows: Awaited<ReturnType<SqlRunner>> = [];

    try {
      payoutRows = await run(
        `SELECT order_id, installment, to_char(paid_at, 'YYYY-MM-DD"T"12:00:00"Z"') AS paid_at
           FROM b2b_commission_payouts WHERE order_id = ANY($1::uuid[])`,
        [orderIds]
      );
    } catch {
      try {
        payoutRows = await run(
          `SELECT order_id, 0 AS installment, to_char(paid_at, 'YYYY-MM-DD"T"12:00:00"Z"') AS paid_at
             FROM b2b_commission_payouts WHERE order_id = ANY($1::uuid[])`,
          [orderIds]
        );
      } catch (error) {
        console.error("[b2b/commissions] sem b2b_commission_payouts", error);
      }
    }

    for (const row of payoutRows) {
      payouts.set(`${row.order_id}:${row.installment}`, new Date(String(row.paid_at)));
    }
  }

  // Boleto: cada PARCELA é uma linha, pela data da BAIXA (nunca pelo vencimento). Tolera o SQL 20b ausente.
  const installmentsByOrder = new Map<string, BoletoInstallment[]>();

  if (rows.some((row) => row.payment_method === "boleto")) {
    try {
      const all = await loadBoletoInstallments(run, { responsibleId, clientId });

      for (const item of all) {
        const list = installmentsByOrder.get(item.orderId) ?? [];
        list.push(item);
        installmentsByOrder.set(item.orderId, list);
      }
    } catch (error) {
      console.error("[b2b/commissions] sem baixa de boleto (SQL 20b?)", error);
    }
  }

  // Itens de cada pedido (produto, snapshot de comissão), para abrir o pedido na tela.
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();

  if (orderIds.length > 0) {
    const itemRows = await run(
      `SELECT i.order_id, i.qty, i.unit_price_cents, i.commission_base_percent, i.commission_extra_percent,
              i.commission_total_percent, p.slug, p.name, p.category, p.line_slug
         FROM order_items i LEFT JOIN products p ON p.id = i.product_id
        WHERE i.order_id = ANY($1::uuid[])
        ORDER BY i.unit_price_cents DESC, p.name`,
      [orderIds]
    );

    for (const item of itemRows) {
      const list = itemsByOrder.get(String(item.order_id)) ?? [];
      list.push(item);
      itemsByOrder.set(String(item.order_id), list);
    }
  }

  /** Itens com a base repartida proporcionalmente ao valor; `rowBase` = base da linha (pedido ou parcela). */
  const buildItems = (orderId: string, rowBase: number): CommissionItem[] => {
    const raw = itemsByOrder.get(orderId) ?? [];
    const sum = raw.reduce((total, item) => total + Number(item.unit_price_cents ?? 0) * Number(item.qty ?? 0), 0);

    return raw.map((item) => {
      const value = Number(item.unit_price_cents ?? 0) * Number(item.qty ?? 0);
      const pct = (field: string) =>
        item[field] === null || item[field] === undefined ? null : Math.round(Number(item[field]) * 100) / 100;
      const totalPercent = pct("commission_total_percent");
      const bonified = value === 0;
      const baseCents = bonified || sum === 0 ? 0 : Math.round((rowBase * value) / sum);

      return {
        name: b2bProductLabel({
          slug: String(item.slug ?? ""),
          name: String(item.name ?? "Produto"),
          category: (item.category as string | null) ?? null,
          lineSlug: (item.line_slug as string | null) ?? null,
        }).full,
        qty: Number(item.qty ?? 0),
        bonified,
        basePercent: pct("commission_base_percent"),
        extraPercent: pct("commission_extra_percent"),
        totalPercent,
        baseCents,
        commissionCents: bonified || totalPercent === null ? null : Math.round((baseCents * totalPercent) / 100),
      };
    });
  };

  const result: CommissionRow[] = [];

  for (const row of rows) {
    const orderId = String(row.id);
    const orderStatus = String(row.status ?? "");
    const paymentMethod = (row.payment_method as string | null) ?? null;
    const orderBaseCents = Math.max(0, Number(row.total_cents ?? 0) - Number(row.shipping_cents ?? 0));
    const totalPercent = row.total_pct === null || row.total_pct === undefined ? null : Number(row.total_pct);

    const common = {
      orderId,
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      createdAt: new Date(String(row.created_at)),
      responsibleId: String(row.b2b_responsible_id ?? ""),
      responsibleName: String(row.responsible_name ?? ""),
      clientId: row.b2b_client_id ? String(row.b2b_client_id) : null,
      clientName: String(row.client_name ?? ""),
      paymentMethod,
      orderStatus,
      basePercent: row.base_pct === null || row.base_pct === undefined ? null : Math.round(Number(row.base_pct) * 100) / 100,
      extraPercent: row.extra_pct === null || row.extra_pct === undefined ? null : Math.round(Number(row.extra_pct) * 100) / 100,
      totalPercent: totalPercent === null ? null : Math.round(totalPercent * 100) / 100,
      basis: (row.basis as string | null) ?? null,
    };

    const parcels = paymentMethod === "boleto" ? installmentsByOrder.get(orderId) : undefined;

    if (parcels && parcels.length > 0) {
      const sum = parcels.reduce((total, parcel) => total + parcel.amountCents, 0) || 1;
      let allocated = 0;

      parcels.forEach((parcel, index) => {
        // Base da parcela proporcional ao valor dela; a última absorve o arredondamento.
        const baseCents =
          index === parcels.length - 1 ? orderBaseCents - allocated : Math.round((orderBaseCents * parcel.amountCents) / sum);
        allocated += baseCents;

        const receivedAt = parcel.paidAt ? new Date(`${parcel.paidAt}T12:00:00Z`) : null;
        const paidOutAt = payouts.get(`${orderId}:${parcel.installment}`) ?? null;
        const state = commissionState({ orderStatus, paymentMethod, receivedAt, paidOutAt, parcelBaixada: Boolean(receivedAt) });

        result.push({
          ...common,
          items: buildItems(orderId, baseCents),
          baseCents,
          commissionCents: totalPercent === null ? null : Math.round((baseCents * totalPercent) / 100),
          receivedAt,
          payableOn: state === "a_receber" || state === "paga" ? (receivedAt ? payableOnFor(receivedAt) : null) : null,
          paidOutAt,
          state,
          installment: parcel.installment,
          installmentLabel: `${parcel.installment}/${parcel.installments}`,
        });
      });

      continue;
    }

    const receivedAt = row.received_at ? new Date(String(row.received_at)) : null;
    const paidOutAt = payouts.get(`${orderId}:0`) ?? null;
    const state = commissionState({ orderStatus, paymentMethod, receivedAt, paidOutAt });

    result.push({
      ...common,
      items: buildItems(orderId, orderBaseCents),
      baseCents: orderBaseCents,
      commissionCents: totalPercent === null ? null : Math.round((orderBaseCents * totalPercent) / 100),
      receivedAt,
      payableOn: state === "a_receber" || state === "paga" ? (receivedAt ? payableOnFor(receivedAt) : null) : null,
      paidOutAt,
      state,
      installment: 0,
      installmentLabel: null,
    });
  }

  // Vendedor sem cadastro completo: a comissão ACUMULA, mas fica retida (libera ao completar).
  const completed = await loadCompletedVendorIds(run, Array.from(new Set(result.map((row) => row.responsibleId))));

  for (const row of result) {
    if (row.state === "a_receber" && row.responsibleId && !completed.has(row.responsibleId)) {
      row.state = "retida";
    }
  }

  return result;
}

export type CommissionTotals = {
  /** A receber no próximo dia 10 (inclui o que já venceu e não foi pago). */
  nextTenthCents: number;
  nextTenthDate: Date | null;
  /** A receber nos meses seguintes. */
  laterCents: number;
  /** Já pago ao vendedor. */
  receivedCents: number;
  /** Aguardando pagamento do pedido (ainda não é "a receber"). */
  waitingCents: number;
  /** Retida até o vendedor completar o cadastro. */
  heldCents: number;
};

/** Totais (só linhas com comissão calculada). `now` define qual é o "próximo dia 10". */
export function totalsFor(rows: CommissionRow[], now = new Date()): CommissionTotals {
  const totals: CommissionTotals = { nextTenthCents: 0, nextTenthDate: null, laterCents: 0, receivedCents: 0, waitingCents: 0, heldCents: 0 };
  const open = rows.filter((row) => row.state === "a_receber" && row.payableOn && row.commissionCents !== null);

  // Próximo dia 10 = a menor data de pagamento ainda não passada; vencidas entram nele.
  const upcoming = open
    .map((row) => row.payableOn!.getTime())
    .filter((time) => time >= now.getTime() - 24 * 60 * 60 * 1000);
  const next = upcoming.length > 0 ? Math.min(...upcoming) : null;
  totals.nextTenthDate = next === null ? null : new Date(next);

  for (const row of rows) {
    if (row.commissionCents === null) continue;

    if (row.state === "paga") totals.receivedCents += row.commissionCents;
    else if (row.state === "retida") totals.heldCents += row.commissionCents;
    else if (row.state === "aguardando") totals.waitingCents += row.commissionCents;
    else if (row.state === "a_receber" && row.payableOn) {
      if (next !== null && row.payableOn.getTime() > next) totals.laterCents += row.commissionCents;
      else totals.nextTenthCents += row.commissionCents;
    }
  }

  return totals;
}
