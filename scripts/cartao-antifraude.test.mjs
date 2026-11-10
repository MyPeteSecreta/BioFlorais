/*
 * Cartão B2C, antifraude do Mercado Pago (aprovado pelo Luis em 09/11): o pagamento leva o pagador do pedido (nome, CPF/CNPJ,
 * telefone, endereço) e a identificação do aparelho (security.js -> X-meli-session-id). Esses dados vão SÓ ao MP: nunca em log
 * nem em payments.raw_payload. Erro do MP no mesmo formato de antes (a recusa continua gravada com o motivo).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCardOrderBody, buildMercadoPagoPayer, createMercadoPagoCardOrder, mapOrderStatus, sanitizeDeviceSessionId } from "../src/lib/payments/mercadopago-card-order.ts";
import { outcomeFromAdapterError } from "../src/lib/payments/card-decline.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// dados de teste públicos (geradores de documento), não são de clientes
const address = { cep: "01310-100", street: "Avenida Paulista", number: "1000", complement: "apto 12", district: "Bela Vista", city: "São Paulo", state: "sp" };

test("pagador: nome dividido, CPF (PF) ou CNPJ (PJ), telefone sem +55, endereço do pedido; campo vazio não vai", () => {
  assert.deepEqual(buildMercadoPagoPayer({ email: "cliente@teste.local", name: "Maria  da Silva Souza", personType: "pf", cpf: "529.982.247-25", phone: "+55 (11) 91234-5678", address }), {
    email: "cliente@teste.local",
    first_name: "Maria",
    last_name: "da Silva Souza",
    identification: { type: "CPF", number: "52998224725" },
    phone: { area_code: "11", number: "912345678" },
    address: { zip_code: "01310100", street_name: "Avenida Paulista", street_number: "1000", neighborhood: "Bela Vista", city: "São Paulo", state: "SP", complement: "apto 12" },
  });
  assert.deepEqual(buildMercadoPagoPayer({ email: "loja@teste.local", name: "Loja", personType: "pj", cnpj: "11.222.333/0001-81", cpf: "" }).identification, { type: "CNPJ", number: "11222333000181" });
  assert.deepEqual(buildMercadoPagoPayer({ email: "a@b.c", name: "", cpf: "123", phone: "99", address: { cep: "1", street: "" } }), { email: "a@b.c" }, "dado incompleto não vai");
  assert.equal(buildMercadoPagoPayer({ email: "a@b.c", address: { ...address, number: "" } }).address.street_number, "S/N");
});

test("identificação do aparelho: só no formato esperado", () => {
  assert.equal(sanitizeDeviceSessionId("armor.1234567890abcdef"), "armor.1234567890abcdef");
  for (const bad of ["", "curto", "<script>", "a b c d e f g h", undefined, null, 42]) assert.equal(sanitizeDeviceSessionId(bad), null, String(bad));
});

test("chamada ao MP: corpo com o pagador completo, X-meli-session-id e chave de idempotência; erro no formato que a recusa já lê", async () => {
  const calls = [];
  const fakeFetch = (status, payload) => async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 400, status, json: async () => payload };
  };
  const payer = buildMercadoPagoPayer({ email: "cliente@teste.local", name: "Maria Souza", cpf: "52998224725" });
  const input = { accessToken: "TEST-token", orderId: "pedido-1", amountCents: 17447, payer, cardToken: "tok_x", paymentMethodId: "visa", installments: 1, idempotencyKey: "bio-card-pedido-1-abc", deviceSessionId: "armor.1234567890abcdef" };

  const ok = await createMercadoPagoCardOrder(input, fakeFetch(201, { id: "ORD1", status: "processed", transactions: { payments: [{ status: "processed", status_detail: "accredited" }] } }));
  assert.deepEqual([ok.externalId, ok.status], ["ORD1", "paid"]);
  const sent = calls[0];
  assert.equal(sent.url, "https://api.mercadopago.com/v1/orders");
  assert.equal(sent.init.headers["X-meli-session-id"], "armor.1234567890abcdef");
  assert.equal(sent.init.headers["X-Idempotency-Key"], "bio-card-pedido-1-abc");
  const body = JSON.parse(sent.init.body);
  assert.deepEqual(body.payer, payer);
  assert.equal(body.total_amount, "174.47");
  assert.deepEqual(body.transactions.payments[0].payment_method, { id: "visa", type: "credit_card", token: "tok_x", installments: 1 });

  // sem identificação do aparelho: o cabeçalho não vai
  await createMercadoPagoCardOrder({ ...input, deviceSessionId: null }, fakeFetch(201, { id: "ORD2", status: "processed" }));
  assert.equal(calls[1].init.headers["X-meli-session-id"], undefined);

  // recusa 402 high_risk: a mesma mensagem do pacote, lida pela recusa
  await assert.rejects(
    () => createMercadoPagoCardOrder(input, fakeFetch(402, { id: "ORD3", status: "failed", transactions: { payments: [{ status: "failed", status_detail: "high_risk" }] } })),
    (error) => {
      const outcome = outcomeFromAdapterError(error);
      return outcome.httpStatus === 402 && outcome.mpStatusDetail === "high_risk";
    }
  );

  assert.equal(mapOrderStatus({ status: "failed" }), "failed");
  assert.throws(() => buildCardOrderBody({ ...input, amountCents: 0 }));
});

test("rota e tela: pagador lido do pedido no servidor; nada do pagador em log nem em raw_payload; security.js só no cartão", () => {
  const route = read("src/app/api/payments/mercadopago/card/route.ts");
  assert.ok(!route.includes('from "@angelblancdigital/payments"'), "a criação do pagamento é local (o pacote só mandava o e-mail)");
  assert.ok(route.includes("payer: buildMercadoPagoPayer(payerInput),") && route.includes("deviceSessionId: sanitizeDeviceSessionId(body.deviceSessionId),"));
  assert.ok(route.includes(".from(addresses)") && route.includes("cpf: customers.cpf") && route.includes("phone: customers.phone"));
  for (const payload of route.match(/rawPayload: \{[^}]*\}/g) ?? []) assert.ok(!/payer|cpf|cnpj|phone|address|name|email|token/i.test(payload), payload);
  for (const log of route.match(/console\.(error|log)\([^;]*\);/g) ?? []) assert.ok(!/payer|payerInput|customer|address/i.test(log), log);

  const card = read("src/components/payments/MercadoPagoCardPayment.tsx");
  assert.ok(card.includes('export const MP_SECURITY_SCRIPT_URL = "https://www.mercadopago.com/v2/security.js";'));
  assert.ok(card.includes('script.setAttribute("view", "checkout");') && card.includes("loadMercadoPagoSecurityScript();"));
  assert.ok(card.includes("deviceSessionId:\n                          deviceSessionId(),"));
});
