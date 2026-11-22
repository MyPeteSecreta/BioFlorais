/*
 * Pix na tela (22/11): o cliente apontou a câmera do iPhone para o QR e abriu uma pesquisa do Google (a câmera não paga Pix; só o app
 * do banco lê). Agora a caixa de pagamento (PixPayBox, usada no checkout, em /pagar e no pagamento do lojista) explica como pagar pelo
 * QR, põe o botão "Copiar código Pix" primeiro no celular, confirma a cópia e gera o QR a partir do MESMO texto do copia e cola.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import QRCode from "qrcode";

import { PIX_COPIED_MESSAGE, PIX_COPY_HELP, PIX_QR_HELP, isValidPixCode, pixCrc16, pixQrPayload } from "../src/lib/payments/pix-code.ts";
import { QR_OPTIONS } from "../src/lib/b2b/qr-options.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function makePix(body = "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865406129.905802BR5913BIO FLORAIS6009SAO PAULO62070503***6304") {
  return body + pixCrc16(body);
}

test("copia e cola válido: começa em 000201, cita br.gov.bcb.pix e o CRC16 confere; código adulterado é recusado", () => {
  const code = makePix();

  assert.ok(code.startsWith("00020126580014br.gov.bcb.pix"));
  assert.equal(isValidPixCode(code), true);
  assert.equal(isValidPixCode(code.slice(0, -1) + (code.endsWith("0") ? "1" : "0")), false);
  assert.equal(isValidPixCode("https://exemplo.com/pagar"), false);
  assert.equal(isValidPixCode(null), false);
  assert.equal(pixCrc16("123456789"), "29B1"); // vetor padrão do CRC16/CCITT-FALSE
});

test("o conteúdo do QR é EXATAMENTE o copia e cola (sem espaços nas pontas, nada a mais)", async () => {
  const code = makePix();

  assert.equal(pixQrPayload(`  ${code}\n`), code);

  const fromPayload = QRCode.create(pixQrPayload(`  ${code}\n`), { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel });
  const fromCode = QRCode.create(code, { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel });

  assert.deepEqual([...fromPayload.modules.data], [...fromCode.modules.data]);
  assert.match(await QRCode.toDataURL(code, { ...QR_OPTIONS, width: 256 }), /^data:image\/png;base64,/);
});

test("a caixa (fonte): botão Copiar primeiro, instrução do QR (app do banco) e o código completo; no celular o QR fica recolhido", () => {
  const src = read("src/components/payments/PixPayBox.tsx");
  const botao = src.indexOf("Copiar código Pix");
  const codigo = src.indexOf("Pix Copia e Cola");
  const qrDesktop = src.indexOf("-qr-desktop");
  const qrMobile = src.indexOf("-qr-mobile");

  assert.ok(botao > -1 && botao < codigo && codigo < qrDesktop && codigo < qrMobile, "ordem: botão, código, QR");
  assert.ok(src.includes("{PIX_QR_HELP}") && src.includes("{PIX_COPY_HELP}"));
  assert.ok(PIX_QR_HELP.includes("abra o app do seu banco, vá em Pix e toque em Pagar com QR Code. A câmera do celular não faz Pix."));
  assert.ok(PIX_COPY_HELP.includes("Copiar código Pix e cole no app do seu banco"));
  assert.ok(src.includes("hidden rounded-2xl bg-white p-4 shadow-sm md:block"), "QR direto só no computador");
  assert.ok(src.includes("<details") && src.includes("md:hidden") && src.includes("Mostrar QR Code"), "QR recolhido no celular");
});

test("fonte da caixa: copia exatamente o payload, confirma a cópia e tem plano B; o QR nasce do mesmo texto", () => {
  const src = read("src/components/payments/PixPayBox.tsx");

  assert.ok(src.includes("navigator.clipboard.writeText(payload)"));
  assert.ok(src.includes("QRCode.toDataURL(payload"));
  assert.ok(src.includes("value={payload}"));
  assert.ok(src.includes("PIX_COPIED_MESSAGE") && PIX_COPIED_MESSAGE.includes("Código copiado!") && PIX_COPIED_MESSAGE.includes("app do seu banco"));
  assert.ok(src.includes("area.current?.select()"), "plano B quando o navegador bloqueia a cópia");
  assert.ok(PIX_QR_HELP.includes("A câmera do celular não faz Pix"));
});

test("as três telas de Pix usam a mesma caixa e nenhuma manda 'apontar a câmera'", () => {
  for (const file of ["src/app/checkout/page.tsx", "src/components/payments/ResumePayment.tsx", "src/components/payments/B2BPixPayment.tsx"]) {
    const src = read(file);

    assert.ok(src.includes("<PixPayBox"), file);
    assert.ok(!/aponte a câmera/i.test(src), file);
  }
});
