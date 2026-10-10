/*
 * Admin → Pedidos: "Marcar como teste e arquivar" vale para QUALQUER pedido (não só os de "teste");
 * pedido pago de verdade exige a confirmação extra; "approved" conta como pago; desfazer volta o pedido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { archiveSelected, listBatches, restoreBatch } = await import("../src/lib/b2b/test-data.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const [PENDING, PAID, APPROVED, COUPON] = [UUID(1), UUID(2), UUID(3), UUID(4)];
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, email text, status text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text, active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, coupon_code text, b2b_responsible_id uuid, b2b_client_id uuid, created_at timestamp DEFAULT now());
    INSERT INTO orders (id, status, coupon_code) VALUES
      ('${PENDING}', 'pending', NULL), ('${PAID}', 'paid', NULL), ('${APPROVED}', 'approved', NULL), ('${COUPON}', 'paid', 'TESTEB2B95');
  `);
  await pg.exec(read("sql/b2b/32b_dados_de_teste.sql"));
}

test("qualquer pedido pode ser arquivado como teste; o pago de verdade só com confirmação (paid e approved)", async () => {
  await fresh();
  const first = await archiveSelected(run, { orderIds: [PENDING, PAID, APPROVED, COUPON] });
  assert.equal(first.orders, 2, "pendente e o pago com cupom de teste");
  assert.deepEqual(first.skippedPaid.sort(), [PAID, APPROVED].sort());
  assert.deepEqual((await run(`SELECT id FROM orders WHERE archived_at IS NOT NULL ORDER BY id`)).map((r) => r.id), [PENDING, COUPON]);

  const second = await archiveSelected(run, { orderIds: [PAID, APPROVED], confirmedPaidOrderIds: [PAID, APPROVED] });
  assert.equal(second.orders, 2);
  assert.equal((await run(`SELECT count(*)::int AS n FROM orders WHERE is_test`))[0].n, 4);
  assert.equal((await run(`SELECT count(*)::int AS n FROM orders`))[0].n, 4, "nada apagado");

  // desfazer o lote do pago real devolve os dois
  const batch = (await listBatches(run)).find((b) => b.orders === 2 && !b.restored && b.batchId === second.batchId);
  assert.ok(batch);
  assert.equal((await restoreBatch(run, second.batchId)).restored, 2);
  assert.equal((await run(`SELECT count(*)::int AS n FROM orders WHERE archived_at IS NOT NULL`))[0].n, 2);
});

test("telas: ação em Pedidos (lote) e no detalhe, rota protegida; 'Limpar seleção' deixou de confundir", () => {
  const batch = read("src/components/admin/OrderBatchSelection.tsx");
  assert.ok(batch.includes("Marcar como teste e arquivar") && batch.includes("archiveOrdersAsTest"));
  assert.ok(!batch.includes("Limpar seleção"));
  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/page.tsx").includes("<ArchiveOrderButton"));
  const flow = read("src/components/admin/archive-orders.ts");
  assert.ok(flow.includes("confirmedPaidOrderIds") && flow.includes("PAGO"));
  const route = read("src/app/api/admin/orders/archive/route.ts");
  assert.ok(route.indexOf("isAdminRequest") > 0 && route.includes("archiveSelected"));
  assert.ok(!/\bDELETE FROM\b/i.test(route));
});
