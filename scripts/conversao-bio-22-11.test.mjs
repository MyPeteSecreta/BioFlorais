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
