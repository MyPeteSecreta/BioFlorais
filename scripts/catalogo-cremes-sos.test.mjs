/*
 * Catálogo: os 3 cremes para mãos são de 50 g (os 5 cremes corporais seguem 140 g) e "Rescue SOS" virou "S.O.S." nos nomes e textos.
 * O frete NÃO lê o "content" do catálogo (usa o peso gravado em products.weight_grams): ver o SQL 54a de conferência.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bioProducts } from "../src/lib/catalog/bio-products.ts";

const root = new URL("../", import.meta.url);

test("creme para mãos: 3 produtos de 50 g; creme corporal continua 140 g", () => {
  const hands = bioProducts.filter((p) => p.category === "Creme Mãos");
  const body = bioProducts.filter((p) => p.category === "Creme Corpo");

  assert.equal(hands.length, 3);
  assert.ok(hands.every((p) => p.content === "50g"));
  assert.equal(body.length, 5);
  assert.ok(body.every((p) => p.content === "140g"));
});

test("'Rescue SOS' virou 'S.O.S.' nos nomes do catálogo e nos textos de produto (os slugs não mudam)", () => {
  assert.ok(!bioProducts.some((p) => /rescue sos/i.test(p.name)), "nenhum nome 'Rescue SOS'");
  assert.ok(bioProducts.some((p) => p.slug === "cosmeticos-creme-corpo-rescue-sos" && p.name === "S.O.S."), "o slug antigo continua e o nome é S.O.S.");
  assert.ok(!/Rescue SOS/.test(readFileSync(new URL("src/lib/content/product-content.ts", root), "utf8")));
});

test("SQLs de conferência: 54a só lê (peso do frete dos cremes e nome no banco); 54b só troca o nome", () => {
  const a = readFileSync(new URL("sql/b2b/54a_creme_maos_peso_conferencia_one_shot.sql", root), "utf8");
  const b = readFileSync(new URL("sql/b2b/54b_rescue_sos_nome.sql", root), "utf8");

  assert.ok(a.includes("weight_grams") && !/UPDATE|DELETE|INSERT|DROP/i.test(a));
  assert.ok(b.includes("UPDATE products SET name = 'S.O.S.' WHERE name = 'Rescue SOS'") && !/DELETE|DROP|TRUNCATE/i.test(b));
});
