/*
 * Regra de frete B2C (decisão do Luis): grátis a partir de R$ 70 em produtos; abaixo, o cliente paga 65% da cotação (subsídio de 35%) e
 * a modalidade mais barata nunca passa do teto do estado (R$ 9,90 / R$ 15,90, o valor publicado no Google Merchant).
 * A lista dos 9 estados do teto maior fica numa constante editável (vazia = todo estado no teto de R$ 9,90).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  B2C_FREE_SHIPPING_THRESHOLD_CENTS,
  B2C_SHIPPING_CAP_HIGH_CENTS,
  B2C_SHIPPING_CAP_LOW_CENTS,
  B2C_SHIPPING_HIGH_CAP_STATES,
  B2C_SHIPPING_SUBSIDY_PERCENT,
} from "../src/lib/checkout/benefits.ts";
import { b2cShippingCapCents, cheapestCustomerCents, computeB2CShipping, ufFromCep } from "../src/lib/checkout/shipping-b2c.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("constantes: R$ 70, subsídio de 35%, tetos de R$ 9,90 e R$ 15,90", () => {
  assert.equal(B2C_FREE_SHIPPING_THRESHOLD_CENTS, 7000);
  assert.equal(B2C_SHIPPING_SUBSIDY_PERCENT, 35);
  assert.equal(B2C_SHIPPING_CAP_LOW_CENTS, 990);
  assert.equal(B2C_SHIPPING_CAP_HIGH_CENTS, 1590);
  assert.ok(Array.isArray(B2C_SHIPPING_HIGH_CAP_STATES), "lista editável dos estados do teto maior");
});

test("CEP -> UF pelas faixas dos Correios (27 estados), inválido = null", () => {
  const cases = { "01310-100": "SP", "20040020": "RJ", "29010120": "ES", "30140071": "MG", "40020000": "BA", "49010000": "SE", "50030230": "PE", "57020000": "AL", "58010000": "PB", "59010000": "RN", "60115000": "CE", "64000000": "PI", "65010000": "MA", "66010000": "PA", "68900000": "AP", "69010000": "AM", "69301000": "RR", "69900000": "AC", "70040900": "DF", "74000000": "GO", "77001000": "TO", "78005000": "MT", "76801000": "RO", "79002000": "MS", "80010000": "PR", "88010000": "SC", "90010000": "RS" };

  for (const [cep, uf] of Object.entries(cases)) assert.equal(ufFromCep(cep), uf, cep);

  assert.equal(new Set(Object.values(cases)).size, 27);
  assert.equal(ufFromCep("1234567"), null);
  assert.equal(ufFromCep(""), null);
  assert.equal(ufFromCep(null), null);
});

test("faixas abaixo de R$ 70: 65% da cotação mais barata, limitado ao teto; nunca cobra mais que o teto", () => {
  // cotação real de 1 floral em SP: R$ 10,78 -> 65% = R$ 7,01 (abaixo do teto)
  assert.deepEqual(computeB2CShipping({ subtotalCents: 3590, optionCostCents: 1078, cheapestCostCents: 1078, uf: "SP" }), { customerCents: 701, benefitCents: 377, free: false, capped: false });
  // cotação de R$ 28: 65% = R$ 18,20 -> teto de R$ 9,90 num estado fora da lista (PA, ainda não confirmado) e R$ 15,90 no AM (na lista)
  const low = computeB2CShipping({ subtotalCents: 3590, optionCostCents: 2800, cheapestCostCents: 2800, uf: "PA" });
  assert.deepEqual([low.customerCents, low.benefitCents, low.capped], [990, 1810, true]);
  const north = computeB2CShipping({ subtotalCents: 3590, optionCostCents: 2800, cheapestCostCents: 2800, uf: "AM" });
  assert.deepEqual([north.customerCents, north.benefitCents, north.capped], [1590, 1210, true]);
  // exatamente no teto: 65% de R$ 15,23 = R$ 9,90 não conta como "limitado"
  assert.equal(cheapestCustomerCents(1523, "SP").cents, 990);
  assert.equal(cheapestCustomerCents(1523, "SP").capped, false);
  assert.equal(computeB2CShipping({ subtotalCents: 6999, optionCostCents: 5000, cheapestCostCents: 5000, uf: "SP" }).customerCents, 990, "R$ 69,99: ainda paga frete");

  // varre cotações de R$ 1 a R$ 200 em todos os estados: o valor cobrado da modalidade mais barata nunca passa do teto
  for (const uf of ["SP", "AM", "RR", "RS", null]) {
    for (let cost = 100; cost <= 20000; cost += 37) {
      const price = computeB2CShipping({ subtotalCents: 5000, optionCostCents: cost, cheapestCostCents: cost, uf }).customerCents;

      assert.ok(price <= b2cShippingCapCents(uf), `${uf} ${cost}`);
      assert.ok(price <= Math.round(cost * 0.65) + 1);
    }
  }
});

test("a partir de R$ 70: a mais barata é grátis (inclusive em R$ 70,00 exato); as demais abatem 50% da mais barata", () => {
  assert.deepEqual(computeB2CShipping({ subtotalCents: 7000, optionCostCents: 2000, cheapestCostCents: 2000, uf: "SP" }), { customerCents: 0, benefitCents: 2000, free: true, capped: false });
  assert.equal(computeB2CShipping({ subtotalCents: 12000, optionCostCents: 2000, cheapestCostCents: 2000, uf: "AM" }).customerCents, 0);
  assert.deepEqual(computeB2CShipping({ subtotalCents: 7180, optionCostCents: 6250, cheapestCostCents: 2000, uf: "SP" }), { customerCents: 5250, benefitCents: 1000, free: false, capped: false });
});

test("modalidade mais rápida abaixo de R$ 70: 65% da própria cotação, sem o teto, e nunca menos que a mais barata", () => {
  const fast = computeB2CShipping({ subtotalCents: 3590, optionCostCents: 6250, cheapestCostCents: 2000, uf: "SP" });

  assert.equal(fast.customerCents, 4063);
  assert.equal(fast.capped, false);
  assert.ok(fast.customerCents >= computeB2CShipping({ subtotalCents: 3590, optionCostCents: 2000, cheapestCostCents: 2000, uf: "SP" }).customerCents);
});

test("teto por estado: lista editável; fora da lista = R$ 9,90; com a UF na lista = R$ 15,90", () => {
  assert.deepEqual([...B2C_SHIPPING_HIGH_CAP_STATES].sort(), ["AC", "AM", "AP", "CE", "MA", "RO", "RR", "TO"], "lista confirmada pelo Luis em 01/11/2026 (8 dos 9 do Merchant)");
  assert.equal(b2cShippingCapCents("PA"), 990, "fora da lista: o menor teto (nunca cobra mais que o publicado)");
  assert.equal(b2cShippingCapCents(null), 990, "UF desconhecida: o menor teto");
  assert.equal(b2cShippingCapCents("rr"), 1590);

  B2C_SHIPPING_HIGH_CAP_STATES.push("PA");
  try {
    assert.equal(b2cShippingCapCents("pa"), 1590);
    assert.equal(computeB2CShipping({ subtotalCents: 3590, optionCostCents: 5000, cheapestCostCents: 5000, uf: "PA" }).customerCents, 1590);
    assert.equal(computeB2CShipping({ subtotalCents: 3590, optionCostCents: 5000, cheapestCostCents: 5000, uf: "SP" }).customerCents, 990);
  } finally {
    B2C_SHIPPING_HIGH_CAP_STATES.pop();
  }
});

test("servidor e checkout usam a mesma conta; textos do site dizem R$ 70 (sem R$ 100 no B2C)", () => {
  const route = read("src/app/api/orders/create/route.ts");
  assert.ok(route.includes("computeB2CShipping(") && route.includes("ufFromCep(cep)") && !route.includes("subtotalCents >= 10000") && !route.includes("shippingCostCents * 0.25"));

  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("computeB2CShipping(") && checkout.includes("ufFromCep(calculatedCep)") && !checkout.includes("B2C_SHIPPING_SUBSIDY_PERCENT / 100"));

  for (const file of ["src/app/page.tsx", "src/app/carrinho/page.tsx", "src/app/frete-e-entrega/page.tsx", "src/components/product/ProductPurchaseActions.tsx", "src/components/product/ProductShippingEstimate.tsx", "src/lib/seo/structured-data.ts", "src/lib/campaign/gpt-pages.ts"]) {
    assert.ok(!/R\$ ?100(,00)?\b/.test(read(file)), `${file}: sem "R$ 100"`);
  }

  assert.ok(read("src/app/frete-e-entrega/page.tsx").includes("R$ 70,00") && read("src/app/frete-e-entrega/page.tsx").includes("R$ 9,90") && read("src/app/frete-e-entrega/page.tsx").includes("R$ 15,90"));
  assert.ok(read("src/app/page.tsx").includes("Frete grátis a partir de R$ 70"));
});
