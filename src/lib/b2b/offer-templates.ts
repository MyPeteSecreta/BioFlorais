/**
 * BIO FLORAIS B2B — L2: modelos de oferta do vendedor (sql/b2b/34b). Cada vendedor só enxerga os seus.
 * O modelo guarda nome + linhas + promoção/elegibilidade por (promoção, linha); a validação é a do
 * Offer Builder (validateDraftInput) com as regras gerais do vendedor (sem cliente definido).
 */

import { isUuid } from "@/lib/b2b/admin-input";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { validateDraftInput } from "@/lib/b2b/offer-draft-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import type { OfferTemplateData, TemplatePromotion } from "@/lib/b2b/quick-offer";

export type OfferTemplate = OfferTemplateData & { id: string; name: string; updatedAt: string };

function parsePromotions(value: unknown): TemplatePromotion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => item as Record<string, unknown>)
    .filter((item) => typeof item?.commercialGroupId === "string" && typeof item?.promotionId === "string")
    .map((item) => ({
      commercialGroupId: String(item.commercialGroupId),
      promotionId: String(item.promotionId),
      promotionName: typeof item.promotionName === "string" ? item.promotionName : null,
      eligibilityMode: item.eligibilityMode === "days" ? ("days" as const) : ("uses" as const),
      maxUses: item.maxUses === null || item.maxUses === undefined ? null : Number(item.maxUses),
      durationDays: item.durationDays === null || item.durationDays === undefined ? null : Number(item.durationDays),
    }));
}

function toTemplate(row: Record<string, unknown>): OfferTemplate {
  const ids = Array.isArray(row.commercial_group_ids) ? row.commercial_group_ids.map(String) : [];

  return {
    id: String(row.id),
    name: String(row.name),
    commercialGroupIds: ids,
    promotions: parsePromotions(row.promotions),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listTemplates(run: SqlRunner, responsibleId: string): Promise<OfferTemplate[]> {
  if (!isUuid(responsibleId)) return [];

  const rows = await run(
    `SELECT id, name, commercial_group_ids, promotions, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM b2b_offer_templates WHERE responsible_id = $1 AND archived_at IS NULL ORDER BY name`,
    [responsibleId]
  );

  return rows.map(toTemplate);
}

export async function getTemplate(run: SqlRunner, responsibleId: string, id: string): Promise<OfferTemplate | null> {
  if (!isUuid(responsibleId) || !isUuid(id)) return null;

  const [row] = await run(
    `SELECT id, name, commercial_group_ids, promotions, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM b2b_offer_templates WHERE id = $1 AND responsible_id = $2 AND archived_at IS NULL`,
    [id, responsibleId]
  );

  return row ? toTemplate(row) : null;
}

export type SaveTemplateResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/** Valida com as regras do Offer Builder e grava (cria ou atualiza o modelo do PRÓPRIO vendedor). */
export async function saveTemplate(
  run: SqlRunner,
  responsibleId: string,
  input: { id?: string | null; name?: unknown; commercialGroupIds?: unknown; promotions?: unknown }
): Promise<SaveTemplateResult> {
  const name = String(input.name ?? "").trim().slice(0, 80);

  if (name.length < 2) return { ok: false, status: 400, error: "Dê um nome ao modelo." };

  const [lines, matrix] = await Promise.all([loadBuilderLines(new Date(), null), loadCommissionMatrix(run, responsibleId, null)]);
  const parsed = validateDraftInput({ commercialGroupIds: input.commercialGroupIds, promotions: input.promotions }, lines, matrix);

  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const nameById = new Map<string, string>();

  for (const line of lines) for (const promotion of line.promotions) nameById.set(promotion.id, promotion.name);

  const promotions: TemplatePromotion[] = parsed.value.conditions.map(({ commercialGroupId, condition }) => {
    if (condition.kind !== "promotion") throw new Error("condição inválida");

    return {
      commercialGroupId,
      promotionId: condition.promotionId,
      promotionName: nameById.get(condition.promotionId) ?? null,
      eligibilityMode: condition.eligibilityMode,
      maxUses: condition.maxUses,
      durationDays: condition.durationDays,
    };
  });

  const groupsJson = JSON.stringify(parsed.value.commercialGroupIds);
  const promotionsJson = JSON.stringify(promotions);

  if (input.id) {
    if (!isUuid(String(input.id))) return { ok: false, status: 400, error: "Modelo inválido." };

    const rows = await run(
      `UPDATE b2b_offer_templates SET name = $3, commercial_group_ids = $4::jsonb, promotions = $5::jsonb, updated_at = now()
        WHERE id = $1 AND responsible_id = $2 AND archived_at IS NULL RETURNING id`,
      [input.id, responsibleId, name, groupsJson, promotionsJson]
    );

    return rows[0] ? { ok: true, id: String(rows[0].id) } : { ok: false, status: 404, error: "Modelo não encontrado." };
  }

  const [created] = await run(
    `INSERT INTO b2b_offer_templates (responsible_id, name, commercial_group_ids, promotions)
     VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING id`,
    [responsibleId, name, groupsJson, promotionsJson]
  );

  return { ok: true, id: String(created.id) };
}

export async function archiveTemplate(run: SqlRunner, responsibleId: string, id: string): Promise<boolean> {
  if (!isUuid(responsibleId) || !isUuid(id)) return false;

  const rows = await run(
    `UPDATE b2b_offer_templates SET archived_at = now() WHERE id = $1 AND responsible_id = $2 AND archived_at IS NULL RETURNING id`,
    [id, responsibleId]
  );

  return rows.length > 0;
}
