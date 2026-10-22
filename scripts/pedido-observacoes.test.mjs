/*
 * Rodada 19a — Observações do pedido (até 500) no checkout B2C/B2B/Lançar pedido, gravadas no pedido, no admin, na Central
 * e no Omie; e validação do complemento (60 caracteres, sem quebra de linha nem símbolos), com mensagem clara.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const note = await import("../src/lib/order-note.ts");
const server = await import("../src/lib/order-note-server.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const ORDER = "10000000-0000-4000-8000-000000000001";

test("observações: vazio = null; até 500 passa; 501 recusa com mensagem; controle removido; quebras preservadas", () => {
  assert.deepEqual(note.validateOrderNote(""), { ok: true, value: null });
  assert.deepEqual(note.validateOrderNote("   "), { ok: true, value: null });
  assert.equal(note.validateOrderNote("a".repeat(500)).value.length, 500);
  const long = note.validateOrderNote("a".repeat(501));
  assert.equal(long.ok, false);
  assert.match(long.error, /máximo de 500 caracteres \(você escreveu 501\)/);
  assert.equal(note.validateOrderNote("Entregar\u0000 após\u0007 as 14h").value, "Entregar após as 14h");
  assert.equal(note.validateOrderNote("linha 1\r\nlinha 2\n\n\n\nlinha 3").value, "linha 1\nlinha 2\n\nlinha 3");
  assert.equal(note.validateOrderNote(null).value, null);
});

test("complemento: curto e limpo; instrução comprida e símbolos recusados com orientação", () => {
  for (const ok of ["", "Apto 12", "Bloco B, sala 3", "Sala 12 - 2º andar", "Fundos (casa 2)", "Loja 5/6 #A", "ap. 41 & 42"]) {
    assert.equal(note.validateComplement(ok).ok, true, ok);
  }
  assert.equal(note.validateComplement("").value, null);
  assert.equal(note.validateComplement("  Apto   12 ").value, "Apto 12", "espaços normalizados");

  const tooLong = note.validateComplement("Deixar com o porteiro e ligar antes de chegar porque a campainha não funciona direito");
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error, /máximo de 60 caracteres/);
  assert.match(tooLong.error, /Observações do pedido/);

  assert.equal(note.validateComplement("Apto 12\nBloco B").value, "Apto 12 Bloco B", "quebra de linha vira espaço");
  for (const bad of ["Apto <12>", "casa; fundos", 'portão "azul"', "apto 12 | bloco", "apto 12 😀"]) {
    const result = note.validateComplement(bad);
    assert.equal(result.ok, false, bad);
    assert.match(result.error, /Complemento/);
  }
  assert.equal(note.validateComplement("Apto 60 ".repeat(7).trim().slice(0, 60)).ok, true, "exatamente 60");
});

test("Omie: observação do cliente vira uma linha prefixada, sem quebras", () => {
  assert.equal(note.omieNoteLine("Entregar às 14h\nLigar antes"), "OBS DO CLIENTE: Entregar às 14h / Ligar antes");
  assert.equal(note.omieNoteLine(""), null);
  assert.equal(note.omieNoteLine(null), null);
});

test("servidor: grava e lê a observação; tolera a coluna ausente; sem alterar pedido que já tem outra", async () => {
  const old = new PGlite();
  await old.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text); INSERT INTO orders VALUES ('${ORDER}', 'pending');`);
  const runOld = async (text, params = []) => (await old.query(text, params)).rows;
  assert.equal(await server.attachOrderNote(runOld, ORDER, "Entregar às 14h"), false, "sem a coluna: inerte");
  assert.equal(await server.loadOrderNote(runOld, ORDER), null);

  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text); INSERT INTO orders VALUES ('${ORDER}', 'pending');`);
  await pg.exec(readFileSync(new URL("../sql/b2b/46b_observacoes_pedido.sql", import.meta.url), "utf8"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  assert.equal(await server.attachOrderNote(run, ORDER, "Entregar às 14h\nLigar antes"), true);
  assert.equal(await server.loadOrderNote(run, ORDER), "Entregar às 14h\nLigar antes");
  assert.equal(await server.attachOrderNote(run, ORDER, ""), false, "vazio não grava");
  assert.equal(await server.attachOrderNote(run, "nao-e-uuid", "x"), false);
});

test("46a/46b: aditivo, idempotente, linha final ok; conferência antes e depois", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE orders (id uuid PRIMARY KEY, status text); CREATE TABLE addresses (id uuid PRIMARY KEY, complement text);
    INSERT INTO addresses VALUES ('20000000-0000-4000-8000-000000000001', 'Deixar com o porteiro e ligar antes de chegar porque a campainha nao funciona direito');`);
  const conf = readFileSync(new URL("../sql/b2b/46a_observacoes_pedido_conferencia_one_shot.sql", import.meta.url), "utf8");
  const before = (await pg.query(conf)).rows[0].conferencia_observacoes_pedido;
  assert.equal(before.coluna_customer_note_existe, false);
  assert.equal(before.complementos_acima_de_60, 1);

  const sql = readFileSync(new URL("../sql/b2b/46b_observacoes_pedido.sql", import.meta.url), "utf8");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.equal((await pg.exec(sql)).at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);
  const after = (await pg.query(conf)).rows[0].conferencia_observacoes_pedido;
  assert.equal(after.coluna_customer_note_existe, true);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(conf.replace(/--.*$/gm, "")), "conferência é só leitura");
});

test("ligações: B2C, B2B e Lançar pedido (mesmo checkout) validam e gravam; admin, impressão, Central e Omie mostram", () => {
  const b2c = read("src/app/api/orders/create/route.ts");
  assert.ok(b2c.includes("validateComplement(address.complement)") && b2c.includes("validateOrderNote(body.orderNote)"));
  assert.ok(b2c.includes("attachOrderNote(getAppSqlRunner(), order.id, noteCheck.value)"));
  assert.ok(b2c.includes("complementCheck.value"), "grava o complemento validado");

  const b2b = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(b2b.includes("validateComplement(body.address?.complement)") && b2b.includes("validateOrderNote(body.orderNote)"));
  assert.ok(b2b.includes("attachOrderNote(getAppSqlRunner(), order.id, noteCheck.value)"), "vale para o pedido lançado pelo vendedor também (mesma rota)");

  const checkoutB2C = read("src/app/checkout/page.tsx");
  assert.ok(checkoutB2C.includes('name="orderNote"') && checkoutB2C.includes("maxLength={ORDER_NOTE_MAX}") && checkoutB2C.includes('readField("orderNote")'));
  const checkoutB2B = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.ok(checkoutB2B.includes("orderNote,") && checkoutB2B.includes("maxLength={ORDER_NOTE_MAX}") && checkoutB2B.includes("validateComplement(complement)"));
  assert.ok(read("src/components/b2b/LaunchOrder.tsx").length > 0);

  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/page.tsx").includes("Observações do cliente:"));
  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/imprimir/page.tsx").includes("Observações do cliente"));
  const central = read("src/lib/central/brand-api.ts");
  assert.ok(central.includes("omieNoteLine(") && central.includes("customer_note") && central.includes("observations.push(noteLine)"));
  assert.ok(read("src/lib/central/contract.ts").includes("customerNote"));
});
