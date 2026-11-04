/*
 * CPF/CNPJ no checkout B2C: dígito verificador no navegador (aviso no campo e antes de enviar) e no servidor (/api/orders/create).
 * Números de teste públicos (geradores de documento), não são de clientes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { documentError, isValidCnpj, isValidCpf } from "../src/lib/checkout/document.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("dígito verificador: CPF e CNPJ válidos passam; errados, repetidos e com tamanho errado não", () => {
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("52998224724"), false, "último dígito errado");
  assert.equal(isValidCpf("11111111111"), false, "repetido");
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11222333000180"), false);

  assert.equal(documentError("529.982.247-25"), null, "aceita com máscara");
  assert.equal(documentError("11.222.333/0001-81"), null);
  assert.equal(documentError("529.982.247-24"), "CPF inválido. Confira os números.");
  assert.equal(documentError("11.222.333/0001-80"), "CNPJ inválido. Confira os números.");
  assert.equal(documentError("1234"), "Informe um CPF (11 números) ou CNPJ (14 números).");
});

test("checkout avisa no campo e bloqueia o envio; servidor recusa documento inválido", () => {
  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes('data-testid="erro-documento"') && checkout.includes("onBlur={(event) =>"));
  assert.ok(checkout.includes('const documentProblem = documentError(readField("document"));'));
  assert.ok(checkout.indexOf("const documentProblem") < checkout.indexOf('"/api/orders/create"'), "confere antes de criar o pedido");

  const order = read("src/app/api/orders/create/route.ts");
  assert.ok(order.includes('personType === "pf" &&\n      !isValidCpf(cpf)') && order.includes('personType === "pj" &&\n      !isValidCnpj(cnpj)'));
});
