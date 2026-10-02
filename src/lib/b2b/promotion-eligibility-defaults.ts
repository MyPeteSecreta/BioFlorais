/**
 * BIO FLORAIS B2B — elegibilidades da promoção e comissão EXTRA (C1/C2).
 * Pura (usada pelo admin no navegador e pelo servidor). O vendedor só pode
 * escolher a elegibilidade que o admin marcou na promoção; a comissão extra
 * de cada uma vem de b2b_commission_rules (scope promotion_eligibility).
 */

export const USES_OPTIONS = [1, 2, 3] as const;
export const DAYS_OPTIONS = [30, 60, 90, 180] as const;

export type EligibilityRow = {
  mode: "uses" | "days";
  /** Compras (1/2/3) ou dias (30/60/90/180). */
  value: number;
  /** Marcada = o vendedor pode escolher. */
  enabled: boolean;
  /** Comissão EXTRA (%), somada à base do vendedor. */
  extraPercent: number;
};

/** Tabela fechada: 3 por 2 (paga 2, leva +1) e 4 por 2 (paga 2, leva +2). */
const DEFAULT_TABLES: Record<string, { uses: number[]; days: number[] }> = {
  "2-1": { uses: [10, 8, 6], days: [10, 8, 6, 3] },
  "2-2": { uses: [6, 4, 2], days: [6, 4, 2, 1] },
};

/** Sempre as 7 linhas; para 3 por 2 e 4 por 2 vêm marcadas e preenchidas. */
export function defaultEligibilityRows(buyQuantity: number, freeQuantity: number): EligibilityRow[] {
  const table = DEFAULT_TABLES[`${buyQuantity}-${freeQuantity}`];

  return [
    ...USES_OPTIONS.map((value, index) => ({
      mode: "uses" as const,
      value,
      enabled: Boolean(table),
      extraPercent: table?.uses[index] ?? 0,
    })),
    ...DAYS_OPTIONS.map((value, index) => ({
      mode: "days" as const,
      value,
      enabled: Boolean(table),
      extraPercent: table?.days[index] ?? 0,
    })),
  ];
}

/** Monta as 7 linhas a partir das regras já gravadas (marcadas); o resto fica desmarcado. */
export function rowsFromSaved(
  saved: Array<{ mode: "uses" | "days"; value: number; extraPercent: number }>
): EligibilityRow[] {
  return [
    ...USES_OPTIONS.map((value) => ({ mode: "uses" as const, value })),
    ...DAYS_OPTIONS.map((value) => ({ mode: "days" as const, value })),
  ].map(({ mode, value }) => {
    const found = saved.find((rule) => rule.mode === mode && rule.value === value);
    return { mode, value, enabled: Boolean(found), extraPercent: found?.extraPercent ?? 0 };
  });
}

export type EligibilityInput = { mode: "uses" | "days"; value: number; extraPercent: number };

/** Valida o que o admin mandou: só valores permitidos, extra entre 0 e 100, sem repetir. */
export function parseEligibilities(
  raw: unknown
): { ok: true; value: EligibilityInput[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Elegibilidades inválidas." };

  const seen = new Set<string>();
  const value: EligibilityInput[] = [];

  for (const item of raw as Array<Record<string, unknown>>) {
    const mode = item?.mode;
    const amount = Number(item?.value);
    const extra = Number(item?.extraPercent);
    const allowed = mode === "uses" ? USES_OPTIONS : mode === "days" ? DAYS_OPTIONS : null;

    if (!allowed || !(allowed as readonly number[]).includes(amount)) {
      return { ok: false, error: "Elegibilidade fora das opções permitidas (1x/2x/3x ou 30/60/90/180 dias)." };
    }

    if (!Number.isFinite(extra) || extra < 0 || extra > 100) {
      return { ok: false, error: "A comissão extra deve estar entre 0% e 100%." };
    }

    const key = `${mode}:${amount}`;
    if (seen.has(key)) return { ok: false, error: "Elegibilidade repetida." };
    seen.add(key);

    value.push({ mode: mode as "uses" | "days", value: amount, extraPercent: Math.round(extra * 10000) / 10000 });
  }

  return { ok: true, value };
}
