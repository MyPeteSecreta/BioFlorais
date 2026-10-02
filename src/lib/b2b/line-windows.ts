/**
 * BIO FLORAIS B2B — texto da janela de 180 dias por LINHA para o vendedor
 * (Offer Builder, revisão e página do cliente). Cliente nunca vê comissão.
 */

import { describeCommissionWindow } from "@/lib/b2b/commission-window";
import type { CommissionMatrix } from "@/lib/b2b/commission";
import type { SqlRunner } from "@/lib/b2b/ownership";
import {
  commissionWindowForItem,
  loadClientPurchases,
  loadReconquistaMonths,
} from "@/lib/b2b/purchase-history";

export async function loadLineWindowTexts(
  run: SqlRunner,
  clientId: string,
  matrix: CommissionMatrix,
  lineIds: string[],
  now = new Date()
): Promise<Record<string, string>> {
  if (!matrix.configured) return {};

  const [purchases, months] = await Promise.all([loadClientPurchases(run, clientId), loadReconquistaMonths(run)]);
  const texts: Record<string, string> = {};

  for (const lineId of lineIds) {
    texts[lineId] = describeCommissionWindow(matrix, commissionWindowForItem(purchases, [lineId], now, months));
  }

  return texts;
}

/** Linhas que o cliente já comprou, com a janela de cada uma (página do cliente). */
export async function loadClientLineSummary(
  run: SqlRunner,
  clientId: string,
  matrix: CommissionMatrix,
  now = new Date()
): Promise<Array<{ name: string; text: string }>> {
  const purchases = await loadClientPurchases(run, clientId);
  const groupIds = Array.from(new Set(purchases.map((purchase) => purchase.groupId)));

  if (groupIds.length === 0) return [];

  const [months, names] = await Promise.all([
    loadReconquistaMonths(run),
    run(`SELECT id, name FROM b2b_commercial_groups WHERE id = ANY($1::uuid[]) ORDER BY sort_order, name`, [groupIds]),
  ]);

  return names.map((row) => ({
    name: String(row.name),
    text: matrix.configured
      ? describeCommissionWindow(matrix, commissionWindowForItem(purchases, [String(row.id)], now, months))
      : "",
  }));
}
