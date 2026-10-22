/**
 * Observações do pedido e complemento do endereço (Rodada 19a). Funções PURAS, usadas no navegador (mensagem na hora) e no
 * servidor (a decisão é do servidor): as mesmas regras nos checkouts B2C, B2B e "Lançar pedido".
 *
 *  - Observações: até 500 caracteres, texto livre (instruções de entrega, horário, referência). Sem caracteres de controle.
 *    Vão gravadas no pedido, aparecem no admin e na Central e seguem ao Omie na observação do Pedido de Venda.
 *  - Complemento: curto (até 60 caracteres, o limite do campo no Omie), uma linha, só letras, números e . , - / º ª ° # ( ) & :
 *    Instrução comprida no complemento fazia o envio ao Omie falhar; a mensagem orienta a usar o campo Observações.
 */

export const ORDER_NOTE_MAX = 500;
export const COMPLEMENT_MAX = 60;

export const COMPLEMENT_HELP = "Para instruções de entrega, use o campo Observações do pedido.";

export type FieldResult = { ok: true; value: string | null } | { ok: false; error: string };

/** Remove caracteres de controle (menos quebra de linha), uniformiza quebras e limita linhas em branco seguidas. */
export function cleanNote(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateOrderNote(raw: unknown): FieldResult {
  const value = cleanNote(raw);

  if (!value) return { ok: true, value: null };
  if (value.length > ORDER_NOTE_MAX) {
    return { ok: false, error: `Observações: máximo de ${ORDER_NOTE_MAX} caracteres (você escreveu ${value.length}).` };
  }

  return { ok: true, value };
}

const COMPLEMENT_ALLOWED = /^[\p{L}\p{N} .,\-/ºª°#():&]+$/u;

export function validateComplement(raw: unknown): FieldResult {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();

  if (!value) return { ok: true, value: null };
  if (value.length > COMPLEMENT_MAX) {
    return { ok: false, error: `Complemento: máximo de ${COMPLEMENT_MAX} caracteres (você escreveu ${value.length}). ${COMPLEMENT_HELP}` };
  }
  if (!COMPLEMENT_ALLOWED.test(value)) {
    return { ok: false, error: `Complemento: use só letras, números e . , - / # ( ) & : sem outros símbolos. ${COMPLEMENT_HELP}` };
  }

  return { ok: true, value };
}

/** Observação do cliente para a linha do Omie: uma linha só, prefixada. */
export function omieNoteLine(note: string | null | undefined): string | null {
  const value = cleanNote(note).replace(/\s*\n+\s*/g, " / ");

  return value ? `OBS DO CLIENTE: ${value}` : null;
}
