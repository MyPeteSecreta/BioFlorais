/*
 * API de Conversões da Meta (item 5 da mestre, 10/11): Purchase pelo servidor quando o pedido B2C vira pago, com o MESMO event_id
 * do pixel (id do pedido); só com aceite de marketing; e-mail e telefone em SHA-256 + IP, navegador, fbp e fbc (nome e endereço
 * NÃO, pela política publicada); token só em META_CAPI_TOKEN; falha nunca quebra o pagamento; nada pessoal em log.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { buildMetaCapiPurchaseBody, captureMetaCapi, hashEmail, hashPhone, sendMetaCapiPurchase } from "../src/lib/meta-capi.ts";
import { metaPurchaseEvent } from "../src/lib/measurement.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const ORDER = "50b98660-9802-4541-9612-964c885ac3ca";
const payload = { orderId: ORDER, valueCents: 6462, items: [{ id: "adulto-floral-em-gotas-sono", quantity: 2, priceCents: 3231 }] };
const capture = { consent: true, fbp: "fb.1.1700000000000.123456789", fbc: "fb.1.1700000000000.AbCdEf", ip: "203.0.113.7", ua: "Mozilla/5.0 (teste)" };

test("hash: e-mail minúsculo e sem espaço; telefone com 55; vazio não vai", () => {
  assert.equal(hashEmail("  Cliente@Teste.LOCAL "), sha("cliente@teste.local"));
  assert.equal(hashEmail(""), null);
  assert.equal(hashPhone("(11) 91234-5678"), sha("5511912345678"));
  assert.equal(hashPhone("+55 11 91234-5678"), sha("5511912345678"));
  assert.equal(hashPhone("123"), null);
});

test("captura no checkout: sem aceite de marketing, nada; com aceite, _fbp, _fbc, IP e navegador", () => {
  const headers = new Headers({ cookie: "a=1; _fbp=fb.1.17.99; _fbc=fb.1.17.Zz", "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "Mozilla/5.0" });
  assert.equal(captureMetaCapi(headers, false), null);
  assert.equal(captureMetaCapi(headers, "true"), null, "só o booleano true");
  assert.deepEqual(captureMetaCapi(headers, true), { consent: true, fbp: "fb.1.17.99", fbc: "fb.1.17.Zz", ip: "203.0.113.7", ua: "Mozilla/5.0" });
});

test("corpo: mesmo event_id e custom_data do pixel; user_data em hash; sem nome nem endereço; test_event_code opcional", () => {
  const body = buildMetaCapiPurchaseBody({ payload, capture, email: "cliente@teste.local", phone: "11912345678", eventTimeSec: 1762790400, sourceUrl: "https://www.bioflorais.com.br/checkout", testEventCode: "TEST123" });
  const event = body.data[0];
  const pixel = metaPurchaseEvent(payload);

  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, ORDER, "igual ao eventID do pixel do navegador");
  assert.equal(pixel.eventId, ORDER);
  assert.deepEqual(event.custom_data, pixel.params, "valor, BRL e códigos BF iguais aos do pixel");
  assert.equal(event.custom_data.currency, "BRL");
  assert.equal(event.action_source, "website");
  assert.deepEqual(event.user_data, { em: [sha("cliente@teste.local")], ph: [sha("5511912345678")], client_ip_address: "203.0.113.7", client_user_agent: "Mozilla/5.0 (teste)", fbp: capture.fbp, fbc: capture.fbc });
  assert.equal(body.test_event_code, "TEST123");
  const text = JSON.stringify(body);
  assert.ok(!text.includes("cliente@teste.local") && !text.includes("11912345678"), "nada em texto puro");
  assert.ok(!/"fn"|"ln"|"ct"|"zp"|"st"|"country"/.test(text), "sem nome, cidade, CEP (política)");
  assert.equal(buildMetaCapiPurchaseBody({ payload, capture, email: null, phone: null, eventTimeSec: 1, sourceUrl: "x" }).test_event_code, undefined);
});

test("envio: só com token, B2C, aceite e pedido pago; nunca lança; o token não vai para log", async () => {
  const env = { META_CAPI_TOKEN: "TOKEN-DE-TESTE", NEXT_PUBLIC_META_PIXEL_ID: "1707736537642394", META_TEST_EVENT_CODE: "TEST123" };
  const row = { b2b_offer_id: null, adjustments: JSON.stringify({ storeKey: "bio", metaCapi: capture }), email: "cliente@teste.local", phone: "11912345678" };
  const run = (r) => async () => [r];
  const calls = [];
  const okFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  const loadPayload = async () => payload;

  assert.equal(await sendMetaCapiPurchase(run(row), ORDER, { env: { ...env, META_CAPI_TOKEN: "" }, fetchImpl: okFetch, loadPayload }), "no_token");
  assert.equal(await sendMetaCapiPurchase(run({ ...row, b2b_offer_id: "x" }), ORDER, { env, fetchImpl: okFetch, loadPayload }), "not_b2c");
  assert.equal(await sendMetaCapiPurchase(run({ ...row, adjustments: JSON.stringify({ metaCapi: null }) }), ORDER, { env, fetchImpl: okFetch, loadPayload }), "no_consent");
  assert.equal(await sendMetaCapiPurchase(run(row), ORDER, { env, fetchImpl: okFetch, loadPayload: async () => null }), "not_paid");
  assert.equal(calls.length, 0, "nada enviado nesses casos");

  assert.equal(await sendMetaCapiPurchase(run(row), ORDER, { env, fetchImpl: okFetch, loadPayload, siteUrl: "https://www.bioflorais.com.br" }), "sent");
  assert.ok(calls[0].url.startsWith("https://graph.facebook.com/v21.0/1707736537642394/events?access_token="));
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.data[0].event_id, ORDER);
  assert.equal(sent.test_event_code, "TEST123");
  assert.ok(calls[0].init.signal, "timeout curto");

  // falha da Meta: devolve "failed", não lança; o log não leva token nem dado pessoal
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(JSON.stringify(args));
  try {
    assert.equal(await sendMetaCapiPurchase(run(row), ORDER, { env, fetchImpl: async () => ({ ok: false, status: 400 }), loadPayload }), "failed");
    assert.equal(await sendMetaCapiPurchase(run(row), ORDER, { env, fetchImpl: async () => { throw new Error("timeout TOKEN-DE-TESTE"); }, loadPayload }), "failed");
  } finally {
    console.error = original;
  }
  for (const line of logs) assert.ok(!/TOKEN-DE-TESTE|cliente@teste|11912345678|203\.0\.113/.test(line), line);
});

test("fiação: checkout manda o aceite; pedido guarda a captura; finalizador do pagamento envia sem lançar; token só por variável", () => {
  assert.ok(read("src/app/checkout/page.tsx").includes("return hasMarketingConsent(window.localStorage);"));
  assert.ok(read("src/app/api/orders/create/route.ts").includes("metaCapi: captureMetaCapi(request.headers, (body as { marketingConsent?: unknown }).marketingConsent),"));
  const finalize = read("src/lib/payments/finalize-mercadopago-paid.ts");
  assert.ok(finalize.includes("await sendMetaCapiPurchase(getAppSqlRunner(), input.orderId, { siteUrl: getSiteUrl() });"));
  assert.ok(finalize.indexOf("sendMetaCapiPurchase(") > finalize.indexOf("confirmPartnerPaid("), "depois de o pedido estar pago");
  const lib = read("src/lib/meta-capi.ts");
  assert.ok(lib.includes("env.META_CAPI_TOKEN") && !/EAA[A-Za-z0-9]{10,}/.test(lib), "nenhum token no código");
});
