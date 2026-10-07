/**
 * V5: registros ARQUIVADOS (dados de teste) somem de listas, painéis, comissões, boletos,
 * Central/Omie e acompanhamento. As colunas archived_at vêm do SQL 32b; antes dele o filtro
 * simplesmente não existe (nada quebra em produção). Positivo é lembrado; negativo é
 * reverificado a cada 30 s.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

type Table = "orders" | "b2b_responsibles" | "b2b_clients";

const cache = new Map<Table, { ready: boolean; at: number }>();
const NEGATIVE_TTL_MS = 30_000;

export function resetArchiveCache() {
  cache.clear();
}

async function columnReady(run: SqlRunner, table: Table) {
  const hit = cache.get(table);

  if (hit && (hit.ready || Date.now() - hit.at < NEGATIVE_TTL_MS)) return hit.ready;

  let ready = false;

  try {
    const rows = await run(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'archived_at' LIMIT 1`,
      [table]
    );

    ready = rows.length > 0;
  } catch {
    ready = false;
  }

  cache.set(table, { ready, at: Date.now() });

  return ready;
}

/** Condição SQL "não arquivado" para a tabela (alias opcional); "TRUE" se o SQL 32b não foi aplicado. */
export async function notArchivedCondition(run: SqlRunner, table: Table, alias: string = table) {
  return (await columnReady(run, table)) ? `${alias}.archived_at IS NULL` : "TRUE";
}

/** Mesmo, para anexar a um WHERE existente: " AND o.archived_at IS NULL" ou "". */
export async function andNotArchived(run: SqlRunner, table: Table, alias: string = table) {
  return (await columnReady(run, table)) ? ` AND ${alias}.archived_at IS NULL` : "";
}
