/*
 * Itens 42 e 41 (14/11): link de pagamento B2B com Pix (/b2b/pagar) + botão no admin; lembretes de pedido B2B não pago (2 h e 2 dias),
 * SEMPRE preço cheio, sem cupom, com o botão para o link; boleto e mostruário fora; desligado por padrão.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const payLink = await import("../src/lib/b2b/pay-link.ts");
const lib = await import("../src/lib/b2b/unpaid-reminder.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const NOW = new Date("2026-11-14T15:00:00Z");
const ago = (hours) => new Date(NOW.getTime() - hours * 3600_000).toISOString().replace("Z", "");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function makeDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, total_cents int, created_at timestamp, b2b_offer_id uuid,
      b2b_client_id uuid, payment_method text, archived_at timestamp, origin text);
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid, qty int, unit_price_cents int);
    CREATE TABLE payments (id serial PRIMARY KEY, order_id uuid, status text);
    CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, note text, created_by text,
      created_at timestamp DEFAULT now());
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now() NOT NULL);
    INSERT INTO products VALUES ('${id(900)}', 'sono', 'Floral Sono');
  `);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  let n = 0;
  const add = async ({ hours = 3, method = "pix", status = "pending", offer = true, email = "loja@example.com", paid = false, archived = false } = {}) => {
    n += 1;
    await run(`INSERT INTO customers VALUES ($1, 'Pet Shop Exemplo', $2)`, [id(100 + n), email]);
    await run(
      `INSERT INTO orders (id, customer_id, status, total_cents, created_at, b2b_offer_id, payment_method, archived_at) VALUES ($1,$2,$3,59800,$4,$5,$6,$7)`,
      [id(n), id(100 + n), status, ago(hours), offer ? id(500 + n) : null, method, archived ? ago(1) : null]
    );
    await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, '${id(900)}', 30, 1990)`, [id(n)]);
    if (paid) await run(`INSERT INTO payments (order_id, status) VALUES ($1, 'paid')`, [id(n)]);
    return id(n);
  };
  const sent = [];
  const deps = (over = {}) => ({
    now: NOW,
    send: async (mail) => (sent.push(mail), true),
    payUrlFor: async (c) => `https://www.bioflorais.com.br/b2b/pagar?pedido=${c.orderId}&b2b=TOKEN`,
    ...over,
  });
  return { run, add, sent, deps };
}

test("42: link de pagamento só para pedido de OFERTA pendente em Pix ou cartão; texto do WhatsApp sem desconto", () => {
  assert.equal(payLink.b2bPayLinkEligible({ status: "pending", paymentMethod: "pix", b2bOfferId: "x" }), true);
  assert.equal(payLink.b2bPayLinkEligible({ status: "pending", paymentMethod: "card", b2bOfferId: "x" }), true);
  assert.equal(payLink.b2bPayLinkEligible({ status: "pending", paymentMethod: "boleto", b2bOfferId: "x" }), false, "boleto tem aviso próprio");
  assert.equal(payLink.b2bPayLinkEligible({ status: "paid", paymentMethod: "pix", b2bOfferId: "x" }), false);
  assert.equal(payLink.b2bPayLinkEligible({ status: "pending", paymentMethod: "pix", b2bOfferId: null }), false, "mostruário paga na área do vendedor");

  const url = payLink.b2bPayLinkUrl("https://www.bioflorais.com.br/", "abc", "tok en");
  assert.equal(url, "https://www.bioflorais.com.br/b2b/pagar?pedido=abc&b2b=tok%20en");
  const msg = payLink.b2bPayLinkMessage({ clientName: "Pet Shop Exemplo", responsibleName: "Ana", orderNumber: "28080133", totalCents: 59800, paymentMethod: "pix", url });
  assert.ok(msg.includes("Pet Shop Exemplo") && msg.includes("#28080133") && msg.includes("R$") && msg.includes(url) && msg.includes("Pix"));
  assert.ok(!/desconto|cupom/i.test(msg));
});

test("42: /b2b/pagar aceita Pix (mesma rota do checkout B2B, Pix novo se venceu, conferência a cada 5 s); admin com o botão", () => {
  const page = read("src/app/b2b/pagar/PayLinkContent.tsx");
  assert.ok(page.includes('info.status === "pending" && info.paymentMethod === "pix"') && page.includes("<B2BPixPayment"));
  const pix = read("src/components/payments/B2BPixPayment.tsx");
  assert.ok(pix.includes('"/api/b2b/payments/mercadopago/pix"') && pix.includes("body: JSON.stringify({ orderId, b2bToken })"));
  assert.ok(pix.includes("/api/orders/${orderId}/status") && pix.includes("5000") && pix.includes("Gerar um novo"));
  const admin = read("src/app/admin/(protected)/pedidos/[id]/page.tsx");
  assert.ok(admin.includes("b2bPayLinkEligible(") && admin.includes("<PayLinkButton"));
  assert.ok(read("src/components/admin/PayLinkButton.tsx").includes("Gerar / copiar link de pagamento"));
});

test("41: desligado por padrão; ligado, 1º lembrete em 2 h e 2º em 2 dias, uma vez cada, preço cheio e botão para o link", async () => {
  const { run, add, sent, deps } = await makeDb();
  await add({ hours: 3 });
  assert.equal(await lib.loadB2BReminderEnabled(run), false);
  assert.deepEqual(await lib.runB2BUnpaidReminders(run, deps()), { enabled: false, first: 0, second: 0, failed: 0, skipped: 0 });

  await lib.saveB2BReminderEnabled(run, true);
  let r = await lib.runB2BUnpaidReminders(run, deps());
  assert.deepEqual([r.first, r.second], [1, 0]);
  const mail = sent[0];
  assert.equal(mail.to, "loja@example.com");
  assert.ok(mail.subject.includes("aguardando pagamento"));
  assert.ok(mail.text.includes("Olá, Pet Shop Exemplo.") && mail.text.includes("30× Floral Sono") && mail.text.includes("R$ 598,00"));
  assert.ok(mail.text.includes("Pagar o pedido: https://www.bioflorais.com.br/b2b/pagar?pedido="));
  assert.ok(!/desconto|cupom|VOLTA-|%/i.test(mail.text + mail.subject), "preço cheio, sem cupom");

  r = await lib.runB2BUnpaidReminders(run, deps());
  assert.equal(r.first, 0, "uma vez");

  // 2 dias depois: o 2º
  r = await lib.runB2BUnpaidReminders(run, deps({ now: new Date(NOW.getTime() + 47 * 3600_000) }));
  assert.deepEqual([r.first, r.second], [0, 1]);
  assert.ok(sent.at(-1).subject.startsWith("Lembrete:") && !/desconto|cupom/i.test(sent.at(-1).text));
});

test("41: nunca boleto, mostruário (sem oferta), pago, cancelado, arquivado, cedo demais ou sem link", async () => {
  const { run, add, sent, deps } = await makeDb();
  await lib.saveB2BReminderEnabled(run, true);
  await add({ method: "boleto" });
  await add({ offer: false });
  await add({ paid: true });
  await add({ status: "cancelled" });
  await add({ archived: true });
  await add({ hours: 1 });
  let r = await lib.runB2BUnpaidReminders(run, deps());
  assert.equal(r.first + r.second, 0);
  assert.equal(sent.length, 0);

  await add({ hours: 3 });
  r = await lib.runB2BUnpaidReminders(run, deps({ payUrlFor: async () => null }));
  assert.deepEqual([r.first, r.skipped], [0, 1], "sem link de pagamento, não manda");

  const cron = read("src/app/api/cron/remind-unpaid-orders/route.ts");
  assert.ok(cron.includes("runB2BUnpaidReminders(run,") && cron.includes("b2bPayLinkUrl(getSiteUrl()"));
  assert.ok(read("src/app/admin/(protected)/recuperacao/page.tsx").includes("<B2BReminderForm"));
  // o B2C continua sem B2B
  assert.ok(read("src/lib/recovery-offer.ts").includes("o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL"));
  assert.ok(read("src/lib/payment-reminder.ts").includes("o.b2b_offer_id IS NULL AND o.b2b_client_id IS NULL"));
});
