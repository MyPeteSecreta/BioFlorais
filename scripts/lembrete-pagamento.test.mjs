/*
 * Lembrete de pedido B2C não pago: seleção (pending/checkout_pending, > 1 h e < 48 h, com e-mail, sem lembrete, nunca pago/cancelado/B2B/
 * orçamento), reserva do envio (um só e-mail), devolução à fila se o envio falhar, texto sem propaganda e o SQL 55a/55b.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "segredo-de-teste";

const lib = await import("../src/lib/payment-reminder.ts");
const { verifyTrackingToken } = await import("../src/lib/order-tracking.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const NOW = new Date("2026-10-31T15:00:00Z");
const ago = (hours) => new Date(NOW.getTime() - hours * 3600_000).toISOString();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function makeDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE products (id uuid PRIMARY KEY, name text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, total_cents int, created_at timestamp, b2b_offer_id uuid, b2b_client_id uuid, archived_at timestamp);
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid, qty int, unit_price_cents int);
    CREATE TABLE payments (id serial PRIMARY KEY, order_id uuid, method text, status text, created_at timestamp DEFAULT now());
    INSERT INTO products VALUES ('${id(900)}', 'Floral Stress'), ('${id(901)}', 'Floral Sono');
  `);
  await pg.exec(read("sql/b2b/55b_lembrete_pagamento.sql"));

  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  let n = 0;
  const add = async ({ status = "pending", hours = 2, email = "maria@example.com", offer = null, client = null, reminded = false, archived = false, payment = null, name = "Maria Silva" } = {}) => {
    n += 1;
    const orderId = id(n);
    await pg.query(`INSERT INTO customers VALUES ($1, $2, $3)`, [id(100 + n), name, email]);
    await pg.query(
      `INSERT INTO orders (id, customer_id, status, total_cents, created_at, b2b_offer_id, b2b_client_id, payment_reminder_sent_at, archived_at) VALUES ($1,$2,$3,7180,$4,$5,$6,$7,$8)`,
      [orderId, id(100 + n), status, ago(hours), offer, client, reminded ? ago(1) : null, archived ? ago(1) : null]
    );
    await pg.query(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, '${id(900)}', 2, 3590), ($1, '${id(901)}', 1, 0)`, [orderId]);
    if (payment) await pg.query(`INSERT INTO payments (order_id, method, status) VALUES ($1, $2, $3)`, [orderId, payment[0], payment[1]]);
    return orderId;
  };

  return { pg, run, add };
}

test("seleção: só B2C pendente na janela de 1 h a 48 h, com e-mail, sem lembrete e sem pagamento aprovado", async () => {
  const { run, add } = await makeDb();
  const ok1 = await add({ status: "pending", hours: 2.5 });
  const ok2 = await add({ status: "checkout_pending", hours: 47 });
  await add({ hours: 0.5 }); // recente demais
  await add({ hours: 1.5 }); // ainda antes das 2 h (Luis, 12/11)
  await add({ hours: 49 }); // antigo demais
  await add({ status: "paid", hours: 3 });
  await add({ status: "cancelled", hours: 3 });
  await add({ status: "quote", hours: 3 });
  await add({ status: "quote_converted", hours: 3 });
  await add({ offer: id(500), hours: 3 }); // B2B (oferta)
  await add({ client: id(501), hours: 3 }); // B2B (cliente)
  await add({ email: "", hours: 3 });
  await add({ email: "sem-arroba", hours: 3 });
  await add({ reminded: true, hours: 3 });
  await add({ archived: true, hours: 3 });
  await add({ hours: 3, payment: ["pix", "paid"] });

  const found = await lib.findReminderCandidates(run, NOW);

  assert.deepEqual(found.map((c) => c.orderId).sort(), [ok1, ok2].sort());
  const first = found.find((c) => c.orderId === ok1);
  assert.deepEqual(first.items, [{ name: "Floral Stress", qty: 2 }], "o item bonificado (R$ 0) não entra no resumo");
  assert.equal(first.totalCents, 7180);
});

test("reserva: só um envio por pedido, mesmo com dois crons ao mesmo tempo; pedido pago no meio não é reservado; falha devolve à fila", async () => {
  const { run, add } = await makeDb();
  const orderId = await add({ hours: 3 });

  const [a, b] = await Promise.all([lib.claimReminder(run, orderId), lib.claimReminder(run, orderId)]);
  assert.deepEqual([a, b].sort(), [false, true]);
  assert.equal((await lib.findReminderCandidates(run, NOW)).length, 0, "reservado sai da fila");

  await lib.releaseReminder(run, orderId);
  assert.equal((await lib.findReminderCandidates(run, NOW)).length, 1, "falha no envio: volta para a fila");

  const paidLater = await add({ hours: 3 });
  await run(`UPDATE orders SET status = 'paid' WHERE id = $1`, [paidLater]);
  assert.equal(await lib.claimReminder(run, paidLater), false);

  const paidPayment = await add({ hours: 3 });
  await run(`INSERT INTO payments (order_id, method, status) VALUES ($1, 'pix', 'paid')`, [paidPayment]);
  assert.equal(await lib.claimReminder(run, paidPayment), false);
});

test("rodada: envia 1 e-mail por pedido, com link assinado para retomar; falha não perde o pedido; sem segredo de assinatura não envia", async () => {
  const { run, add } = await makeDb();
  const orderId = await add({ hours: 3, name: "Maria da Silva" });
  const sent = [];
  const summary = await lib.runPaymentReminders(run, { send: async (mail) => (sent.push(mail), true), siteUrl: "https://www.bioflorais.com.br/", now: NOW });

  assert.deepEqual(summary, { candidates: 1, sent: 1, skipped: 0, failed: 0 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "maria@example.com");
  assert.equal(sent[0].subject, `Seu pedido #${orderId.slice(0, 8).toUpperCase()} está separado`);

  const link = sent[0].text.match(/https:\/\/www\.bioflorais\.com\.br\/pagar\/(\S+)/);
  assert.ok(link, "link para retomar o pagamento");
  assert.equal(verifyTrackingToken(link[1]), orderId, "o link carrega só o id assinado do pedido");
  assert.ok(sent[0].text.includes("2× Floral Stress") && sent[0].text.includes("R$ 71,80") && sent[0].html.includes("<a href="));

  const again = await lib.runPaymentReminders(run, { send: async () => true, siteUrl: "https://x", now: NOW });
  assert.equal(again.candidates, 0, "já avisado: não repete");

  const failing = await add({ hours: 3 });
  const failed = await lib.runPaymentReminders(run, { send: async () => false, siteUrl: "https://x", now: NOW });
  assert.deepEqual([failed.sent, failed.failed], [0, 1]);
  assert.equal((await lib.findReminderCandidates(run, NOW)).map((c) => c.orderId)[0], failing, "a falha devolveu o pedido à fila");

  const secret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  const noSecret = await lib.runPaymentReminders(run, { send: async () => true, siteUrl: "https://x", now: NOW });
  process.env.ADMIN_SESSION_SECRET = secret;
  assert.deepEqual([noSecret.sent, noSecret.skipped], [0, 1]);
});

test("texto: transacional, sem propaganda; cartão recusado sugere Pix; Pix vencido manda gerar outro", () => {
  const base = { orderId: id(1), status: "pending", email: "a@b.com", name: "Ana Paula", totalCents: 3590, lastMethod: "pix", lastPaymentStatus: "pending", items: [{ name: "Floral Sono", qty: 1 }] };
  const pix = lib.buildReminderEmail(base, "https://x/pagar/t");
  assert.ok(pix.text.startsWith("Olá, Ana.") && pix.text.includes("Se o Pix venceu"));
  assert.ok(!/desconto|cupom|promo|oferta|compre|ganhe|frete gr/i.test(pix.text + pix.html), "nada de propaganda");

  const card = lib.buildReminderEmail({ ...base, status: "checkout_pending", lastMethod: "card", lastPaymentStatus: "rejected" }, "https://x/pagar/t");
  assert.ok(card.text.includes("cartão não foi concluído") && card.text.includes("o Pix costuma ser aprovado"));
  assert.equal(lib.cardWasDeclined({ lastMethod: "pix", lastPaymentStatus: "rejected", status: "pending" }), false);
  assert.ok(lib.buildReminderEmail({ ...base, name: "<b>X</b>" }, "https://x/?a=1&b=2").html.includes("&amp;b=2"), "html escapado");
});

test("infra: cron a cada 15 min com CRON_SECRET, sem e-mail/coluna não faz nada, página de retomada, SQL 55a só lê e 55b só soma", () => {
  const cfg = JSON.parse(read("vercel.json"));
  assert.ok(cfg.crons.some((c) => c.path === "/api/cron/remind-unpaid-orders" && c.schedule === "*/15 * * * *"));
  assert.ok(cfg.crons.some((c) => c.path === "/api/cron/reconcile-mp-pix"), "o cron do Pix continua");

  const route = read("src/app/api/cron/remind-unpaid-orders/route.ts");
  assert.ok(route.includes("CRON_SECRET") && route.includes("status: 401") && route.includes("mailConfigured()") && route.includes("payment_reminder_sent_at") && route.includes("status: 503"));

  const page = read("src/app/pagar/[token]/page.tsx");
  assert.ok(page.includes("verifyTrackingToken") && page.includes("view.isB2B") && page.includes("redirect(`/acompanhe/${token}`)") && page.includes("timeline.cancelled"));
  assert.ok(read("src/components/payments/ResumePayment.tsx").includes("/api/payments/mercadopago/pix") && read("src/components/payments/ResumePayment.tsx").includes("sugestao-pix"));

  const a = read("sql/b2b/55a_lembrete_pagamento_conferencia_one_shot.sql").replace(/--.*$/gm, "");
  const b = read("sql/b2b/55b_lembrete_pagamento.sql").replace(/--.*$/gm, "");
  assert.ok(!/\b(UPDATE|DELETE|INSERT|DROP|ALTER|TRUNCATE)\b/i.test(a), "55a só lê");
  assert.ok(/ADD COLUMN payment_reminder_sent_at timestamp/.test(b) && !/\b(DELETE|DROP|TRUNCATE|UPDATE|INSERT)\b/i.test(b), "55b só soma");
  assert.ok(!read("src/lib/db/schema.ts").includes("payment_reminder_sent_at"), "fora do drizzle: sem a coluna nenhum SELECT de pedidos quebra");
});

test("55a: conferência antes e depois do 55b, em PGlite", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, total_cents int, created_at timestamp, b2b_offer_id uuid, b2b_client_id uuid);
    CREATE TABLE payments (id serial PRIMARY KEY, order_id uuid, method text, status text);
    INSERT INTO customers VALUES ('${id(1)}', 'A', 'a@b.com');
    INSERT INTO orders VALUES ('${id(10)}', '${id(1)}', 'pending', 100, now() - interval '3 hours', NULL, NULL), ('${id(11)}', '${id(1)}', 'paid', 100, now() - interval '3 hours', NULL, NULL);`);
  const conf = read("sql/b2b/55a_lembrete_pagamento_conferencia_one_shot.sql");
  const before = (await pg.query(conf)).rows[0].conferencia_lembrete_pagamento;
  assert.equal(before.coluna_payment_reminder_sent_at_existe, false);
  assert.equal(before.pedidos_pendentes_b2c_na_janela_1h_a_48h, 1);
  await pg.exec(read("sql/b2b/55b_lembrete_pagamento.sql"));
  await pg.exec(read("sql/b2b/55b_lembrete_pagamento.sql"));
  assert.equal((await pg.query(conf)).rows[0].conferencia_lembrete_pagamento.coluna_payment_reminder_sent_at_existe, true);
});
