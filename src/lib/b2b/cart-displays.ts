/**
 * BIO FLORAIS B2B — regra do display grátis na sacola (pura, sem React): o display só fica com o kit COMPLETO.
 * Usada pelo carrinho; o servidor revalida pelo catálogo (displays.ts validateDisplays).
 */

export type CartDisplayLike = { key: string; composition: Array<{ productId: string; qty: number }> };

/** Mantém só os displays cujo kit continua completo nas linhas (o mesmo kit repetido conta várias vezes). */
export function reconcileDisplayList<T extends CartDisplayLike>(
  displays: readonly T[],
  lines: ReadonlyArray<{ productId: string; qty: number }>
): { displays: T[]; removed: T[] } {
  const remaining = new Map(lines.map((line) => [line.productId, line.qty]));
  const kept: T[] = [];
  const removed: T[] = [];

  for (const display of displays) {
    if (display.composition.every((item) => (remaining.get(item.productId) ?? 0) >= item.qty)) {
      for (const item of display.composition) remaining.set(item.productId, (remaining.get(item.productId) ?? 0) - item.qty);
      kept.push(display);
    } else {
      removed.push(display);
    }
  }

  return { displays: kept, removed };
}
