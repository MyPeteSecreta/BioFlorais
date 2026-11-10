/*
 * Pix B2C (aprovado pelo Luis em 10/11): reaproveita o Pix pendente do mesmo pedido e valor, com código e criado há menos de
 * 25 min, em vez de criar outro (um pedido gerou 11 Pix em 6 minutos); sem código do MP, a rota responde 502 com mensagem clara.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PIX_NO_CODE_MESSAGE, pixResponseFromOrder, reusablePix } from "../src/lib/payments/pix-reuse.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const order = (overrides = {}) => ({
  id: "ORD-PIX-1",
  status: "action_required",
  total_amount: "40.02",
  transactions: {
    payments: [{ id: "PAY-1", status: "action_required", status_detail: "waiting_transfer", amount: "40.02", payment_method: { qr_code: "00020126...", qr_code_base64: "iVBOR...", ticket_url: "https://mp.example/ticket" } }],
  },
  ...overrides,
});

test("reaproveita: mesmo valor, com código, aberto e com menos de 25 min; o relógio continua do Pix original", () => {
  const now = Date.parse("2026-11-09T20:10:00Z");
  const createdAt = new Date("2026-11-09T20:04:00Z");
  const reused = reusablePix({ status: "action_required", rawPayload: order(), createdAt }, "40.02", now);

  assert.equal(reused.mercadoPagoOrderId, "ORD-PIX-1");
  assert.equal(reused.pix.qrCode, "00020126...");
  assert.equal(reused.expiresAt, "2026-11-09T20:34:00.000Z", "30 min a partir da criação do Pix original");
});

test("não reaproveita: valor diferente, sem código, pago/cancelado/vencido, velho demais ou sem data", () => {
  const now = Date.parse("2026-11-09T20:10:00Z");
  const createdAt = new Date("2026-11-09T20:04:00Z");
  const base = { status: "action_required", rawPayload: order(), createdAt };

  assert.equal(reusablePix(base, "41.00", now), null, "valor mudou (sacola ou cupom)");
  assert.equal(reusablePix({ ...base, rawPayload: order({ transactions: { payments: [{ status: "action_required" }] } }) }, "40.02", now), null, "sem código");
  for (const status of ["paid", "cancelled", "expired", "failed", "refunded"]) assert.equal(reusablePix({ ...base, status }, "40.02", now), null, status);
  assert.equal(reusablePix({ ...base, createdAt: new Date("2026-11-09T19:44:00Z") }, "40.02", now), null, "26 min: pouco tempo para pagar");
  assert.equal(reusablePix({ ...base, createdAt: null }, "40.02", now), null);
  assert.equal(reusablePix({ ...base, rawPayload: null }, "40.02", now), null);
});

test("resposta do Pix: só com código; sem código, null (a rota responde 502)", () => {
  assert.equal(pixResponseFromOrder(order()).pix.qrCode, "00020126...");
  assert.equal(pixResponseFromOrder(order({ transactions: { payments: [{ status: "action_required", payment_method: {} }] } })), null);
  assert.equal(pixResponseFromOrder({}), null);
  assert.match(PIX_NO_CODE_MESSAGE, /não devolveu o código do Pix/);
});

test("rota: procura o Pix pendente ANTES de criar; sem código responde 502 depois de registrar; checkout usa a validade da rota", () => {
  const route = read("src/app/api/payments/mercadopago/pix/route.ts");
  const lookup = route.indexOf("const recentPix = await db");
  const create = route.indexOf('"https://api.mercadopago.com/v1/orders"');
  assert.ok(lookup > 0 && lookup < create, "reaproveitar vem antes de criar");
  assert.ok(route.includes("eq(payments.orderId, order.orderId)") && route.includes('eq(payments.method, "pix")') && route.includes("PIX_REUSE_MAX_AGE_MINUTES"));
  assert.ok(route.includes("if (reused) return NextResponse.json({ success: true, reused: true, ...reused });"));
  const insert = route.indexOf(".insert(payments)");
  const noCode = route.indexOf("if (!pixResponseFromOrder(data)) {");
  assert.ok(insert > 0 && noCode > insert, "a tentativa fica registrada antes do 502");
  assert.ok(route.includes("return NextResponse.json({ error: PIX_NO_CODE_MESSAGE }, { status: 502 });"));
  assert.ok(read("src/app/checkout/page.tsx").includes("rawData?.expiresAt ??"));
});
