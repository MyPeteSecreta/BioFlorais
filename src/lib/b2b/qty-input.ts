/**
 * Quantidade editável na sacola e no checkout B2B (Rodada 19e): regras PURAS do campo de quantidade.
 * Digitar nunca remove o item (apagar o número para digitar outro não pode esvaziar a linha): vazio/0 fica como rascunho
 * e, ao sair do campo, volta à quantidade atual. Remover é sempre uma ação explícita.
 */

export const QTY_MIN = 1;
export const QTY_MAX = 9999;

/** Quantidade válida a partir do texto digitado; null = rascunho incompleto (vazio, 0 ou sem dígitos). */
export function parseQtyDraft(draft: string): number | null {
  const digits = String(draft ?? "").replace(/\D/g, "");

  if (!digits) return null;

  const value = Number(digits.slice(0, 5));

  return Number.isFinite(value) && value >= QTY_MIN ? Math.min(value, QTY_MAX) : null;
}

export function clampQty(value: number): number {
  return Math.min(QTY_MAX, Math.max(QTY_MIN, Math.floor(Number.isFinite(value) ? value : QTY_MIN)));
}

/** +1 / −1 respeitando os limites (− em 1 continua 1: para tirar o item use "Remover"). */
export function stepQty(current: number, delta: 1 | -1): number {
  return clampQty(current + delta);
}
