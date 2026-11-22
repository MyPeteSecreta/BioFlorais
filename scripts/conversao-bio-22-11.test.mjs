/* Conversão (22/11), portada da Secreta: parcelamento visível, WhatsApp de dúvida, cache curto. Sem % de campanha em texto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allowedInstallments, installmentsHint } from "../src/lib/checkout/installments.ts";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

test("parcelamento: regra real do checkout (máx. 3x, parcela mínima R$ 50), sem prometer juros", () => {
  assert.equal(allowedInstallments(3590), 1);
  assert.equal(allowedInstallments(10000), 2);
  assert.equal(allowedInstallments(15000), 3);
  assert.equal(allowedInstallments(90000), 3);
  assert.match(installmentsHint(3590), /parcele em até 3x em compras a partir de R\$ 100/);
  assert.match(installmentsHint(15000), /em até 3x/);
  assert.doesNotMatch(installmentsHint(15000), /sem juros|%/i);
  const card = read("src/app/api/payments/mercadopago/card/route.ts");
  assert.match(card, /B2C_MIN_INSTALLMENT_CENTS =\s*5000/);
  assert.match(card, /B2C_MAX_INSTALLMENTS = 3/);
});

test("parcelamento aparece no produto e na sacola", () => {
  assert.ok(read("src/components/product/ProductPurchaseActions.tsx").includes("installmentsHint(salePriceCents * quantity)"));
  assert.ok(read("src/app/carrinho/page.tsx").includes("installmentsHint(quote.totalCents"));
});

import { whatsappLink, supportWhatsappDigits, productWhatsappMessage, CART_WHATSAPP_MESSAGE } from "../src/lib/whatsapp.ts";

test("WhatsApp de dúvida: número da Bio já usado no site, troca por variável, mensagem com referência, só B2C", () => {
  assert.equal(supportWhatsappDigits(undefined), "552139553713");
  assert.equal(supportWhatsappDigits("(11) 99999-0000"), "552139553713", "sem DDI 55 não vale: volta ao padrão");
  assert.equal(supportWhatsappDigits("5511999990000"), "5511999990000");
  assert.ok(whatsappLink(productWhatsappMessage("Floral X")).startsWith("https://wa.me/552139553713?text="));
  assert.match(productWhatsappMessage("Floral X"), /ref B-prod/);
  assert.match(CART_WHATSAPP_MESSAGE, /ref B-cart/);
  assert.ok(read("src/app/atendimento/page.tsx").includes("552139553713"), "é o número que o site já mostra");
  assert.ok(read("src/components/product/ProductPurchaseActions.tsx").includes('testId="whatsapp-produto"'));
  assert.ok(read("src/app/carrinho/page.tsx").includes('testId="whatsapp-sacola"'));
  assert.ok(!read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("WhatsAppHelp"));
});
