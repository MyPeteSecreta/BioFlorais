/**
 * BIO FLORAIS B2B — histórico de compras do CLIENTE por LINHA (Rodada 2,
 * 02/10/2026). UMA definição de "compra" para tudo:
 *   - início da janela de 180 dias da comissão (R6);
 *   - "nunca comprou / não compra há N meses" (promoção de abertura, R1);
 *   - contador de usos 2x/3x da promoção (R5).
 *
 * Uma compra conta quando o pedido B2B foi PAGO, ou teve BOLETO GERADO
 * (linha em b2b_boleto_requests) e não foi cancelado. Pix/cartão pendente,
 * expirado ou recusado NÃO conta. A data da compra é orders.created_at.
 * Só o contador de usos (R5) também RESERVA o uso para pedido Pix/cartão
 * pendente criado há menos de 60 min.
 *
 * Regras e prazos são do CLIENTE (cliente + marca + linha), nunca do
 * vendedor: trocar de vendedor não reinicia nada (R3).
 *
 * SQL puro sobre SqlRunner (roda no Neon e no PGlite dos testes) + funções
 * puras para as decisões.
 */

import { andNotArchived } from "@/lib/b2b/archive";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { isUuid } from "@/lib/b2b/admin-input";
import { commissionWindowFor, type CommissionWindow } from "@/lib/b2b/commission-window";

export const RECONQUISTA_MESES_PADRAO = 6;
export const RESERVA_PENDENTE_MINUTOS = 60;

/** Janela de 180 dias: por LINHA (interpretação da mestre) ou por MARCA. Troca aqui. */
export const COMMISSION_WINDOW_SCOPE: "line" | "brand" = "line";

export type PromotionType = "abertura_reconquista" | "recorrente";

const NOT_COUNTED_STATUSES = `'cancelled','canceled','failed','expired','refunded','rejected'`;

/** Pedido B2B que conta como compra (R4). `o` = alias da tabela orders. */
export function countsAsPurchaseSql(o = "o") {
  return `(${o}.b2b_offer_id IS NOT NULL AND (
      ${o}.status = 'paid'
      OR (${o}.payment_method = 'boleto'
          AND ${o}.status NOT IN (${NOT_COUNTED_STATUSES})
          AND EXISTS (SELECT 1 FROM b2b_boleto_requests br WHERE br.order_id = ${o}.id))))`;
}

/** Pedido Pix/cartão pendente há menos de 60 min: reserva o uso da promoção (R5). */
export function reservesUseSql(o = "o") {
  return `(${o}.status = 'pending' AND ${o}.payment_method IN ('pix', 'card')
      AND ${o}.created_at > ((now() AT TIME ZONE 'UTC') - interval '${RESERVA_PENDENTE_MINUTOS} minutes'))`;
}

export type LinePurchase = { groupId: string; orderId: string; at: Date };

/**
 * Compras do cliente por linha (produto pago > 0 em produto da linha).
 * `excludeOfferId`: ignora os pedidos dessa oferta (usado para decidir se a
 * promoção de ABERTURA da própria oferta ainda vale, sem que a compra feita
 * por ela a invalide).
 */
export async function loadClientPurchases(
  run: SqlRunner,
  clientId: string,
  excludeOfferId?: string | null
): Promise<LinePurchase[]> {
  if (!isUuid(clientId)) return [];

  const notArchived = await andNotArchived(run, "orders", "o");
  const rows = await run(
    `SELECT DISTINCT gp.commercial_group_id AS group_id, o.id AS order_id,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at
       FROM orders o
       JOIN order_items i ON i.order_id = o.id AND i.unit_price_cents > 0
       JOIN b2b_commercial_group_products gp ON gp.product_id = i.product_id
      WHERE o.b2b_client_id = $1${notArchived}
        AND ${countsAsPurchaseSql("o")}
        AND ($2::uuid IS NULL OR o.b2b_offer_id IS DISTINCT FROM $2::uuid)
      ORDER BY at`,
    [clientId, excludeOfferId && isUuid(excludeOfferId) ? excludeOfferId : null]
  );

  return rows.map((row) => ({
    groupId: String(row.group_id),
    orderId: String(row.order_id),
    at: new Date(String(row.at)),
  }));
}

/** Meses sem compra para valer reconquista (admin: b2b_settings.reconquista_meses). */
export async function loadReconquistaMonths(run: SqlRunner): Promise<number> {
  try {
    const [row] = await run(`SELECT value FROM b2b_settings WHERE key = 'reconquista_meses'`);
    const months = Number(row?.value);
    return Number.isInteger(months) && months >= 1 && months <= 60 ? months : RECONQUISTA_MESES_PADRAO;
  } catch {
    return RECONQUISTA_MESES_PADRAO; // SQL 14b ainda não aplicado
  }
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export type LineHistory = {
  firstAt: Date | null;
  lastAt: Date | null;
  /** Início do ciclo atual (sem lacuna maior que `meses` entre compras). */
  cycleStart: Date | null;
  /** Sem compra há mais de `meses`: reconquista; o próximo pedido abre ciclo novo. */
  lapsed: boolean;
  /** Quando a abertura volta a valer (última compra + meses); null se nunca comprou. */
  reopensAt: Date | null;
};

/** Histórico de UM conjunto de datas (uma linha, ou a marca inteira). */
export function buildHistory(dates: Date[], now: Date, months: number): LineHistory {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 0) {
    return { firstAt: null, lastAt: null, cycleStart: null, lapsed: false, reopensAt: null };
  }

  let cycleStart = sorted[0];

  for (let index = 1; index < sorted.length; index++) {
    // Compra depois de mais de `meses` sem comprar = reconquista = ciclo novo.
    if (sorted[index].getTime() > addMonths(sorted[index - 1], months).getTime()) {
      cycleStart = sorted[index];
    }
  }

  const lastAt = sorted[sorted.length - 1];
  const reopensAt = addMonths(lastAt, months);

  return {
    firstAt: sorted[0],
    lastAt,
    cycleStart,
    lapsed: now.getTime() > reopensAt.getTime(),
    reopensAt,
  };
}

export function historyForGroup(purchases: LinePurchase[], groupId: string, now: Date, months: number) {
  return buildHistory(
    purchases.filter((purchase) => purchase.groupId === groupId).map((purchase) => purchase.at),
    now,
    months
  );
}

const brDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date);

export type PromotionAvailability = { available: boolean; reason: string };

/**
 * R1/R2: recorrente vale para qualquer cliente; abertura/reconquista só para
 * quem nunca comprou a linha ou está sem comprá-la há mais de `meses`.
 */
export function promotionAvailability(
  promoType: PromotionType,
  history: LineHistory
): PromotionAvailability {
  if (promoType === "recorrente") {
    return { available: true, reason: "Disponível: promoção para cliente recorrente" };
  }

  if (!history.lastAt) {
    return { available: true, reason: "Disponível: cliente nunca comprou esta linha" };
  }

  if (history.lapsed) {
    return {
      available: true,
      reason: `Disponível: sem compras nesta linha desde ${brDate(history.lastAt)} (reconquista)`,
    };
  }

  return {
    available: false,
    reason: `Indisponível: cliente comprou esta linha em ${brDate(history.lastAt)}; abertura volta a valer em ${brDate(history.reopensAt!)}`,
  };
}

/**
 * Janela de 180 dias da comissão (R6) para um item. `groupIds` = linhas da
 * OFERTA a que o produto pertence. Parametrizado por COMMISSION_WINDOW_SCOPE.
 * Linha em reconquista (ou nunca comprada): janela ainda não começou, o
 * próximo pedido abre o ciclo.
 */
export function commissionWindowForItem(
  purchases: LinePurchase[],
  groupIds: string[],
  now: Date,
  months: number,
  scope: "line" | "brand" = COMMISSION_WINDOW_SCOPE
): CommissionWindow {
  const histories =
    scope === "brand"
      ? [buildHistory(purchases.map((purchase) => purchase.at), now, months)]
      : (groupIds.length > 0 ? groupIds : [""]).map((groupId) => historyForGroup(purchases, groupId, now, months));

  const windows = histories.map((history) =>
    commissionWindowFor(history.lapsed ? null : history.cycleStart, now)
  );

  // Produto em mais de uma linha da oferta: vale a janela mais favorável (aberta).
  return windows.find((window) => window.open) ?? windows[0];
}

/**
 * Usos da promoção POR LINHA da oferta (chave "<promoção>:<linha>"): um pedido conta na linha
 * cujos produtos ele bonificou/descontou; compra em outra linha não gasta o limite desta.
 * Linha legada (sem linha gravada) conta o total da promoção.
 */
export async function loadPromotionUsesByLine(run: SqlRunner, offerId: string): Promise<Map<string, number>> {
  if (!isUuid(offerId)) return new Map();

  const notArchived = await andNotArchived(run, "orders", "o");
  const rows = await run(
    `SELECT op.promotion_id AS promotion_id, op.commercial_group_id AS group_id, count(DISTINCT o.id)::int AS used
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
       JOIN b2b_offer_promotions op ON op.offer_id = o.b2b_offer_id AND op.promotion_id::text = i.promotion_id
      WHERE o.b2b_offer_id = $1${notArchived}
        AND i.promotion_id IS NOT NULL
        AND (${countsAsPurchaseSql("o")} OR ${reservesUseSql("o")})
        AND (op.commercial_group_id IS NULL OR EXISTS (
              SELECT 1 FROM b2b_commercial_group_products gp
               WHERE gp.commercial_group_id = op.commercial_group_id AND gp.product_id = i.product_id))
      GROUP BY op.promotion_id, op.commercial_group_id`,
    [offerId]
  );

  return new Map(rows.map((row) => [`${String(row.promotion_id)}:${row.group_id ? String(row.group_id) : ""}`, Number(row.used)]));
}

/** Usos da promoção na oferta (R5): pedidos que a bonificaram e contam como compra ou reservam. */
export async function loadPromotionUses(run: SqlRunner, offerId: string): Promise<Map<string, number>> {
  if (!isUuid(offerId)) return new Map();

  const notArchived = await andNotArchived(run, "orders", "o");
  const rows = await run(
    `SELECT i.promotion_id AS promotion_id, count(DISTINCT o.id)::int AS used
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
      WHERE o.b2b_offer_id = $1${notArchived}
        AND i.promotion_id IS NOT NULL
        AND (${countsAsPurchaseSql("o")} OR ${reservesUseSql("o")})
      GROUP BY i.promotion_id`,
    [offerId]
  );

  return new Map(rows.map((row) => [String(row.promotion_id), Number(row.used)]));
}
