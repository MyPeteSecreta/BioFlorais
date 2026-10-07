/**
 * V5: limpeza dos dados de TESTE sem apagar nada. Candidatos (nome/e-mail com "teste",
 * @example.invalid, pedidos com o cupom TESTEB2B95 ou ligados a vendedor/cliente de teste),
 * arquivar (some das listas; vendedor/cliente ficam inativos) e desfazer por lote.
 * Pedido pago de verdade (pago, sem o cupom de teste) só é arquivado com confirmação linha a linha.
 */

import { randomUUID } from "node:crypto";

import type { SqlRunner } from "@/lib/b2b/ownership";
import { isUuid } from "@/lib/b2b/admin-input";

export const TEST_COUPON = "TESTEB2B95";

export type TestCandidates = {
  responsibles: Array<{ id: string; name: string; email: string; status: string }>;
  clients: Array<{ id: string; name: string; email: string | null }>;
  orders: Array<{
    id: string;
    number: string;
    status: string;
    totalCents: number;
    createdAt: string;
    reason: string;
    /** Pago sem o cupom de teste: exige confirmação explícita para arquivar. */
    paidForReal: boolean;
  }>;
};

const IS_TEST_VENDOR = `(r.name ILIKE '%teste%' OR r.email ILIKE '%teste%' OR r.email ILIKE '%@example.invalid')`;
const IS_TEST_CLIENT = `(c.display_name ILIKE '%teste%' OR coalesce(c.email, '') ILIKE '%teste%' OR coalesce(c.email, '') ILIKE '%@example.invalid' OR coalesce(c.contact_name, '') ILIKE '%teste%')`;

async function hasArchiveColumns(run: SqlRunner) {
  const rows = await run(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND column_name = 'archived_at' AND table_name IN ('orders', 'b2b_responsibles', 'b2b_clients')`
  );

  return Number(rows[0]?.n ?? 0) === 3;
}

/** Só leitura: o que seria arquivado (não inclui o que já está arquivado). */
export async function listTestCandidates(run: SqlRunner): Promise<TestCandidates> {
  const ready = await hasArchiveColumns(run);
  const notArchived = (alias: string) => (ready ? `AND ${alias}.archived_at IS NULL` : "");

  const responsibles = await run(
    `SELECT r.id, r.name, r.email, r.status FROM b2b_responsibles r WHERE ${IS_TEST_VENDOR} ${notArchived("r")} ORDER BY r.created_at DESC`
  );
  const clients = await run(
    `SELECT c.id, c.display_name, c.email FROM b2b_clients c WHERE ${IS_TEST_CLIENT} ${notArchived("c")} ORDER BY c.created_at DESC`
  );
  const orders = await run(
    `SELECT o.id, o.status, o.total_cents,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            upper(coalesce(o.coupon_code, '')) = '${TEST_COUPON}' AS coupon_test,
            (o.b2b_responsible_id IN (SELECT r.id FROM b2b_responsibles r WHERE ${IS_TEST_VENDOR})) AS vendor_test,
            (o.b2b_client_id IN (SELECT c.id FROM b2b_clients c WHERE ${IS_TEST_CLIENT})) AS client_test
       FROM orders o
      WHERE (upper(coalesce(o.coupon_code, '')) = '${TEST_COUPON}'
             OR o.b2b_responsible_id IN (SELECT r.id FROM b2b_responsibles r WHERE ${IS_TEST_VENDOR})
             OR o.b2b_client_id IN (SELECT c.id FROM b2b_clients c WHERE ${IS_TEST_CLIENT}))
        ${notArchived("o")}
      ORDER BY o.created_at DESC
      LIMIT 500`
  );

  return {
    responsibles: responsibles.map((row) => ({ id: String(row.id), name: String(row.name), email: String(row.email), status: String(row.status) })),
    clients: clients.map((row) => ({ id: String(row.id), name: String(row.display_name), email: (row.email as string | null) ?? null })),
    orders: orders.map((row) => {
      const couponTest = row.coupon_test === true;

      return {
        id: String(row.id),
        number: String(row.id).slice(0, 8).toUpperCase(),
        status: String(row.status),
        totalCents: Number(row.total_cents ?? 0),
        createdAt: String(row.created_at),
        reason: couponTest ? `cupom ${TEST_COUPON}` : row.vendor_test === true ? "vendedor de teste" : "cliente de teste",
        paidForReal: String(row.status) === "paid" && !couponTest,
      };
    }),
  };
}

export type ArchiveInput = {
  responsibleIds?: string[];
  clientIds?: string[];
  orderIds?: string[];
  /** Pedidos pagos de verdade que o admin confirmou, um a um. */
  confirmedPaidOrderIds?: string[];
};

export type ArchiveResult = {
  batchId: string;
  responsibles: number;
  clients: number;
  orders: number;
  /** Pagos de verdade que ficaram de fora por falta de confirmação. */
  skippedPaid: string[];
};

const ids = (list: unknown) => (Array.isArray(list) ? [...new Set(list.map(String).filter(isUuid))] : []);

/**
 * Arquiva (nada é apagado). Pedidos dos vendedores/clientes arquivados herdam o arquivamento, exceto
 * os pagos de verdade sem confirmação. Vendedor vira "inactive" e cliente "active = false"
 * (o estado anterior fica no log para desfazer).
 */
export async function archiveSelected(run: SqlRunner, input: ArchiveInput): Promise<ArchiveResult> {
  const responsibleIds = ids(input.responsibleIds);
  const clientIds = ids(input.clientIds);
  const orderIds = ids(input.orderIds);
  const confirmed = new Set(ids(input.confirmedPaidOrderIds));
  const batchId = randomUUID();

  // Pedidos herdados dos vendedores/clientes arquivados.
  const inherited = await run(
    `SELECT id FROM orders WHERE (b2b_responsible_id = ANY($1::uuid[]) OR b2b_client_id = ANY($2::uuid[])) AND archived_at IS NULL`,
    [responsibleIds, clientIds]
  );
  const wanted = [...new Set([...orderIds, ...inherited.map((row) => String(row.id))])];

  const orderRows = wanted.length
    ? await run(
        `SELECT id, status, upper(coalesce(coupon_code, '')) = '${TEST_COUPON}' AS coupon_test FROM orders WHERE id = ANY($1::uuid[]) AND archived_at IS NULL`,
        [wanted]
      )
    : [];

  const toArchive: string[] = [];
  const skippedPaid: string[] = [];

  for (const row of orderRows) {
    const paidForReal = String(row.status) === "paid" && row.coupon_test !== true;

    if (paidForReal && !confirmed.has(String(row.id))) skippedPaid.push(String(row.id));
    else toArchive.push(String(row.id));
  }

  const vendors = responsibleIds.length
    ? await run(`SELECT id, status FROM b2b_responsibles WHERE id = ANY($1::uuid[]) AND archived_at IS NULL`, [responsibleIds])
    : [];
  const clients = clientIds.length
    ? await run(`SELECT id, active FROM b2b_clients WHERE id = ANY($1::uuid[]) AND archived_at IS NULL`, [clientIds])
    : [];

  for (const row of vendors) {
    await run(`INSERT INTO b2b_archive_log (batch_id, entity_type, entity_id, previous_status) VALUES ($1, 'responsible', $2, $3)`, [batchId, row.id, row.status]);
  }

  for (const row of clients) {
    await run(`INSERT INTO b2b_archive_log (batch_id, entity_type, entity_id, previous_status) VALUES ($1, 'client', $2, $3)`, [batchId, row.id, row.active === false ? "inactive" : "active"]);
  }

  for (const id of toArchive) {
    await run(`INSERT INTO b2b_archive_log (batch_id, entity_type, entity_id) VALUES ($1, 'order', $2)`, [batchId, id]);
  }

  if (vendors.length) {
    await run(
      `UPDATE b2b_responsibles SET is_test = true, archived_at = now(), status = 'inactive', updated_at = now() WHERE id = ANY($1::uuid[])`,
      [vendors.map((row) => row.id)]
    );
  }

  if (clients.length) {
    await run(`UPDATE b2b_clients SET is_test = true, archived_at = now(), active = false, updated_at = now() WHERE id = ANY($1::uuid[])`, [clients.map((row) => row.id)]);
  }

  if (toArchive.length) {
    await run(`UPDATE orders SET is_test = true, archived_at = now() WHERE id = ANY($1::uuid[])`, [toArchive]);
  }

  return { batchId, responsibles: vendors.length, clients: clients.length, orders: toArchive.length, skippedPaid };
}

/** Desfaz um lote: volta o status anterior e tira do arquivo. */
export async function restoreBatch(run: SqlRunner, batchId: string): Promise<{ restored: number }> {
  if (!isUuid(batchId)) return { restored: 0 };

  const rows = await run(`SELECT entity_type, entity_id, previous_status FROM b2b_archive_log WHERE batch_id = $1 AND restored_at IS NULL`, [batchId]);

  for (const row of rows) {
    if (row.entity_type === "responsible") {
      await run(`UPDATE b2b_responsibles SET is_test = false, archived_at = NULL, status = coalesce($2, status), updated_at = now() WHERE id = $1`, [row.entity_id, row.previous_status]);
    } else if (row.entity_type === "client") {
      await run(`UPDATE b2b_clients SET is_test = false, archived_at = NULL, active = ($2 <> 'inactive'), updated_at = now() WHERE id = $1`, [row.entity_id, row.previous_status ?? "active"]);
    } else {
      await run(`UPDATE orders SET is_test = false, archived_at = NULL WHERE id = $1`, [row.entity_id]);
    }
  }

  await run(`UPDATE b2b_archive_log SET restored_at = now() WHERE batch_id = $1 AND restored_at IS NULL`, [batchId]);

  return { restored: rows.length };
}

/** Lotes já feitos (para o admin desfazer). */
export async function listBatches(run: SqlRunner) {
  const rows = await run(
    `SELECT batch_id, min(to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS at,
            count(*) FILTER (WHERE entity_type = 'responsible')::int AS responsibles,
            count(*) FILTER (WHERE entity_type = 'client')::int AS clients,
            count(*) FILTER (WHERE entity_type = 'order')::int AS orders,
            bool_and(restored_at IS NOT NULL) AS restored
       FROM b2b_archive_log GROUP BY batch_id ORDER BY min(created_at) DESC LIMIT 20`
  );

  return rows.map((row) => ({
    batchId: String(row.batch_id),
    at: String(row.at),
    responsibles: Number(row.responsibles),
    clients: Number(row.clients),
    orders: Number(row.orders),
    restored: row.restored === true,
  }));
}
