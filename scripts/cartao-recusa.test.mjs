/*
 * Cartão B2C (Mercado Pago /v1/orders), correção aprovada pelo Luis em 09/11: chave de idempotência por tentativa, recusa
 * gravada em payments ("failed") com status/status_detail/HTTP do MP (sem token nem dado do cartão) e mensagem clara ao cliente.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cardAttemptIdempotencyKey, cardDeclineMessage, outcomeFromAdapterError, outcomeFromPayload } from "../src/lib/payments/card-decline.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("idempotência por tentativa: mesmo cartão = mesma chave; outro token = outra chave; o token não aparece na chave", () => {
  const order = "50b98660-9802-4541-9612-964c885ac3ca";
  const a = cardAttemptIdempotencyKey(order, "tok_aaa");
  assert.equal(a, cardAttemptIdempotencyKey(order, "tok_aaa"), "duplo envio do mesmo cartão reaproveita a chave");
  assert.notEqual(a, cardAttemptIdempotencyKey(order, "tok_bbb"), "outra tentativa não herda a recusa");
  assert.notEqual(a, cardAttemptIdempotencyKey("outro-pedido", "tok_aaa"));
  assert.ok(a.startsWith(`bio-card-${order}-`) && !a.includes("tok_aaa"));
  assert.ok(a.length <= 64);
});

test("recusa do MP (402 high_risk, como a de 09/11): status, motivo e HTTP lidos do erro do adaptador", () => {
  const body = {
    id: "ORD01ABC",
    status: "failed",
    status_detail: "failed",
    transactions: { payments: [{ id: "PAY01", status: "failed", status_detail: "high_risk" }] },
  };
  const outcome = outcomeFromAdapterError(new Error(`Mercado Pago request failed (402): ${JSON.stringify(body)}`));
  assert.deepEqual(outcome, { httpStatus: 402, mpOrderId: "ORD01ABC", mpStatus: "failed", mpStatusDetail: "high_risk", mpErrorCodes: [] });

  // formato de erro com "errors" (sem transactions)
  const errors = outcomeFromAdapterError(new Error(`Mercado Pago request failed (400): ${JSON.stringify({ errors: [{ code: "invalid_card_token", details: ["card token invalid"] }] })}`));
  assert.equal(errors.httpStatus, 400);
  assert.deepEqual(errors.mpErrorCodes, ["invalid_card_token", "card token invalid"]);

  // erro que não é do MP: segue o tratamento genérico
  assert.equal(outcomeFromAdapterError(new Error("fetch failed")), null);
  // JSON ilegível: ainda dá o HTTP
  assert.equal(outcomeFromAdapterError(new Error("Mercado Pago request failed (502): <html>")).httpStatus, 502);

  assert.deepEqual(outcomeFromPayload({ id: "X", status: "processed", transactions: { payments: [{ status: "processed", status_detail: "accredited" }] } }), {
    httpStatus: null, mpOrderId: "X", mpStatus: "processed", mpStatusDetail: "accredited", mpErrorCodes: [],
  });
});

test("mensagem ao cliente por motivo: clara, sem código nem JSON; high_risk sugere outro cartão ou Pix", () => {
  assert.equal(cardDeclineMessage("high_risk"), "O banco ou o antifraude não aprovou este pagamento. Tente outro cartão ou pague no Pix com desconto.");
  assert.match(cardDeclineMessage("cc_rejected_insufficient_amount"), /limite/);
  assert.match(cardDeclineMessage("cc_rejected_bad_filled_security_code"), /CVV/);
  assert.match(cardDeclineMessage("cc_rejected_bad_filled_date"), /validade/);
  assert.match(cardDeclineMessage("cc_rejected_call_for_authorize"), /Ligue para o banco/);
  assert.match(cardDeclineMessage(null), /não foi aprovado/);
  for (const detail of ["high_risk", "x", null]) assert.ok(!/high_risk|\{|status_detail/.test(cardDeclineMessage(detail)));
});

test("rota: chave por tentativa; recusa gravada como failed com o motivo, sem token; 402 com mensagem clara", () => {
  const route = read("src/app/api/payments/mercadopago/card/route.ts");
  assert.ok(route.includes("const idempotencyKey = cardAttemptIdempotencyKey(order.id, cardToken);"));
  assert.ok(!route.includes("bio-card-order-"), "a chave fixa por pedido saiu");
  assert.ok(/const declined = outcomeFromAdapterError\(paymentError\);[\s\S]*?status: "failed",\s*rawPayload: \{ installments, paymentMethodId, \.\.\.declined \}/.test(route));
  assert.ok(route.includes("{ error: cardDeclineMessage(declined.mpStatusDetail), statusDetail: declined.mpStatusDetail },\n        { status: 402 }"));
  assert.ok(route.includes("mpStatusDetail: outcome.mpStatusDetail"), "o motivo também fica no pagamento aprovado/pendente");
  // nada de token, número ou dado pessoal no que se grava
  const inserts = route.match(/rawPayload: \{[^}]*\}/g) ?? [];
  assert.ok(inserts.length >= 2);
  for (const payload of inserts) assert.ok(!/cardToken|token|email|cpf|cnpj|name/i.test(payload), payload);
  // o componente mostra o "error" da resposta (a mensagem clara) em vez do JSON do MP
  assert.ok(read("src/components/payments/MercadoPagoCardPayment.tsx").includes("result?.error ||"));
});

test("recusa 402 com o pedido em \"data\" e o motivo nos details (caso de 10/11): id do MP e motivo não ficam nulos", () => {
  const body = {
    errors: [{ code: "failed", message: "The following transactions failed", details: ["pay_01JX9ABC: high_risk"] }],
    data: { id: "ORD01DEF", status: "failed", transactions: { payments: [{ id: "pay_01JX9ABC", status: "failed" }] } },
  };
  const outcome = outcomeFromAdapterError(new Error(`Mercado Pago request failed (402): ${JSON.stringify(body)}`));
  assert.equal(outcome.httpStatus, 402);
  assert.equal(outcome.mpOrderId, "ORD01DEF", "id do pedido do MP lido de data");
  assert.equal(outcome.mpStatus, "failed");
  assert.equal(outcome.mpStatusDetail, "high_risk", "motivo lido dos details");
  assert.deepEqual(outcome.mpErrorCodes, ["failed", "pay_01JX9ABC: high_risk"]);
  assert.match(cardDeclineMessage(outcome.mpStatusDetail), /antifraude/);

  // só errors (sem data): o motivo ainda sai dos details
  const onlyErrors = outcomeFromAdapterError(new Error(`Mercado Pago request failed (402): ${JSON.stringify({ errors: [{ code: "failed", details: ["pay_X: rejected_insufficient_amount"] }] })}`));
  assert.equal(onlyErrors.mpStatusDetail, "rejected_insufficient_amount");
  assert.equal(onlyErrors.mpOrderId, null);
});
