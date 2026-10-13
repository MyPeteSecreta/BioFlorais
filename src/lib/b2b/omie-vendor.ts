/*
 * "Nome no Omie" do vendedor (coluna H do Pedido de Venda da Central Omie).
 * O Omie identifica o vendedor pelo NOME COMPLETO, igual ao cadastro de Vendedores do Omie.
 * Guardado em b2b_responsibles.omie_vendor_code (text) - mesmo nome de coluna da My Pet,
 * que é o que a Central lê.
 *
 * PADRÃO: sem preencher nada, vale o NOME COMPLETO do cadastro do vendedor. O admin só usa
 * "Alterar" quando o vendedor já existe no Omie com outro nome. Vendedor de demonstração nunca
 * vai ao Omie.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

export const OMIE_VENDOR_MAX_LENGTH = 70;

const squash = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export function parseOmieVendorInput(
  value: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = squash(value);

  if (text.length > OMIE_VENDOR_MAX_LENGTH) {
    return { ok: false, error: `O nome do vendedor no Omie aceita até ${OMIE_VENDOR_MAX_LENGTH} caracteres.` };
  }

  return { ok: true, value: text.length > 0 ? text : null };
}

/** Nome padrão no Omie: o nome completo do cadastro (espaços normalizados, até 70 caracteres). */
export function defaultOmieVendorName(registrationName: unknown) {
  return squash(registrationName).slice(0, OMIE_VENDOR_MAX_LENGTH);
}

/** Nome efetivo: o campo gravado (alterado pelo admin) ou, na falta dele, o nome do cadastro. */
export function effectiveOmieVendor(stored: unknown, registrationName: unknown) {
  return squash(stored) || defaultOmieVendorName(registrationName);
}

/**
 * Grava o padrão (nome do cadastro) onde o campo está vazio, para a Central, que lê a coluna, exportar sem
 * ninguém preencher. Nunca sobrescreve um nome já definido e nunca toca em vendedor de demonstração.
 * Tolera o SQL 30b ausente (retorna false).
 */
export async function ensureOmieVendorDefault(run: SqlRunner, responsibleId: string): Promise<boolean> {
  try {
    const rows = await run(
      `UPDATE b2b_responsibles
          SET omie_vendor_code = left(regexp_replace(btrim(name), '\\s+', ' ', 'g'), $2::int)
        WHERE id = $1::uuid
          AND (omie_vendor_code IS NULL OR btrim(omie_vendor_code) = '')
          AND COALESCE(to_jsonb(b2b_responsibles) ->> 'is_demo', 'false') <> 'true'
          AND btrim(coalesce(name, '')) <> ''
      RETURNING id`,
      [responsibleId, OMIE_VENDOR_MAX_LENGTH]
    );

    return rows.length > 0;
  } catch {
    return false;
  }
}
