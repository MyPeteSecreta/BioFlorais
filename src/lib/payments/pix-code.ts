/**
 * Pix copia e cola (BR Code / EMV): utilidades puras, usadas pela caixa de pagamento Pix (PixPayBox) e testadas sem navegador.
 * O QR Code mostrado ao cliente é gerado NO NAVEGADOR a partir do MESMO texto do copia e cola (nada a mais, nada a menos),
 * então "ler o QR" e "colar o código" pagam exatamente a mesma cobrança.
 */

/** Textos da tela (um lugar só: checkout, /pagar e pagamento do lojista dizem a mesma coisa). */
export const PIX_QR_HELP = "Para pagar pelo QR Code: abra o app do seu banco, vá em Pix e toque em Pagar com QR Code. A câmera do celular não faz Pix.";
export const PIX_COPY_HELP = "Ou toque em Copiar código Pix e cole no app do seu banco (Pix, Pix Copia e Cola).";
export const PIX_COPIED_MESSAGE = "Código copiado! Agora abra o app do seu banco, escolha Pix, Pix Copia e Cola e cole o código.";

/** CRC16/CCITT-FALSE usado no fim do BR Code do Pix (polinômio 0x1021, início 0xFFFF). */
export function pixCrc16(text: string): string {
  let crc = 0xffff;

  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Copia e cola de Pix válido: começa em 000201, cita br.gov.bcb.pix e o CRC16 (últimos 4 caracteres) confere. */
export function isValidPixCode(code: string | null | undefined): boolean {
  const text = String(code ?? "");

  if (!/^000201/.test(text) || !/br\.gov\.bcb\.pix/i.test(text) || !/6304[0-9A-Fa-f]{4}$/.test(text)) return false;

  return pixCrc16(text.slice(0, -4)) === text.slice(-4).toUpperCase();
}

/** O que vira QR Code: exatamente o copia e cola, sem espaços nas pontas. */
export function pixQrPayload(code: string): string {
  return String(code).trim();
}
