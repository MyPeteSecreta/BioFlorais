/**
 * Carimbo do vendedor na página "Como pedir" (a ÚLTIMA página) dos PDFs LOJISTA. Só servidor.
 * O PDF-base tem, nessa página, dois espaços reservados (medidas em polegadas, página de 8,27 × 11,69 pol):
 *  - uma caixa tracejada "QR do seu representante" (2,1 × 2,1 pol, no canto direito, y = 5,6);
 *  - a linha "Nome · WhatsApp" logo abaixo do título "Seu representante" (alinhada à direita).
 * O carimbo cobre os dois com a cor de fundo da página e desenha o QR do link pessoal, o nome e o WhatsApp do vendedor.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Geometria do PDF-base (polegadas, origem no topo da página). */
export const STAMP_GEOMETRY = {
  pageWidthIn: 8.27,
  margin: 0.55,
  qrTop: 5.6,
  qrSize: 2.1,
  labelTop: 8.12,
  labelHeight: 0.46,
  labelWidth: 3.3,
} as const;

const INCH = 72;
const CREAM = rgb(255 / 255, 250 / 255, 246 / 255);
const DEEP = rgb(0x42 / 255, 0x23 / 255, 0x47 / 255);
const TEXT = rgb(0x6c / 255, 0x5b / 255, 0x69 / 255);

export type StampInput = {
  name: string;
  /** Já formatado, ex.: "(11) 99999-8888"; null = sem WhatsApp cadastrado. */
  whatsapp: string | null;
  /** PNG do QR do link pessoal. */
  qrPng: Uint8Array;
};

/** Retângulos do carimbo em pontos, origem no topo (útil para testar a geometria sem abrir o PDF). */
export function stampRects(pageWidthPt: number) {
  const scale = pageWidthPt / (STAMP_GEOMETRY.pageWidthIn * INCH);
  const g = STAMP_GEOMETRY;
  const right = (g.pageWidthIn - g.margin) * INCH * scale;
  const qr = { x: right - g.qrSize * INCH * scale, y: g.qrTop * INCH * scale, size: g.qrSize * INCH * scale };
  const label = { x: right - g.labelWidth * INCH * scale, y: g.labelTop * INCH * scale, w: g.labelWidth * INCH * scale, h: g.labelHeight * INCH * scale, right };

  return { scale, qr, label };
}

export async function stampSellerOnLastPage(basePdf: Uint8Array, input: StampInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(basePdf);
  const pages = doc.getPages();
  const page = pages[pages.length - 1];
  const { width, height } = page.getSize();
  const { scale, qr, label } = stampRects(width);

  const fromTop = (y: number, h = 0) => height - y - h;

  // 1) cobre o espaço do QR (caixa tracejada) e desenha o QR do vendedor, do mesmo tamanho do QR da loja
  const pad = 4 * scale;
  page.drawRectangle({ x: qr.x - pad, y: fromTop(qr.y - pad, qr.size + 2 * pad), width: qr.size + 2 * pad, height: qr.size + 2 * pad, color: CREAM });
  const image = await doc.embedPng(input.qrPng);
  page.drawImage(image, { x: qr.x, y: fromTop(qr.y, qr.size), width: qr.size, height: qr.size });

  // 2) cobre "Nome · WhatsApp" e escreve o nome (negrito) e o WhatsApp, alinhados à direita
  page.drawRectangle({ x: label.x - pad, y: fromTop(label.y - pad, label.h + 2 * pad), width: label.w + 2 * pad, height: label.h + 2 * pad, color: CREAM });

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  let nameSize = 11.5 * scale;
  while (nameSize > 7 && bold.widthOfTextAtSize(input.name, nameSize) > label.w) nameSize -= 0.5;

  page.drawText(input.name, { x: label.right - bold.widthOfTextAtSize(input.name, nameSize), y: fromTop(label.y, nameSize) - 1, size: nameSize, font: bold, color: DEEP });

  const second = input.whatsapp ? `WhatsApp ${input.whatsapp}` : "";
  if (second) {
    const size = 10.5 * scale;
    page.drawText(second, { x: label.right - regular.widthOfTextAtSize(second, size), y: fromTop(label.y + nameSize + 4 * scale, size) - 1, size, font: regular, color: TEXT });
  }

  doc.setSubject(`Material de venda Bio Florais — ${input.name}`);

  return doc.save();
}
