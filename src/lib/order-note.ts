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

/**
 * Complemento PARA O OMIE (máximo de 60 caracteres, confirmado pelo Omie): pedidos antigos (ou de outros canais) podem ter um
 * complemento maior. No envio, o complemento é cortado em 60 e o RESTO vai para a observação do pedido, sem falhar.
 * Quebras de linha e controles viram espaço; o corte evita partir uma palavra quando há um espaço nos últimos 20 caracteres.
 */
export function splitComplementForOmie(raw: unknown): { complement: string | null; overflow: string | null } {
  const text = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return { complement: null, overflow: null };
  if (text.length <= COMPLEMENT_MAX) return { complement: text, overflow: null };

  let cut = COMPLEMENT_MAX;
  const nextIsSpace = text[COMPLEMENT_MAX] === " ";

  if (!nextIsSpace) {
    const space = text.lastIndexOf(" ", COMPLEMENT_MAX);

    if (space >= COMPLEMENT_MAX - 20) cut = space;
  }

  const complement = text.slice(0, cut).trim();
  const overflow = text.slice(cut).trim();

  return { complement: complement || null, overflow: overflow || null };
}

/** Linha da observação do Pedido de Venda com o que sobrou do complemento. */
export function omieComplementOverflowLine(overflow: string | null | undefined): string | null {
  const value = String(overflow ?? "").trim();

  return value ? `COMPLEMENTO (continuação): ${value}` : null;
}
