/*
 * Pedido de avaliação (src/lib/review-request.ts): desligado sem link; 7 a 10 dias depois do 'delivered'; só B2C pago e entregue;
 * uma vez por pedido; texto sem incentivo; cron diário e admin.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const lib = await import("../src/lib/review-request.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const NOW = new Date("2026-11-12T15:00:00Z");
const ago = (days) => new Date(NOW.getTime() - days * 86400_000).toISOString().replace("Z", "");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const URL_OK = "https://g.page/r/exemplo/review";

async function makeDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, fulfillment_status text, b2b_offer_id uuid, b2b_client_id uuid, archived_at timestamp);
    CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, note text, created_by text, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now() NOT NULL);
  `);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  let n = 0;
  const add = async ({ status = "paid", fulfillment = "delivered", deliveredDays = 8, email = "maria@example.com", offer = null, archived = false } = {}) => {
    n += 1;
    const orderId = id(n);
    await run(`INSERT INTO customers VALUES ($1, 'Maria Silva', $2)`, [id(100 + n), email]);
    await run(`INSERT INTO orders VALUES ($1, $2, $3, $4, $5, NULL, $6)`, [orderId, id(100 + n), status, fulfillment, offer, archived ? ago(1) : null]);
    if (deliveredDays !== null) await run(`INSERT INTO order_events (order_id, event, created_by, created_at) VALUES ($1, 'delivered', 'admin', $2)`, [orderId, ago(deliveredDays)]);
    return orderId;
  };
  return { run, add };
}

test("desligado por padrão e sem link https não liga", async () => {
  const { run, add } = await makeDb();
  await add();
  assert.deepEqual(await lib.loadReviewSettings(run), { enabled: false, url: "" });
  assert.deepEqual(await lib.saveReviewSettings(run, { enabled: true, url: "http://inseguro" }), { enabled: false, url: "" });
  const sent = [];
  assert.equal((await lib.runReviewRequests(run, { siteUrl: "https://x", now: NOW, send: async (m) => (sent.push(m), true) })).sent, 0);
});

test("7 a 10 dias depois da entrega, só B2C pago e entregue, uma vez por pedido; texto sem incentivo", async () => {
  const { run, add } = await makeDb();
  await lib.saveReviewSettings(run, { enabled: true, url: URL_OK });
  const ok = await add({ deliveredDays: 8 });
  await add({ deliveredDays: 5 }); // cedo
  await add({ deliveredDays: 12 }); // antigo (não manda ao ligar)
  await add({ fulfillment: "shipped" });
  await add({ status: "cancelled" });
  await add({ offer: id(500) }); // B2B
  await add({ archived: true });
  await add({ email: "sem-arroba" });
  await add({ deliveredDays: null }); // entregue sem histórico: sem data, não manda

  const sent = [];
  const deps = { siteUrl: "https://www.bioflorais.com.br", now: NOW, send: async (m) => (sent.push(m), true) };
  assert.deepEqual(await lib.runReviewRequests(run, deps), { enabled: true, candidates: 1, sent: 1, failed: 0 });
  assert.equal((await lib.runReviewRequests(run, deps)).sent, 0, "não repete");

  assert.equal(sent[0].to, "maria@example.com");
  assert.equal(sent[0].subject, "Como foi a sua experiência com a Bio Florais?");
  assert.ok(sent[0].text.includes(`Avaliar a Bio Florais: ${URL_OK}`));
  assert.ok(sent[0].text.includes(`#${ok.slice(0, 8).toUpperCase()} foi entregue há uma semana`));
  assert.ok(!/desconto|cupom|brinde|ganhe/i.test(sent[0].text), "sem incentivo");
  const [event] = await run(`SELECT note FROM order_events WHERE order_id = $1 AND event = 'review_request'`, [ok]);
  assert.equal(event.note, "enviado");
});

test("fiação: cron diário e admin", () => {
  assert.ok(read("vercel.json").includes('"/api/cron/review-requests"'));
  assert.ok(read("src/app/api/cron/review-requests/route.ts").includes("runReviewRequests(getAppSqlRunner()"));
  assert.ok(read("src/app/api/admin/review-request/route.ts").includes("isAdminRequest(request)"));
  assert.ok(read("src/app/admin/(protected)/recuperacao/page.tsx").includes("<ReviewSettingsForm"));
});
