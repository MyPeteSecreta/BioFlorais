// Validação dos formulários do admin B2B.
// Rodar: node --test scripts/b2b-admin-input.test.mjs   (Node >= 23.6)
import assert from "node:assert/strict";
import { test } from "node:test";

import * as input from "../src/lib/b2b/admin-input.ts";

test("slug: sem acento, minúsculo, hífens", () => {
  assert.equal(input.slugify("Florais Pet — Ação & Calma"), "florais-pet-acao-calma");
  assert.equal(input.slugify("  --Linha  Kids-- "), "linha-kids");
  assert.equal(input.isValidSlug("linha-kids"), true);
  assert.equal(input.isValidSlug("Linha Kids"), false);
  assert.equal(input.isValidSlug("linha--kids"), false);
  assert.equal(input.isValidSlug(""), false);
});

test("lista de UUIDs: dedup, rejeita lixo", () => {
  const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  assert.deepEqual(input.parseUuidList([id, id.toUpperCase()]), [id]);
  assert.deepEqual(input.parseUuidList(undefined), []);
  assert.equal(input.parseUuidList([id, "x"]), null);
  assert.equal(input.parseUuidList("abc"), null);
});

test("inteiros com faixa", () => {
  assert.equal(input.parseInteger("3", { min: 1, max: 99 }), 3);
  assert.equal(input.parseInteger(0, { min: 1, max: 99 }), null);
  assert.equal(input.parseInteger(1.5, { min: 1, max: 99 }), null);
  assert.equal(input.parseInteger("", { min: 0, max: 99 }), null);
});

test("datas no fuso de São Paulo (início/fim do dia)", () => {
  assert.equal(input.parseSaoPauloDate("2026-10-01", "start").toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(input.parseSaoPauloDate("2026-10-31", "end").toISOString(), "2026-11-01T02:59:59.999Z");
  assert.equal(input.parseSaoPauloDate("", "start"), null);
  assert.equal(input.parseSaoPauloDate("2026-02-31", "start"), undefined);
  assert.equal(input.parseSaoPauloDate("01/10/2026", "start"), undefined);
  assert.equal(input.toSaoPauloDateInput("2026-11-01T02:59:59.999Z"), "2026-10-31");
  assert.equal(input.toSaoPauloDateInput(null), "");
});
