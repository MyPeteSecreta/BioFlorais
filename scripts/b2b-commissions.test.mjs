/*
 * C9 (Rodada 3): "Minhas comissões" — base sem frete, percentual ponderado do
 * snapshot, situação (aguardando / a receber dia 10 / paga / cancelada), boleto
 * sem baixa não vira "a receber", isolamento por vendedor e totais.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import { commissionState, loadCommissionRows, payableOnFor, totalsFor } from "../src/lib/b2b/commissions.ts";

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const VENDOR_A = UUID(1);
const VENDOR_B = UUID(2);
const CLIENT_A = UUID(3);
const CLIENT_B = UUID(4);
const OFFER = UUID(5);
const PRODUCT = UUID(6);

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");

let seq = 100;
async function order({ vendor = VENDOR_A, client = CLIENT_A, status = "paid", method = "pix", total = 10000, shipping = 1000, createdAt = "2026-10-05 12:00:00", paidAt = null, items = [[5000, 1, 10, 15, 25], [4000, 1, 10, 8, 18]] }) {
  const id = UUID(++seq);
  await run(
    `INSERT INTO orders (id, status, payment_method, total_cents, shipping_cents, b2b_responsible_id, b2b_responsible_name, b2b_client_id, b2b_offer_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'Vendedor',$7,$8,$9)`,
    [id, status, method, total, shipping, vendor, client, OFFER, createdAt]
  );
  for (const [price, qty, base, extra, totalPct] of items) {
    await run(
      `INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, commission_base_percent, commission_extra_percent, commission_total_percent, commission_basis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'normal_price')`,
      [id, PRODUCT, qty, price, base, extra, totalPct]
    );
  }
  // item bonificado (preço 0) com os mesmos percentuais: não pode pesar
  await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, commission_base_percent, commission_extra_percent, commission_total_percent) VALUES ($1,$2,2,0,10,15,25)`, [id, PRODUCT]);
  if (paidAt) await run(`INSERT INTO payments (order_id, status, created_at) VALUES ($1,'paid',$2)`, [id, paidAt]);
  return id;
}

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, total_cents int, shipping_cents int,
      b2b_responsible_id uuid, b2b_responsible_name text, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int,
      commission_base_percent numeric, commission_extra_percent numeric, commission_total_percent numeric, commission_basis text);
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, status text, created_at timestamp DEFAULT now());
    INSERT INTO b2b_responsibles VALUES ('${VENDOR_A}', 'Vendedor A'), ('${VENDOR_B}', 'Vendedor B');
    INSERT INTO b2b_clients VALUES ('${CLIENT_A}', 'Cliente A'), ('${CLIENT_B}', 'Cliente B');
  `);
  await pg.exec(sqlFile("18b_comissoes_pagas.sql"));
  await pg.exec(sqlFile("18b_comissoes_pagas.sql")); // idempotente
});

after(async () => {
  await pg?.close();
});

test("dia 10 do mês seguinte ao recebimento (calendário de São Paulo, vira o ano)", () => {
  assert.equal(payableOnFor(new Date("2026-10-15T15:00:00Z")).toISOString().slice(0, 10), "2026-11-10");
  assert.equal(payableOnFor(new Date("2026-12-20T15:00:00Z")).toISOString().slice(0, 10), "2027-01-10");
  // 31/10 23:30 em São Paulo = 01/11 02:30 UTC: ainda é outubro lá, então vence em 10/11 (não 10/12).
  assert.equal(payableOnFor(new Date("2026-11-01T02:30:00Z")).toISOString().slice(0, 10), "2026-11-10");
});

test("situação: boleto sem baixa NUNCA vira 'a receber' (nem pelo vencimento); cancelada zera; paga ao vendedor vence", () => {
  const received = new Date("2026-10-15T15:00:00Z");
  assert.equal(commissionState({ orderStatus: "paid", paymentMethod: "pix", receivedAt: received, paidOutAt: null }), "a_receber");
  assert.equal(commissionState({ orderStatus: "pending", paymentMethod: "pix", receivedAt: null, paidOutAt: null }), "aguardando");
  assert.equal(commissionState({ orderStatus: "paid", paymentMethod: "boleto", receivedAt: null, paidOutAt: null }), "aguardando");
  assert.equal(commissionState({ orderStatus: "pending", paymentMethod: "boleto", receivedAt: null, paidOutAt: null }), "aguardando");
  assert.equal(commissionState({ orderStatus: "cancelled", paymentMethod: "pix", receivedAt: received, paidOutAt: null }), "cancelada");
  assert.equal(commissionState({ orderStatus: "refunded", paymentMethod: "pix", receivedAt: received, paidOutAt: received }), "cancelada");
  assert.equal(commissionState({ orderStatus: "paid", paymentMethod: "pix", receivedAt: received, paidOutAt: received }), "paga");
});

test("pedido pago: base sem frete, % ponderado pelo valor (bonificado pesa 0), comissão e data a receber", async () => {
  const id = await order({ paidAt: "2026-10-15 15:00:00" });
  const rows = await loadCommissionRows(run, { responsibleId: VENDOR_A });
  const row = rows.find((item) => item.orderId === id);

  assert.equal(row.baseCents, 9000); // 10000 - 1000 de frete
  assert.deepEqual([row.basePercent, row.extraPercent, row.totalPercent], [10, 11.89, 21.89]); // (5000*25 + 4000*18) / 9000
  assert.equal(row.commissionCents, 1970); // 9000 x 21,888...%
  assert.equal(row.state, "a_receber");
  assert.equal(row.payableOn.toISOString().slice(0, 10), "2026-11-10");
});

test("boleto gerado/aguardando e Pix pendente: 'aguardando'; boleto 'paid' sem baixa continua aguardando", async () => {
  const pending = await order({ status: "pending", method: "pix" });
  const boleto = await order({ status: "pending", method: "boleto" });
  const boletoPaidNoBaixa = await order({ status: "paid", method: "boleto" });
  const rows = await loadCommissionRows(run, { responsibleId: VENDOR_A });

  for (const id of [pending, boleto, boletoPaidNoBaixa]) {
    assert.equal(rows.find((row) => row.orderId === id).state, "aguardando");
  }
});

test("cancelada zera e entra como 'cancelada'; marcar paga (b2b_commission_payouts) vira 'Paga'", async () => {
  const cancelled = await order({ status: "cancelled", paidAt: "2026-10-16 10:00:00" });
  const paid = await order({ paidAt: "2026-09-12 10:00:00", createdAt: "2026-09-12 09:00:00" });
  await run(`INSERT INTO b2b_commission_payouts (order_id, paid_at, created_by) VALUES ($1, '2026-10-10', 'admin')`, [paid]);

  const rows = await loadCommissionRows(run, { responsibleId: VENDOR_A });
  assert.equal(rows.find((row) => row.orderId === cancelled).state, "cancelada");
  const paidRow = rows.find((row) => row.orderId === paid);
  assert.equal(paidRow.state, "paga");
  assert.equal(paidRow.paidOutAt.toISOString().slice(0, 10), "2026-10-10");
});

test("isolamento: o vendedor só vê os próprios pedidos; filtros por cliente e mês", async () => {
  const other = await order({ vendor: VENDOR_B, client: CLIENT_B, paidAt: "2026-10-15 15:00:00" });
  const mineClientB = await order({ client: CLIENT_B, paidAt: "2026-08-20 15:00:00", createdAt: "2026-08-20 14:00:00" });

  const mine = await loadCommissionRows(run, { responsibleId: VENDOR_A });
  assert.ok(!mine.some((row) => row.orderId === other), "pedido de outro vendedor não aparece");
  assert.ok(mine.every((row) => row.responsibleId === VENDOR_A));

  const onlyClientB = await loadCommissionRows(run, { responsibleId: VENDOR_A, clientId: CLIENT_B });
  assert.deepEqual(onlyClientB.map((row) => row.orderId), [mineClientB]);

  const august = await loadCommissionRows(run, { responsibleId: VENDOR_A, month: "2026-08" });
  assert.deepEqual(august.map((row) => row.orderId), [mineClientB]);

  // Filtros inválidos são ignorados (nunca chegam ao SQL como texto livre).
  const garbage = await loadCommissionRows(run, { responsibleId: "x'; DROP TABLE orders;--", month: "2026-13" });
  assert.ok(garbage.length > 0); // sem filtro de vendedor/mês: lista tudo (admin), sem erro de SQL
});

test("totais: próximo dia 10, meses seguintes, já recebido e aguardando", async () => {
  const rows = await loadCommissionRows(run, { responsibleId: VENDOR_A });
  const totals = totalsFor(rows, new Date("2026-10-20T12:00:00Z"));

  assert.ok(totals.nextTenthCents > 0);
  assert.equal(totals.nextTenthDate.toISOString().slice(0, 10), "2026-11-10");
  assert.ok(totals.receivedCents > 0); // o pedido marcado como pago ao vendedor
  assert.ok(totals.waitingCents > 0); // pendente/boleto
  assert.equal(totals.laterCents >= 0, true);
});

test("19b (convite com token cifrado) é idempotente", async () => {
  await pg.exec(`CREATE TABLE b2b_responsible_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text)`);
  await pg.exec(sqlFile("19b_convite_copia_cifrada.sql"));
  await pg.exec(sqlFile("19b_convite_copia_cifrada.sql"));
  const cols = await run(`SELECT 1 FROM information_schema.columns WHERE table_name='b2b_responsible_invites' AND column_name='token_ciphertext'`);
  assert.equal(cols.length, 1);
});
