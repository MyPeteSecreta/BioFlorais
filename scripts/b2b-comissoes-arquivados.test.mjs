/*
 * Admin → Comissões: "Todos os vendedores" + troca de mês mostra os pedidos de cada mês; pedidos
 * arquivados (dados de teste) saem por padrão, mas ficam contados e podem ser mostrados.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

const { loadCommissionRows } = await import("../src/lib/b2b/commissions.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const [V1, V2, CLIENT, OFFER, PRODUCT] = [UUID(1), UUID(2), UUID(3), UUID(4), UUID(5)];
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

test("todos os vendedores x mês; arquivados fora por padrão e visíveis com includeArchived", async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, total_cents int, shipping_cents int,
      b2b_responsible_id uuid, b2b_responsible_name text, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp DEFAULT now(), archived_at timestamp);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int,
      commission_base_percent numeric, commission_extra_percent numeric, commission_total_percent numeric, commission_basis text);
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, status text, created_at timestamp DEFAULT now());
    INSERT INTO b2b_responsibles VALUES ('${V1}', 'Vendedor 1'), ('${V2}', 'Vendedor 2');
    INSERT INTO b2b_clients VALUES ('${CLIENT}', 'Cliente');
    INSERT INTO products VALUES ('${PRODUCT}', 'x', 'X', 'Shampoo', 'adulto');
    INSERT INTO orders (id, status, payment_method, total_cents, shipping_cents, b2b_responsible_id, b2b_client_id, b2b_offer_id, created_at, archived_at) VALUES
      ('${UUID(10)}', 'paid', 'pix', 10000, 1000, '${V1}', '${CLIENT}', '${OFFER}', '2026-09-05 12:00', NULL),
      ('${UUID(11)}', 'paid', 'pix', 20000, 1000, '${V2}', '${CLIENT}', '${OFFER}', '2026-10-05 12:00', NULL),
      ('${UUID(12)}', 'paid', 'pix', 30000, 1000, '${V2}', '${CLIENT}', '${OFFER}', '2026-10-06 12:00', now());
    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, commission_base_percent, commission_extra_percent, commission_total_percent) VALUES
      ('${UUID(10)}', '${PRODUCT}', 1, 9000, 10, 15, 25), ('${UUID(11)}', '${PRODUCT}', 1, 19000, 10, 15, 25), ('${UUID(12)}', '${PRODUCT}', 1, 29000, 10, 15, 25);
  `);

  const ids = (rows) => rows.map((row) => row.orderId).sort();

  assert.deepEqual(ids(await loadCommissionRows(run, {})), [UUID(10), UUID(11)].sort(), "todos os vendedores, sem arquivados");
  assert.deepEqual(ids(await loadCommissionRows(run, { month: "2026-09" })), [UUID(10)]);
  assert.deepEqual(ids(await loadCommissionRows(run, { month: "2026-10" })), [UUID(11)]);
  assert.deepEqual(ids(await loadCommissionRows(run, { month: "2026-08" })), []);

  const withArchived = await loadCommissionRows(run, { month: "2026-10", includeArchived: true });
  assert.deepEqual(ids(withArchived), [UUID(11), UUID(12)].sort());
  assert.deepEqual(withArchived.filter((row) => row.archived).map((row) => row.orderId), [UUID(12)]);
  assert.ok(withArchived.every((row) => typeof row.baseCents === "number"));
  await pg.close();
});
