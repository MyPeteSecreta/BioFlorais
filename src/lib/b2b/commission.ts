/**
 * BIO FLORAIS B2B — matriz de comissão (Especificação V1.26–V1.29).
 *
 * Lida de b2b_commission_rules (nada hard-coded no React):
 *   responsible_base       -> base_percent
 *   normal_price           -> extra_percent do preço B2B normal
 *   promotion_eligibility  -> extra_percent por promoção + elegibilidade
 * Regra mais específica vence: cliente+vendedor > cliente > vendedor > geral.
 *
 * Comissão = base + extra = total. Visível só ao vendedor (área logada)
 * e congelada em order_items no pedido. O cliente nunca vê comissão.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

export type EligibilityMode = "uses" | "days";

export type PromotionCommissionRule = {
  promotionId: string;
  eligibilityMode: EligibilityMode;
  maxUses: number | null;
  durationDays: number | null;
  extraPercent: number;
};

export type CommissionMatrix = {
  /** false = tabela ausente ou sem regra base/normal (mostrar aviso). */
  configured: boolean;
  basePercent: number;
  normalExtraPercent: number;
  rules: PromotionCommissionRule[];
};

export type OfferCondition =
  | { kind: "normal" }
  | {
      kind: "promotion";
      promotionId: string;
      eligibilityMode: EligibilityMode;
      maxUses: number | null;
      durationDays: number | null;
    };

export const EMPTY_COMMISSION_MATRIX: CommissionMatrix = {
  configured: false,
  basePercent: 0,
  normalExtraPercent: 0,
  rules: [],
};

const SPECIFICITY = `
  (CASE WHEN client_id IS NOT NULL THEN 4 ELSE 0 END
 + CASE WHEN responsible_id IS NOT NULL THEN 2 ELSE 0 END) DESC,
  updated_at DESC
`;

const APPLIES_TO = `
  active = true
  AND (responsible_id IS NULL OR responsible_id = $1)
  AND (client_id IS NULL OR client_id = $2)
`;

export async function loadCommissionMatrix(
  run: SqlRunner,
  responsibleId: string,
  clientId: string
): Promise<CommissionMatrix> {
  try {
    const [base] = await run(
      `SELECT base_percent FROM b2b_commission_rules
        WHERE scope = 'responsible_base' AND ${APPLIES_TO}
        ORDER BY ${SPECIFICITY} LIMIT 1`,
      [responsibleId, clientId]
    );

    const [normal] = await run(
      `SELECT extra_percent FROM b2b_commission_rules
        WHERE scope = 'normal_price' AND ${APPLIES_TO}
        ORDER BY ${SPECIFICITY} LIMIT 1`,
      [responsibleId, clientId]
    );

    // Uma regra por promoção+elegibilidade: a mais específica.
    const promotionRows = await run(
      `SELECT DISTINCT ON (promotion_id, eligibility_mode, max_uses, duration_days)
              promotion_id, eligibility_mode, max_uses, duration_days, extra_percent
         FROM b2b_commission_rules
        WHERE scope = 'promotion_eligibility'
          AND promotion_id IS NOT NULL
          AND eligibility_mode IN ('uses', 'days')
          AND ${APPLIES_TO}
        ORDER BY promotion_id, eligibility_mode, max_uses, duration_days, ${SPECIFICITY}`,
      [responsibleId, clientId]
    );

    return {
      configured: Boolean(base) && Boolean(normal),
      basePercent: Number(base?.base_percent ?? 0),
      normalExtraPercent: Number(normal?.extra_percent ?? 0),
      rules: promotionRows
        .map((row) => ({
          promotionId: String(row.promotion_id),
          eligibilityMode: row.eligibility_mode as EligibilityMode,
          maxUses: row.max_uses === null ? null : Number(row.max_uses),
          durationDays: row.duration_days === null ? null : Number(row.duration_days),
          extraPercent: Number(row.extra_percent ?? 0),
        }))
        .filter(
          (rule) =>
            (rule.eligibilityMode === "uses" && rule.maxUses !== null && rule.durationDays === null) ||
            (rule.eligibilityMode === "days" && rule.durationDays !== null && rule.maxUses === null)
        )
        .sort(
          (a, b) =>
            a.promotionId.localeCompare(b.promotionId) ||
            a.eligibilityMode.localeCompare(b.eligibilityMode) ||
            (a.maxUses ?? 0) - (b.maxUses ?? 0) ||
            (a.durationDays ?? 0) - (b.durationDays ?? 0)
        ),
    };
  } catch (error) {
    // Tabela ainda não criada (SQL 06b não aplicado): sem comissão configurada.
    console.error("[b2b/commission] matriz indisponível", error);
    return EMPTY_COMMISSION_MATRIX;
  }
}

/** Elegibilidades configuradas de uma promoção, separadas por modo. */
export function eligibilityOptions(matrix: CommissionMatrix, promotionId: string) {
  const rules = matrix.rules.filter((rule) => rule.promotionId === promotionId);

  return {
    uses: rules.filter((rule) => rule.eligibilityMode === "uses"),
    days: rules.filter((rule) => rule.eligibilityMode === "days"),
  };
}

export function findPromotionRule(
  matrix: CommissionMatrix,
  condition: Extract<OfferCondition, { kind: "promotion" }>
) {
  return (
    matrix.rules.find(
      (rule) =>
        rule.promotionId === condition.promotionId &&
        rule.eligibilityMode === condition.eligibilityMode &&
        rule.maxUses === (condition.eligibilityMode === "uses" ? condition.maxUses : null) &&
        rule.durationDays === (condition.eligibilityMode === "days" ? condition.durationDays : null)
    ) ?? null
  );
}

/** base + extra = total da condição; null se a elegibilidade não estiver configurada. */
export function commissionFor(matrix: CommissionMatrix, condition: OfferCondition) {
  if (condition.kind === "normal") {
    return {
      basePercent: matrix.basePercent,
      extraPercent: matrix.normalExtraPercent,
      totalPercent: roundPercent(matrix.basePercent + matrix.normalExtraPercent),
    };
  }

  const rule = findPromotionRule(matrix, condition);

  if (!rule) return null;

  return {
    basePercent: matrix.basePercent,
    extraPercent: rule.extraPercent,
    totalPercent: roundPercent(matrix.basePercent + rule.extraPercent),
  };
}

function roundPercent(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
}

/** "3 por 2" (compra 2, leva +1), "4 por 2" (compra 2, leva +2). */
export function promotionShortLabel(buyQuantity: number | null, freeQuantity: number | null) {
  if (!buyQuantity || !freeQuantity) return "Promoção";
  return `${buyQuantity + freeQuantity} por ${buyQuantity}`;
}
