/*
 * "Vendedor no Omie" (coluna H do Pedido de Venda da Central Omie).
 * O Omie identifica o vendedor pelo NOME COMPLETO, igual ao cadastro de Vendedores do Omie.
 * Guardado em b2b_responsibles.omie_vendor_code (text) - mesmo nome de coluna da My Pet,
 * que é o que a Central lê. Sem esse campo o pedido B2B não é exportado.
 */
export const OMIE_VENDOR_MAX_LENGTH = 70;

export function parseOmieVendorInput(
  value: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();

  if (text.length > OMIE_VENDOR_MAX_LENGTH) {
    return { ok: false, error: `O nome do vendedor no Omie aceita até ${OMIE_VENDOR_MAX_LENGTH} caracteres.` };
  }

  return { ok: true, value: text.length > 0 ? text : null };
}
