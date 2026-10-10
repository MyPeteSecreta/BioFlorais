/*
 * "Boletos a receber": TODA solicitação de boleto de pedido NÃO arquivado aparece (com ou sem cronograma,
 * mesmo sem oferta gravada no pedido); pedido arquivado (teste) some, mas é contado e pode ser mostrado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

const { loadBoletoInstallments } = await import("../src/lib/b2b/boleto-installments.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text);
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, b2b_client_id uuid, b2b_responsible_id uuid, b2b_responsible_name text,
      b2b_offer_id uuid, created_at timestamp DEFAULT now(), archived_at timestamp);
    CREATE TABLE b2b_boleto_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, amount_cents int, installments int,
      installment_amount_cents int, last_installment_amount_cents int, schedule jsonb);
    CREATE TABLE b2b_boleto_payments (order_id uuid, installment int, paid_at date, paid_cents int, note text);
    INSERT INTO b2b_clients VALUES ('${UUID(1)}', 'Loja Real');
    INSERT INTO b2b_responsibles VALUES ('${UUID(2)}', 'Maria');
    INSERT INTO orders (id, status, b2b_client_id, b2b_responsible_id, b2b_offer_id, archived_at) VALUES
      ('${UUID(10)}', 'pending', '${UUID(1)}', '${UUID(2)}', '${UUID(90)}', NULL),
      ('${UUID(11)}', 'pending', '${UUID(1)}', '${UUID(2)}', NULL, NULL),
      ('${UUID(12)}', 'pending', '${UUID(1)}', '${UUID(2)}', '${UUID(90)}', now()),
      ('${UUID(13)}', 'pending', '${UUID(1)}', '${UUID(2)}', '${UUID(90)}', NULL);
    INSERT INTO b2b_boleto_requests (order_id, amount_cents, installments, installment_amount_cents, last_installment_amount_cents, schedule) VALUES
      ('${UUID(10)}', 30000, 3, 10000, 10000, '[{"installment":1,"dueDate":"2026-11-07","amountCents":10000},{"installment":2,"dueDate":"2026-11-21","amountCents":10000},{"installment":3,"dueDate":"2026-12-05","amountCents":10000}]'),
      ('${UUID(11)}', 20000, 2, 10000, 10000, NULL),
      ('${UUID(12)}', 15000, 1, 15000, 15000, '[{"installment":1,"dueDate":"2026-11-07","amountCents":15000}]'),
      ('${UUID(13)}', 9000, 0, 9000, 9000, '[]');
  `);
}

test("toda solicitação de pedido não arquivado aparece: com cronograma, sem cronograma, sem oferta e com 0 parcelas", async () => {
  await fresh();
  const list = await loadBoletoInstallments(run, {}, new Date("2026-10-10T12:00:00Z"));
  const by = (id) => list.filter((item) => item.orderId === id);

  assert.equal(by(UUID(10)).length, 3);
  assert.deepEqual(by(UUID(10)).map((i) => [i.installment, i.dueDate, i.status]), [[1, "2026-11-07", "aberto"], [2, "2026-11-21", "aberto"], [3, "2026-12-05", "aberto"]]);
  assert.equal(by(UUID(11)).length, 2, "sem cronograma: parcelas pelo número de parcelas");
  assert.equal(by(UUID(11))[0].amountCents, 10000);
  assert.equal(by(UUID(13)).length, 1, "solicitação com 0 parcela ainda aparece (1 parcela)");
  assert.equal(by(UUID(13))[0].amountCents, 9000);
  assert.equal(by(UUID(12)).length, 0, "pedido arquivado fica de fora");
});

test("pedido arquivado: some por padrão, aparece (marcado) com includeArchived; baixa e desfazer seguem normais", async () => {
  await fresh();
  const withArchived = await loadBoletoInstallments(run, { includeArchived: true });
  const archived = withArchived.filter((item) => item.archived);
  assert.deepEqual(archived.map((i) => i.orderId), [UUID(12)]);
  assert.ok(withArchived.filter((item) => !item.archived).every((item) => item.archived === false));

  const open = await loadBoletoInstallments(run, { status: "aberto" });
  assert.ok(open.length >= 6);
  assert.equal((await loadBoletoInstallments(run, { responsibleId: UUID(2) })).length, 6);
});
