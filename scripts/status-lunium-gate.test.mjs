/*
 * Status do pedido não consulta a Lunium quando o Pix é Mercado Pago (erro 401 chave_incorreta ~130x/dia).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { shouldConsultLunium } = await import("../src/lib/payments/lunium-gate.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("só consulta a Lunium se o pedido TEM pagamento Lunium", () => {
  assert.equal(shouldConsultLunium([]), false, "pedido sem pagamento gerado");
  assert.equal(shouldConsultLunium([{ provider: "mercadopago" }]), false, "Pix/cartão Mercado Pago");
  assert.equal(shouldConsultLunium([{ provider: "mercadopago" }, { provider: "mercadopago" }]), false);
  assert.equal(shouldConsultLunium([{ provider: "lunium" }]), true, "pedido antigo com cobrança Lunium continua conciliando");
  assert.equal(shouldConsultLunium([{ provider: "mercadopago" }, { provider: "lunium" }]), true);
  assert.equal(shouldConsultLunium([{ provider: null }, { provider: undefined }]), false);
});

test("rota de status: bloco Lunium atrás do gate; Mercado Pago (Pix e cartão) segue intacto; tela para de consultar", () => {
  const route = read("src/app/api/orders/[orderId]/status/route.ts");
  const lunium = route.indexOf("LUNIUM / PIX");
  assert.ok(route.includes("shouldConsultLunium(orderPayments)"));
  assert.ok(route.indexOf("shouldConsultLunium(orderPayments)") > lunium && route.indexOf("shouldConsultLunium(orderPayments)") < route.indexOf("LUNIUM_API_KEY"));
  // Mercado Pago: concilia Pix e cartão, finaliza pelo finalizador compartilhado, antes do bloco Lunium
  const mp = route.indexOf("createMercadoPagoCardAdapter({");
  assert.ok(mp > 0 && mp < lunium);
  assert.ok(route.includes('payment.method ===\n              "pix"') || /payment\.method\s*===\s*"pix"/.test(route));
  assert.ok(route.includes("finalizeMercadoPagoPaid({"));
  // o webhook e o cron do Mercado Pago continuam usando o mesmo finalizador
  assert.ok(read("src/app/api/cron/reconcile-mp-pix/route.ts").includes("finalizeMercadoPagoPaid"));
  assert.ok(read("src/app/api/webhooks/mercadopago/route.ts").includes("finalizeMercadoPagoPaid"));
  // checkout B2C: a consulta não é eterna
  assert.ok(read("src/app/checkout/page.tsx").includes("35 * 60 * 1000"));
});
