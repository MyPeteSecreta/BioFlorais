/*
 * Rodada 5 / V5: dados de TESTE são marcados e ARQUIVADOS (nada é apagado), com desfazer;
 * pedido pago de verdade só com confirmação; arquivado some do acompanhamento e das listas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { archiveSelected, listBatches, listTestCandidates, restoreBatch } = await import("../src/lib/b2b/test-data.ts");
const { andNotArchived, notArchivedCondition, resetArchiveCache } = await import("../src/lib/b2b/archive.ts");
const { findOrderForTracking, findOrdersByEmailAndDocument, listClientOrders } = await import("../src/lib/order-tracking.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const V_TEST = UUID(1);
const V_REAL = UUID(2);
const C_TEST = UUID(11);
const C_REAL = UUID(12);
const CUSTOMER = UUID(21);
const O_VENDOR_TEST = UUID(31); // pedido de vendedor de teste, não pago
const O_COUPON = UUID(32); // cupom TESTEB2B95 pago (teste)
const O_PAID_REAL = UUID(33); // vendedor de teste, mas PAGO DE VERDADE (sem cupom)
const O_REAL = UUID(34); // tudo real
const O_CLIENT_TEST = UUID(35);
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh({ withColumns = true } = {}) {
  resetArchiveCache();
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, email text, status text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text, contact_name text, email text, active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text, cpf text, cnpj text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, fulfillment_status text, total_cents int, payment_method text, coupon_code text,
      b2b_responsible_id uuid, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp DEFAULT now());
    INSERT INTO b2b_responsibles (id, name, email, status) VALUES
      ('${V_TEST}', 'Vendedor Teste', 'vteste@example.invalid', 'active'), ('${V_REAL}', 'Maria Vendas', 'maria@loja.com', 'active');
    INSERT INTO b2b_clients (id, display_name, email) VALUES ('${C_TEST}', 'Loja de Teste', 'x@loja.com'), ('${C_REAL}', 'Loja Real', 'real@loja.com');
    INSERT INTO customers VALUES ('${CUSTOMER}', 'Ana', 'ana@exemplo.com', '123.456.789-09', NULL);
    INSERT INTO orders (id, customer_id, status, fulfillment_status, total_cents, coupon_code, b2b_responsible_id, b2b_client_id, b2b_offer_id) VALUES
      ('${O_VENDOR_TEST}', '${CUSTOMER}', 'pending', 'awaiting_payment', 1000, NULL, '${V_TEST}', '${C_REAL}', '${UUID(90)}'),
      ('${O_COUPON}', '${CUSTOMER}', 'paid', 'paid_to_prepare', 2000, 'testeb2b95', '${V_REAL}', '${C_REAL}', '${UUID(90)}'),
      ('${O_PAID_REAL}', '${CUSTOMER}', 'paid', 'paid_to_prepare', 3000, NULL, '${V_TEST}', '${C_REAL}', '${UUID(90)}'),
      ('${O_REAL}', '${CUSTOMER}', 'paid', 'paid_to_prepare', 4000, NULL, '${V_REAL}', '${C_REAL}', '${UUID(90)}'),
      ('${O_CLIENT_TEST}', '${CUSTOMER}', 'pending', 'awaiting_payment', 500, NULL, '${V_REAL}', '${C_TEST}', '${UUID(90)}');
  `);

  if (withColumns) await pg.exec(read("sql/b2b/32b_dados_de_teste.sql"));
}

test("32a/32b: preflight em uma linha JSON com o que seria arquivado; 32b aditivo e idempotente", async () => {
  await fresh({ withColumns: false });
  const [pre] = await run(read("sql/b2b/32a_dados_de_teste_preflight_one_shot.sql"));
  const info = pre.preflight_dados_de_teste;
  assert.equal(info.colunas_existem, false);
  assert.equal(info.vendedores.length, 1);
  assert.equal(info.clientes.length, 1);
  assert.equal(info.pedidos_total, 4);
  assert.equal(info.pedidos_com_cupom_de_teste, 1);
  assert.equal(info.pedidos_pagos_de_verdade.length, 1);
  const sql = read("sql/b2b/32b_dados_de_teste.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  await pg.exec(sql);
  assert.equal((await run(read("sql/b2b/32a_dados_de_teste_preflight_one_shot.sql")))[0].preflight_dados_de_teste.colunas_existem, true);
});

test("candidatos: 'teste' no nome/e-mail, @example.invalid, cupom TESTEB2B95; pago de verdade marcado", async () => {
  await fresh();
  const c = await listTestCandidates(run);
  assert.deepEqual(c.responsibles.map((r) => r.id), [V_TEST]);
  assert.deepEqual(c.clients.map((r) => r.id), [C_TEST]);
  assert.deepEqual(c.orders.map((o) => o.id).sort(), [O_VENDOR_TEST, O_COUPON, O_PAID_REAL, O_CLIENT_TEST].sort());
  assert.equal(c.orders.find((o) => o.id === O_PAID_REAL).paidForReal, true);
  assert.equal(c.orders.find((o) => o.id === O_COUPON).paidForReal, false, "pago COM cupom de teste não é pago de verdade");
  assert.ok(!c.orders.some((o) => o.id === O_REAL));
});

test("arquivar: herda pedidos, pago de verdade fica de fora sem confirmação, nada é apagado, desfazer volta tudo", async () => {
  await fresh();
  const result = await archiveSelected(run, { responsibleIds: [V_TEST], clientIds: [C_TEST], orderIds: [O_COUPON] });
  assert.equal(result.responsibles, 1);
  assert.equal(result.clients, 1);
  assert.deepEqual(result.skippedPaid, [O_PAID_REAL]);
  const archived = (await run(`SELECT id FROM orders WHERE archived_at IS NOT NULL ORDER BY id`)).map((r) => r.id);
  assert.deepEqual(archived, [O_VENDOR_TEST, O_COUPON, O_CLIENT_TEST]);
  assert.equal((await run(`SELECT count(*)::int AS n FROM orders`))[0].n, 5, "nada apagado");
  const [v] = await run(`SELECT status, is_test, archived_at IS NOT NULL AS arq FROM b2b_responsibles WHERE id = $1`, [V_TEST]);
  assert.deepEqual(v, { status: "inactive", is_test: true, arq: true });
  const [c] = await run(`SELECT active, is_test FROM b2b_clients WHERE id = $1`, [C_TEST]);
  assert.deepEqual(c, { active: false, is_test: true });
  assert.equal((await run(`SELECT archived_at FROM b2b_responsibles WHERE id = $1`, [V_REAL]))[0].archived_at, null, "real intocado");
  assert.equal((await run(`SELECT archived_at FROM orders WHERE id = $1`, [O_REAL]))[0].archived_at, null);

  // some dos candidatos
  assert.equal((await listTestCandidates(run)).responsibles.length, 0);

  // confirmação linha a linha do pago de verdade
  const again = await archiveSelected(run, { orderIds: [O_PAID_REAL], confirmedPaidOrderIds: [O_PAID_REAL] });
  assert.equal(again.orders, 1);

  // desfazer: primeiro lote volta vendedor/cliente com o status anterior
  const batches = await listBatches(run);
  assert.equal(batches.length, 2);
  const first = batches.find((b) => b.responsibles === 1);
  const back = await restoreBatch(run, first.batchId);
  assert.equal(back.restored, 5);
  const [v2] = await run(`SELECT status, is_test, archived_at FROM b2b_responsibles WHERE id = $1`, [V_TEST]);
  assert.deepEqual(v2, { status: "active", is_test: false, archived_at: null });
  assert.equal((await run(`SELECT active FROM b2b_clients WHERE id = $1`, [C_TEST]))[0].active, true);
  assert.equal((await run(`SELECT count(*)::int AS n FROM orders WHERE archived_at IS NOT NULL`))[0].n, 1);
});

test("arquivado some do acompanhamento do cliente (número, e-mail+CPF, Meus pedidos); antes do 32b nada muda", async () => {
  await fresh();
  const NOW = new Date();
  assert.equal(await findOrderForTracking(run, O_COUPON.slice(0, 8), "ana@exemplo.com"), O_COUPON);
  const before = await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "123.456.789-09", NOW);
  assert.equal(before.length, 5);
  assert.equal((await listClientOrders(run, C_REAL)).length, 4);

  await archiveSelected(run, { orderIds: [O_COUPON] });
  assert.equal(await findOrderForTracking(run, O_COUPON.slice(0, 8), "ana@exemplo.com"), null);
  assert.equal((await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "123.456.789-09", NOW)).length, 4);
  assert.equal((await listClientOrders(run, C_REAL)).length, 3);

  // sem as colunas (SQL 32b não aplicado) o filtro não existe e nada quebra
  await fresh({ withColumns: false });
  assert.equal(await andNotArchived(run, "orders", "o"), "");
  assert.equal(await notArchivedCondition(run, "orders"), "TRUE");
  assert.equal((await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "123.456.789-09", NOW)).length, 5);
});

test("filtros ligados em comissões, boletos, acompanhamento, histórico, clientes, Central e admin; aba e rota existem", () => {
  for (const f of [
    "src/lib/b2b/commissions.ts",
    "src/lib/b2b/boleto-installments.ts",
    "src/lib/order-tracking.ts",
    "src/lib/b2b/purchase-history.ts",
    "src/lib/b2b/ownership.ts",
    "src/app/api/admin/b2b/commissions/route.ts",
    "src/app/api/admin/b2b/boletos/route.ts",
  ]) {
    assert.ok(read(f).includes("andNotArchived"), f);
  }
  for (const f of ["src/app/admin/(protected)/pedidos/page.tsx", "src/app/api/admin/b2b/tracking/route.ts", "src/app/api/admin/b2b/responsibles/route.ts"]) {
    assert.ok(read(f).includes("notArchivedCondition"), f);
  }
  assert.ok(read("src/components/admin/b2b/AdminB2BTabs.tsx").includes("Dados de teste"));
  const route = read("src/app/api/admin/b2b/test-data/route.ts");
  assert.ok(route.indexOf("isAdminRequest") > 0 && route.includes("restoreBatch") && route.includes("archiveSelected"));
  assert.ok(read("src/components/admin/b2b/TestDataTab.tsx").includes("PAGO DE VERDADE"));
  assert.ok(!/\bDELETE FROM\b/i.test(read("src/lib/b2b/test-data.ts")), "nunca apaga");
});
