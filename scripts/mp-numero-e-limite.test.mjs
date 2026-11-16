/*
 * Mercado Pago (Luis, 16/11): (a) o número do PAGAMENTO do MP fica gravado no raw_payload (cartão B2C/B2B, aprovado e recusado,
 * e Pix B2C/B2B) para conferências pelo número do painel; (b) no máximo 5 tentativas de cartão por hora por pedido, com
 * mensagem amigável sugerindo o Pix, barrando ANTES de chamar o MP.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CARD_ATTEMPTS_PER_HOUR,
  CARD_ATTEMPT_WINDOW_MS,
  CARD_TOO_MANY_ATTEMPTS_MESSAGE,
  cardAttemptsExceeded,
  mercadoPagoPaymentId,
  outcomeFromAdapterError,
  outcomeFromPayload,
} from "../src/lib/payments/card-decline.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("número do pagamento: transactions.payments[0].id (texto ou número), também dentro de data (402); sem pagamento = null", () => {
  assert.equal(mercadoPagoPaymentId({ id: "ORD1", transactions: { payments: [{ id: "PAY01ABC" }] } }), "PAY01ABC");
  assert.equal(mercadoPagoPaymentId({ id: "ORD1", transactions: { payments: [{ id: 188708392850 }] } }), "188708392850");
  assert.equal(mercadoPagoPaymentId({ data: { id: "ORD2", transactions: { payments: [{ id: "PAY02" }] } } }), "PAY02");
  assert.equal(mercadoPagoPaymentId({ id: "ORD3" }), null);
  assert.equal(mercadoPagoPaymentId(null), null);
  assert.equal(outcomeFromPayload({ id: "ORD1", transactions: { payments: [{ id: "PAY9", status: "processed" }] } }).mpPaymentId, "PAY9");
  const declined = outcomeFromAdapterError(new Error(`Mercado Pago request failed (402): ${JSON.stringify({ data: { id: "ORD4", transactions: { payments: [{ id: "PAY4", status: "failed", status_detail: "high_risk" }] } } })}`));
  assert.equal(declined.mpPaymentId, "PAY4", "a recusa também guarda o número");
});

test("limite: 5 tentativas por hora; a 6ª é barrada; mensagem amigável com o Pix, sem código", () => {
  assert.equal(CARD_ATTEMPTS_PER_HOUR, 5);
  assert.equal(CARD_ATTEMPT_WINDOW_MS, 3600000);
  for (const n of [0, 1, 4]) assert.equal(cardAttemptsExceeded(n), false, `${n} anteriores: pode tentar`);
  for (const n of [5, 6, 50]) assert.equal(cardAttemptsExceeded(n), true, `${n} anteriores: barra`);
  assert.match(CARD_TOO_MANY_ATTEMPTS_MESSAGE, /Pix/);
  assert.match(CARD_TOO_MANY_ATTEMPTS_MESSAGE, /1 hora/);
  assert.ok(!/429|too_many|erro/i.test(CARD_TOO_MANY_ATTEMPTS_MESSAGE));
});

test("rotas de cartão B2C e B2B: contam as tentativas do pedido ANTES de chamar o MP, respondem 429 e gravam o número do pagamento", () => {
  const limit = read("src/lib/payments/card-attempt-limit.ts");
  assert.ok(/eq\(payments\.method, "card"\)/.test(limit) && /gte\(payments\.createdAt, since\)/.test(limit) && /eq\(payments\.orderId, orderId\)/.test(limit));

  const b2c = read("src/app/api/payments/mercadopago/card/route.ts");
  assert.ok(b2c.indexOf("countRecentCardAttempts(order.id)") > 0);
  assert.ok(b2c.indexOf("countRecentCardAttempts(order.id)") < b2c.indexOf("createMercadoPagoCardOrder({"), "barra antes do MP");
  assert.ok(/status: 429/.test(b2c));
  assert.ok(/mpPaymentId: outcome\.mpPaymentId/.test(b2c), "aprovado/recusado sem erro HTTP");
  assert.ok(/rawPayload: \{ installments, paymentMethodId, \.\.\.declined \}/.test(b2c), "recusa 402: declined já traz mpPaymentId");

  const b2b = read("src/app/api/b2b/payments/mercadopago/card/route.ts");
  assert.ok(b2b.indexOf("countRecentCardAttempts(order.id)") > 0);
  assert.ok(b2b.indexOf("countRecentCardAttempts(order.id)") < b2b.indexOf("adapter.createPayment("), "barra antes do MP");
  assert.ok(/status: 429/.test(b2b) && /mpPaymentId: mercadoPagoPaymentId\(result\.rawPayload\)/.test(b2b));
});

test("Pix B2C e B2B: a resposta inteira do MP continua no raw_payload, com o número do pagamento em mpPaymentId", () => {
  assert.ok(/\{ \.\.\.data, mpPaymentId: mercadoPagoPaymentId\(data\) \}/.test(read("src/app/api/payments/mercadopago/pix/route.ts")));
  assert.ok(/\{ \.\.\.data, mpPaymentId: mercadoPagoPaymentId\(data\) \}/.test(read("src/app/api/b2b/payments/mercadopago/pix/route.ts")));
});
