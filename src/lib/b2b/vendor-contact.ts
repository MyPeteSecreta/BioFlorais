/**
 * BIO FLORAIS B2B — contato do vendedor: NOME e WHATSAPP (b2b_responsibles.name / phone).
 * O admin edita em Vendedores > Editar; o próprio vendedor troca o WhatsApp em "Meu cadastro". Toda troca vale só depois de
 * validada e grava uma linha de auditoria (quem, quando, valor antigo e novo) em b2b_responsible_audit (SQL 53b).
 * O WhatsApp é guardado só com dígitos (DDD + número, sem o 55), como nos cadastros já existentes.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

export type ContactActor = { kind: "admin" | "vendedor"; label: string };

const squash = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/** WhatsApp com DDD: 10 ou 11 dígitos (aceita +55 e máscara). Celular (11) começa com 9 depois do DDD. null = inválido. */
export function normalizeWhatsApp(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (Number(digits.slice(0, 2)) < 11) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  if (/^(\d)\1+$/.test(digits)) return null;

  return digits;
}

export type ContactPatch = { name?: string; whatsapp?: string };

export function parseContactPatch(raw: { name?: unknown; whatsapp?: unknown }): { ok: true; value: ContactPatch } | { ok: false; error: string } {
  const value: ContactPatch = {};

  if (raw.name !== undefined) {
    const name = squash(raw.name);

    if (name.length < 3 || name.length > 120) return { ok: false, error: "Informe o nome completo (de 3 a 120 letras)." };

    value.name = name;
  }

  if (raw.whatsapp !== undefined) {
    const phone = normalizeWhatsApp(raw.whatsapp);

    if (!phone) return { ok: false, error: "Informe o WhatsApp com DDD, por exemplo (11) 99999-8888." };

    value.whatsapp = phone;
  }

  if (value.name === undefined && value.whatsapp === undefined) return { ok: false, error: "Nada para alterar." };

  return { ok: true, value };
}

export type ChangeContactResult = { ok: true; changed: Array<"name" | "phone">; name: string; phone: string | null } | { ok: false; status: number; error: string };

export async function changeContact(run: SqlRunner, responsibleId: string, patch: ContactPatch, actor: ContactActor): Promise<ChangeContactResult> {
  const [current] = await run(`SELECT name, phone FROM b2b_responsibles WHERE id = $1::uuid`, [responsibleId]);

  if (!current) return { ok: false, status: 404, error: "Vendedor não encontrado." };

  const oldName = String(current.name ?? "");
  const oldPhone = current.phone ? String(current.phone) : null;
  const newName = patch.name ?? oldName;
  const newPhone = patch.whatsapp ?? oldPhone;
  const changed: Array<"name" | "phone"> = [];

  if (newName !== oldName) changed.push("name");
  if (newPhone !== oldPhone) changed.push("phone");

  if (changed.length === 0) return { ok: true, changed, name: oldName, phone: oldPhone };

  try {
    await run(`UPDATE b2b_responsibles SET name = $2, phone = $3, updated_at = now() WHERE id = $1::uuid`, [responsibleId, newName, newPhone]);
  } catch {
    return { ok: false, status: 500, error: "Não foi possível salvar agora." };
  }

  for (const field of changed) {
    try {
      await run(
        `INSERT INTO b2b_responsible_audit (responsible_id, field, old_value, new_value, actor, actor_label) VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
        [responsibleId, field, field === "name" ? oldName : oldPhone, field === "name" ? newName : newPhone, actor.kind, actor.label.slice(0, 120)]
      );
    } catch (error) {
      // SQL 53b ainda não aplicado: a troca vale, só não fica registrada.
      console.error("[b2b/vendor-contact] auditoria indisponível (SQL 53b?)", error);
      break;
    }
  }

  return { ok: true, changed, name: newName, phone: newPhone };
}

export type ContactChange = { field: string; oldValue: string | null; newValue: string | null; actor: string; actorLabel: string | null; changedAt: string };

/** Última troca registrada por vendedor (para mostrar "alterado por … em …" no admin). */
export async function loadLastContactChanges(run: SqlRunner): Promise<Map<string, ContactChange>> {
  const map = new Map<string, ContactChange>();

  try {
    const rows = await run(
      `SELECT DISTINCT ON (responsible_id) responsible_id, field, old_value, new_value, actor, actor_label, to_char(changed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS changed_at
         FROM b2b_responsible_audit ORDER BY responsible_id, changed_at DESC`
    );

    for (const row of rows) {
      map.set(String(row.responsible_id), {
        field: String(row.field),
        oldValue: (row.old_value as string | null) ?? null,
        newValue: (row.new_value as string | null) ?? null,
        actor: String(row.actor),
        actorLabel: (row.actor_label as string | null) ?? null,
        changedAt: String(row.changed_at),
      });
    }
  } catch {
    // SQL 53b ausente.
  }

  return map;
}
