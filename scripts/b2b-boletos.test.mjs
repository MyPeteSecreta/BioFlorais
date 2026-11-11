/*
 * C10 (Rodada 3, continuação): baixa de boletos por PARCELA. A comissão do
 * boleto vira "A receber" pela data da BAIXA (nunca pelo vencimento) e o
 * pedido só vira "Pago" quando todas as parcelas estão baixadas. Roda as
 * mesmas consultas do app num Postgres real em memória.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import { giveBaixa, installmentStatus, loadBoletoInstallments, todaySaoPaulo, undoBaixa } from "../src/lib/b2b/boleto-installments.ts";
import { loadCommissionRows } from "../src/lib/b2b/commissions.ts";

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const VENDOR = UUID(1);
const CLIENT = UUID(2);
const OFFER = UUID(3);
const PRODUCT = UUID(4);

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");
const NOW = new Date("2026-10-20T15:00:00Z"); // hoje (SP) = 2026-10-20

let seq = 100;
async function boletoOrder({ status = "pending", schedule, installments = 3, total = 150000, shipping = 0 } = {}) {
  const id = UUID(++seq);
  await run(
    `INSERT INTO orders (id, status, fulfillment_status, payment_method, total_cents, shipping_cents, b2b_responsible_id, b2b_responsible_name, b2b_client_id, b2b_offer_id, created_at)
     VALUES ($1,$2,'awaiting_payment','boleto',$3,$4,$5,'Vendedor',$6,$7,'2026-09-22 12:00:00')`,
    [id, status, total, shipping, VENDOR, CLIENT, OFFER]
  );
  await run(
    `INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, commission_base_percent, commission_extra_percent, commission_total_percent) VALUES ($1,$2,1,$3,10,15,25)`,
    [id, PRODUCT, total - shipping]
  );
  await run(
    `INSERT INTO b2b_boleto_requests (order_id, installments, installment_amount_cents, last_installment_amount_cents, schedule) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [id, installments, Math.floor(total / installments), total - Math.floor(total / installments) * (installments - 1), schedule === undefined ? JSON.stringify([
      { installment: 1, dueDate: "2026-10-20", amountCents: 50000 },
      { installment: 2, dueDate: "2026-11-03", amountCents: 50000 },
      { installment: 3, dueDate: "2026-11-17", amountCents: 50000 },
    ]) : schedule]
  );
  return id;
}

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    INSERT INTO products VALUES ('${PRODUCT}', 'cosmeticos-pet-shampoo-agressividade', 'Agressividade', 'Shampoo', 'cosmeticos-pet');
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, fulfillment_status text, payment_method text, total_cents int, shipping_cents int,
      b2b_responsible_id uuid, b2b_responsible_name text, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int,
      commission_base_percent numeric, commission_extra_percent numeric, commission_total_percent numeric, commission_basis text);
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, status text, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_boleto_requests (order_id uuid PRIMARY KEY, installments int, installment_amount_cents int,
      last_installment_amount_cents int, status text DEFAULT 'pending_request', schedule jsonb);
    INSERT INTO b2b_responsibles VALUES ('${VENDOR}', 'Vendedor A');
    INSERT INTO b2b_clients VALUES ('${CLIENT}', 'Cliente A');
  `);
  await pg.exec(sqlFile("18b_comissoes_pagas.sql"));
});

after(async () => {
  await pg?.close();
});

test("situação da parcela: Pago, Cancelado, Vencido (data de SP) e Em aberto", () => {
  const today = "2026-10-20";
  assert.equal(installmentStatus({ orderStatus: "pending", dueDate: "2026-10-19", paid: false, today }), "vencido");
  assert.equal(installmentStatus({ orderStatus: "pending", dueDate: "2026-10-20", paid: false, today }), "aberto"); // vence hoje: ainda em aberto
  assert.equal(installmentStatus({ orderStatus: "pending", dueDate: "2026-10-01", paid: true, today }), "pago");
  assert.equal(installmentStatus({ orderStatus: "cancelled", dueDate: "2026-10-01", paid: false, today }), "cancelado");
  assert.equal(installmentStatus({ orderStatus: "paid", dueDate: "2026-12-01", paid: true, today }), "pago");
  assert.equal(todaySaoPaulo(new Date("2026-10-21T01:30:00Z")), "2026-10-20"); // 22:30 em São Paulo
});

test("20b é idempotente e a chave dos pagamentos de comissão passa a ser (pedido, parcela)", async () => {
  await pg.exec(sqlFile("20b_boleto_baixa.sql"));
  await pg.exec(sqlFile("20b_boleto_baixa.sql"));

  const order = UUID(900);
  await run(`INSERT INTO orders (id, status, payment_method) VALUES ($1, 'paid', 'boleto')`, [order]);
  await run(`INSERT INTO b2b_commission_payouts (order_id, installment, paid_at) VALUES ($1, 1, '2026-11-10'), ($1, 2, '2026-12-10')`, [order]);
  const [{ total }] = await run(`SELECT count(*)::int AS total FROM b2b_commission_payouts WHERE order_id = $1`, [order]);
  assert.equal(total, 2);
  await assert.rejects(run(`INSERT INTO b2b_commission_payouts (order_id, installment, paid_at) VALUES ($1, 1, '2026-11-11')`, [order]));
});

test("lista por parcela: expande o cronograma, marca vencida e filtra", async () => {
  const id = await boletoOrder();
  const all = await loadBoletoInstallments(run, {}, NOW);
  const mine = all.filter((item) => item.orderId === id);

  assert.deepEqual(mine.map((item) => [item.installment, item.dueDate, item.amountCents, item.status]), [
    [1, "2026-10-20", 50000, "aberto"],
    [2, "2026-11-03", 50000, "aberto"],
    [3, "2026-11-17", 50000, "aberto"],
  ]);

  // Daqui a 10 dias a 1ª está vencida.
  const later = await loadBoletoInstallments(run, { status: "vencido" }, new Date("2026-10-30T15:00:00Z"));
  assert.ok(later.some((item) => item.orderId === id && item.installment === 1));
  assert.equal((await loadBoletoInstallments(run, { dueFrom: "2026-11-01", dueTo: "2026-11-10" }, NOW)).filter((i) => i.orderId === id).length, 1);
  assert.equal((await loadBoletoInstallments(run, { clientId: UUID(555) }, NOW)).length, 0);
});

test("boleto antigo sem cronograma: parcelas pelo nº de parcelas e valores gravados", async () => {
  const id = await boletoOrder({ schedule: null, installments: 3, total: 100000 });
  const mine = (await loadBoletoInstallments(run, {}, NOW)).filter((item) => item.orderId === id);

  assert.deepEqual(mine.map((item) => [item.installment, item.dueDate, item.amountCents]), [
    [1, null, 33333], [2, null, 33333], [3, null, 33334],
  ]);
});

test("baixa: valida data futura, valor diferente exige observação, não baixa duas vezes nem pedido cancelado", async () => {
  const id = await boletoOrder();

  assert.equal((await giveBaixa(run, { orderId: id, installment: 1, paidAt: "2026-10-25", paidCents: null, note: null }, NOW)).ok, false); // futura
  const noNote = await giveBaixa(run, { orderId: id, installment: 1, paidAt: "2026-10-20", paidCents: 49000, note: null }, NOW);
  assert.equal(noNote.ok, false);
  assert.match(noNote.error, /observação/);

  const ok = await giveBaixa(run, { orderId: id, installment: 1, paidAt: "2026-10-20", paidCents: 49000, note: "Desconto de pontualidade combinado" }, NOW);
  assert.deepEqual(ok, { ok: true, orderPaid: false });
  assert.equal((await giveBaixa(run, { orderId: id, installment: 1, paidAt: "2026-10-20", paidCents: null, note: null }, NOW)).status, 409);

  const cancelled = await boletoOrder({ status: "cancelled" });
  assert.equal((await giveBaixa(run, { orderId: cancelled, installment: 1, paidAt: "2026-10-20", paidCents: null, note: null }, NOW)).status, 409);

  const log = await run(`SELECT action, created_by FROM b2b_boleto_payment_log WHERE order_id = $1`, [id]);
  assert.deepEqual(log, [{ action: "baixa", created_by: "admin" }]);
});

test("COMISSÃO do boleto: por parcela, pela data da BAIXA (nunca pelo vencimento); sem baixa = aguardando", async () => {
  const id = await boletoOrder({ total: 150000, shipping: 0 });

  // Parcela 1 vence em 20/10 mas só é paga (baixada) em 25/11: a comissão segue a BAIXA.
  const lateNow = new Date("2026-11-26T12:00:00Z");
  await giveBaixa(run, { orderId: id, installment: 1, paidAt: "2026-11-25", paidCents: null, note: null }, lateNow);

  const rows = (await loadCommissionRows(run, { responsibleId: VENDOR })).filter((row) => row.orderId === id);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.installmentLabel), ["1/3", "2/3", "3/3"]);
  assert.equal(rows.reduce((sum, row) => sum + row.baseCents, 0), 150000); // base repartida sem sobra

  const [first, second, third] = rows;
  assert.equal(first.state, "a_receber");
  assert.equal(first.payableOn.toISOString().slice(0, 10), "2026-12-10"); // baixa em nov -> 10/12 (não 10/11, que seria pelo vencimento de out)
  assert.equal(first.commissionCents, Math.round((50000 * 25) / 100));
  assert.equal(second.state, "aguardando");
  assert.equal(third.state, "aguardando");
  assert.equal(second.payableOn, null);

  // Pedido ainda não está todo pago.
  const [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [id]);
  assert.deepEqual(order, { status: "pending", fulfillment_status: "awaiting_payment" });
});

test("todas as parcelas baixadas = pedido Pago (financeiro); desfazer baixa só volta o financeiro (a separação continua)", async () => {
  const id = await boletoOrder();
  const now = new Date("2026-11-20T12:00:00Z");

  assert.equal((await giveBaixa(run, { orderId: id, installment: 1, paidAt: "2026-10-20", paidCents: null, note: null }, now)).orderPaid, false);
  assert.equal((await giveBaixa(run, { orderId: id, installment: 2, paidAt: "2026-11-03", paidCents: null, note: null }, now)).orderPaid, false);
  const last = await giveBaixa(run, { orderId: id, installment: 3, paidAt: "2026-11-17", paidCents: null, note: null }, now);
  assert.deepEqual(last, { ok: true, orderPaid: true });

  let [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [id]);
  assert.deepEqual(order, { status: "paid", fulfillment_status: "paid_to_prepare" });

  // Desfazer exige motivo e devolve só o financeiro (boleto a prazo: a separação não depende do pagamento, 11/11).
  assert.equal((await undoBaixa(run, { orderId: id, installment: 3, reason: " " })).ok, false);
  assert.deepEqual(await undoBaixa(run, { orderId: id, installment: 3, reason: "Baixa lançada no pedido errado" }), { ok: true });
  [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [id]);
  assert.deepEqual(order, { status: "pending", fulfillment_status: "paid_to_prepare" });
  const parcels = (await loadBoletoInstallments(run, {}, now)).filter((item) => item.orderId === id);
  assert.deepEqual(parcels.map((item) => item.status), ["pago", "pago", "vencido"]);

  const log = await run(`SELECT action FROM b2b_boleto_payment_log WHERE order_id = $1 AND installment = 3 ORDER BY created_at, action`, [id]);
  assert.deepEqual(log.map((row) => row.action).sort(), ["baixa", "desfeita"]);
});

test("desfaz baixa mesmo com o pedido já enviado (só o financeiro volta); não desfaz se a comissão da parcela já foi paga", async () => {
  const shipped = await boletoOrder({ installments: 1, total: 50000, schedule: JSON.stringify([{ installment: 1, dueDate: "2026-10-20", amountCents: 50000 }]) });
  await giveBaixa(run, { orderId: shipped, installment: 1, paidAt: "2026-10-20", paidCents: null, note: null }, NOW);
  await run(`UPDATE orders SET fulfillment_status = 'shipped' WHERE id = $1`, [shipped]);
  assert.deepEqual(await undoBaixa(run, { orderId: shipped, installment: 1, reason: "teste" }), { ok: true });
  const [after] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [shipped]);
  assert.deepEqual(after, { status: "pending", fulfillment_status: "shipped" }, "a separação/envio não volta de etapa");

  const paidOut = await boletoOrder();
  await giveBaixa(run, { orderId: paidOut, installment: 1, paidAt: "2026-10-20", paidCents: null, note: null }, NOW);
  await run(`INSERT INTO b2b_commission_payouts (order_id, installment, paid_at) VALUES ($1, 1, '2026-11-10')`, [paidOut]);
  const blocked = await undoBaixa(run, { orderId: paidOut, installment: 1, reason: "teste" });
  assert.equal(blocked.status, 409);
  assert.match(blocked.error, /comissão desta parcela já foi paga/);
});

test("BUG da baixa às 23h em São Paulo: a data padrão é a de SP (não a de UTC, que já é amanhã e seria recusada)", async () => {
  const id = await boletoOrder();
  const at2330 = new Date("2026-10-21T02:30:00Z"); // 23:30 de 20/10 em São Paulo

  const utcDate = at2330.toISOString().slice(0, 10); // o que o prompt antigo preenchia: 2026-10-21
  assert.equal(utcDate, "2026-10-21");
  const old = await giveBaixa(run, { orderId: id, installment: 1, paidAt: utcDate, paidCents: null, note: null }, at2330);
  assert.equal(old.ok, false);
  assert.match(old.error, /futura/);

  const spDate = todaySaoPaulo(at2330);
  assert.equal(spDate, "2026-10-20");
  assert.deepEqual(await giveBaixa(run, { orderId: id, installment: 1, paidAt: spDate, paidCents: null, note: null }, at2330), { ok: true, orderPaid: false });
});

test("boleto a prazo B2B (11/11): liberado para separação ao registrar o boleto, sem ficar 'pago'; quitar não volta etapa; Pix/cartão e B2C não mudam", async () => {
  const { BOLETO_RELEASED_EVENT, FULFILLABLE_ORDER_SQL, canFulfillOrder, releaseBoletoForFulfillment } = await import("../src/lib/b2b/boleto-release.ts");
  await run(`CREATE TABLE IF NOT EXISTS order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, carrier text, tracking_code text, tracking_url text, note text, created_by text, created_at timestamp DEFAULT now())`);

  const id = await boletoOrder();
  await run(`UPDATE orders SET fulfillment_status = 'awaiting_payment' WHERE id = $1`, [id]);
  assert.equal(await releaseBoletoForFulfillment(run, id, "sistema", "teste"), true);
  assert.equal(await releaseBoletoForFulfillment(run, id, "admin", "de novo"), false, "idempotente");
  let [order] = await run(`SELECT status, fulfillment_status, payment_method, b2b_offer_id FROM orders WHERE id = $1`, [id]);
  assert.deepEqual([order.status, order.fulfillment_status], ["pending", "paid_to_prepare"], "liberado para separação, financeiro em aberto");
  const [event] = await run(`SELECT event, created_by FROM order_events WHERE order_id = $1`, [id]);
  assert.deepEqual(event, { event: BOLETO_RELEASED_EVENT, created_by: "sistema" }, "quem e quando");

  // aparece na fila de separação (Central/Omie) pela mesma regra
  const [listed] = await run(`SELECT count(*)::int AS n FROM orders o WHERE o.id = $1 AND ${FULFILLABLE_ORDER_SQL("o")} AND o.fulfillment_status = 'paid_to_prepare'`, [id]);
  assert.equal(listed.n, 1);
  assert.equal(canFulfillOrder({ status: "pending", paymentMethod: "boleto", b2bOfferId: "x", fulfillmentStatus: "paid_to_prepare" }), true);

  // separa e envia antes de pagar; quitar as parcelas não volta a etapa
  await run(`UPDATE orders SET fulfillment_status = 'shipped' WHERE id = $1`, [id]);
  const now = new Date("2026-11-20T12:00:00Z");
  for (const [n, d] of [[1, "2026-10-20"], [2, "2026-11-03"], [3, "2026-11-17"]]) await giveBaixa(run, { orderId: id, installment: n, paidAt: d, paidCents: null, note: null }, now);
  [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [id]);
  assert.deepEqual(order, { status: "paid", fulfillment_status: "shipped" });

  // cancelado sai da separação
  assert.equal(canFulfillOrder({ status: "pending", paymentMethod: "boleto", b2bOfferId: "x", fulfillmentStatus: "cancelled" }), false);
  // Pix e cartão B2B: só depois de pagos (como antes); B2C (sem oferta) idem
  assert.equal(canFulfillOrder({ status: "pending", paymentMethod: "pix", b2bOfferId: "x", fulfillmentStatus: "paid_to_prepare" }), false);
  assert.equal(canFulfillOrder({ status: "pending", paymentMethod: "card", b2bOfferId: "x", fulfillmentStatus: "paid_to_prepare" }), false);
  assert.equal(canFulfillOrder({ status: "pending", paymentMethod: "boleto", b2bOfferId: null, fulfillmentStatus: "paid_to_prepare" }), false);
  assert.equal(canFulfillOrder({ status: "paid", paymentMethod: "pix", b2bOfferId: null, fulfillmentStatus: "paid_to_prepare" }), true);
});

test("fiação: solicitação do boleto libera; Central, avanço e admin aceitam o boleto liberado; botão no admin para os parados", () => {
  const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(src("src/app/api/b2b/payments/boleto/route.ts").includes("releaseBoletoForFulfillment(getAppSqlRunner(), order.id, \"sistema\""));
  assert.ok(src("src/lib/central/brand-api.ts").includes('WHERE ${FULFILLABLE_ORDER_SQL("o")}'));
  assert.ok(src("src/lib/central/order-progress.ts").includes("canFulfillOrder({"));
  assert.ok(src("src/app/api/admin/orders/[id]/fulfillment/route.ts").includes("const paymentApproved = canFulfillOrder(order);"));
  assert.ok(src("src/app/api/admin/orders/[id]/events/route.ts").includes("const paid = canFulfillOrder(order);"));
  const page = src("src/app/admin/(protected)/pedidos/[id]/page.tsx");
  assert.ok(page.includes("{boletoWaiting && <ReleaseBoletoButton orderId={order.id} />}"));
  assert.ok(src("src/app/api/admin/orders/[id]/release-boleto/route.ts").includes("isAdminRequest(request)"));
  assert.ok(src("src/app/api/admin/orders/[id]/shipment/route.ts").includes("!canFulfillOrder(order)"), "expedição aceita o boleto liberado");
});

test("pedido parado antigo (fulfillment vazio) também é liberado pelo botão; Pix/B2C não", async () => {
  const { releaseBoletoForFulfillment } = await import("../src/lib/b2b/boleto-release.ts");
  const id = await boletoOrder();
  await run(`UPDATE orders SET fulfillment_status = NULL WHERE id = $1`, [id]);
  assert.equal(await releaseBoletoForFulfillment(run, id, "admin", "teste"), true);
  const [order] = await run(`SELECT status, fulfillment_status FROM orders WHERE id = $1`, [id]);
  assert.deepEqual(order, { status: "pending", fulfillment_status: "paid_to_prepare" });
  const pix = await boletoOrder();
  await run(`UPDATE orders SET payment_method = 'pix', fulfillment_status = 'awaiting_payment' WHERE id = $1`, [pix]);
  assert.equal(await releaseBoletoForFulfillment(run, pix, "admin", "teste"), false);
  const b2c = await boletoOrder();
  await run(`UPDATE orders SET b2b_offer_id = NULL, fulfillment_status = 'awaiting_payment' WHERE id = $1`, [b2c]);
  assert.equal(await releaseBoletoForFulfillment(run, b2c, "admin", "teste"), false);
});
