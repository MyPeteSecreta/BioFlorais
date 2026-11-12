/*
 * E-mails de andamento do pedido (src/lib/order-emails.ts): etapa atual, uma vez por etapa (order_events), nunca volta etapa,
 * sem configuração só registra, falha no envio não quebra, textos (B2C, B2B boleto com parcelas, rastreio) e a fiação nas rotas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "segredo-de-teste";

const lib = await import("../src/lib/order-emails.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SITE = "https://www.bioflorais.com.br";

async function makeDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE addresses (id uuid PRIMARY KEY, city text, state text, cep text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, fulfillment_status text, payment_method text,
      subtotal_cents int, discount_cents int, shipping_cents int, total_cents int, shipping_service_name text, tracking_code text,
      b2b_offer_id uuid, shipping_address_id uuid, created_at timestamp DEFAULT now(), archived_at timestamp);
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid, qty int, unit_price_cents int, product_name_snapshot text);
    CREATE TABLE payments (id serial PRIMARY KEY, order_id uuid, method text, status text, raw_payload jsonb, created_at timestamp DEFAULT now());
    CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, carrier text, tracking_code text,
      tracking_url text, note text, created_by text, created_at timestamp DEFAULT now());
    INSERT INTO products VALUES ('${id(900)}', 'floral-stress', 'Floral Stress', null, null);
  `);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  let n = 0;
  const add = async ({ status = "pending", fulfillment = "awaiting_payment", email = "maria@example.com", method = "pix", archived = false } = {}) => {
    n += 1;
    const orderId = id(n);
    await run(`INSERT INTO customers VALUES ($1, 'Maria Silva', $2)`, [id(100 + n), email]);
    await run(
      `INSERT INTO orders (id, customer_id, status, fulfillment_status, payment_method, subtotal_cents, discount_cents, shipping_cents, total_cents, archived_at)
       VALUES ($1, $2, $3, $4, $5, 7180, 718, 1990, 8452, $6)`,
      [orderId, id(100 + n), status, fulfillment, method, archived ? new Date().toISOString() : null]
    );
    await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, product_name_snapshot) VALUES ($1, '${id(900)}', 2, 3590, 'Floral Stress 30 ml')`, [orderId]);
    return orderId;
  };
  const sent = [];
  const deps = (over = {}) => ({ configured: true, siteUrl: SITE, send: async (mail) => (sent.push(mail), true), ...over });
  const events = async (orderId) => (await run(`SELECT event, note FROM order_events WHERE order_id = $1 ORDER BY created_at, event`, [orderId]));
  return { run, add, sent, deps, events };
}

test("etapa atual: recebido, pago, separação, enviado, entregue, cancelado; orçamento nada; boleto B2B espera as parcelas", () => {
  const base = { paymentMethod: "pix", isB2B: false, boleto: [] };
  const stage = (status, fulfillmentStatus, extra = {}) => lib.currentEmailStage({ ...base, status, fulfillmentStatus, ...extra });

  assert.equal(stage("pending", "awaiting_payment"), "received");
  assert.equal(stage("paid", "paid_to_prepare"), "paid");
  assert.equal(stage("paid", "separating"), "separating");
  assert.equal(stage("paid", "ready_to_ship"), "separating");
  assert.equal(stage("paid", "shipped"), "shipped");
  assert.equal(stage("paid", "delivered"), "delivered");
  assert.equal(stage("paid", "cancelled"), "cancelled");
  assert.equal(stage("cancelled", "awaiting_payment"), "cancelled");
  assert.equal(stage("quote", ""), null);
  assert.equal(stage("pending", "awaiting_payment", { isB2B: true, paymentMethod: "boleto" }), null, "boleto sem parcelas ainda");
  assert.equal(stage("pending", "paid_to_prepare", { isB2B: true, paymentMethod: "boleto", boleto: [{}] }), "received", "boleto liberado: recebido com parcelas");
  assert.equal(stage("pending", "shipped", { isB2B: true, paymentMethod: "boleto", boleto: [{}] }), "shipped", "boleto enviado antes de pagar");
});

test("uma vez por etapa, nunca volta etapa; cancelado vale uma vez", () => {
  assert.equal(lib.shouldSendStage("paid", []), true);
  assert.equal(lib.shouldSendStage("paid", ["paid"]), false);
  assert.equal(lib.shouldSendStage("paid", ["received", "shipped"]), false, "já avisou o envio: não manda 'pago' depois");
  assert.equal(lib.shouldSendStage("delivered", ["received", "shipped"]), true);
  assert.equal(lib.shouldSendStage("cancelled", ["received", "shipped"]), true);
  assert.equal(lib.shouldSendStage("cancelled", ["cancelled"]), false);
  assert.equal(lib.shouldSendStage("separating", ["cancelled"]), false);
});

test("fluxo B2C: recebido (com link de pagamento) → pago → separação → enviado (rastreio) → entregue, um e-mail por etapa", async () => {
  const { run, add, sent, deps, events } = await makeDb();
  const orderId = await add();

  assert.deepEqual(await lib.notifyOrderProgress(run, orderId, deps()), { sent: true, stage: "received" });
  assert.equal((await lib.notifyOrderProgress(run, orderId, deps())).reason, "already_sent", "repetir não duplica");
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /^Recebemos seu pedido #00000000$/);
  assert.equal(sent[0].to, "maria@example.com");
  assert.ok(sent[0].text.includes("2× Floral Stress 30 ml"));
  assert.ok(sent[0].text.includes("Total: R$ 84,52"));
  assert.ok(sent[0].text.includes(`Concluir o pagamento: ${SITE}/pagar/`));
  assert.ok(sent[0].text.includes(`Acompanhar pedido: ${SITE}/acompanhe/${orderId}.`));
  assert.ok(sent[0].html.includes("Acompanhar pedido") && sent[0].html.includes("#26352c"));

  await run(`UPDATE orders SET status = 'paid', fulfillment_status = 'paid_to_prepare' WHERE id = $1`, [orderId]);
  assert.equal((await lib.notifyOrderProgress(run, orderId, deps())).stage, "paid");
  assert.ok(!sent[1].text.includes("/pagar/"), "pago: sem link de pagamento");

  await run(`UPDATE orders SET fulfillment_status = 'separating' WHERE id = $1`, [orderId]);
  await lib.notifyOrderProgress(run, orderId, deps());

  await run(`UPDATE orders SET fulfillment_status = 'shipped', shipping_service_name = 'Correios', tracking_code = 'AA123BR' WHERE id = $1`, [orderId]);
  await run(`INSERT INTO order_events (order_id, event, carrier, tracking_code, tracking_url, created_by) VALUES ($1, 'shipped', 'Correios', 'AA123456789BR', 'https://rastreio.example/AA123456789BR', 'admin')`, [orderId]);
  await lib.notifyOrderProgress(run, orderId, deps());
  assert.match(sent[3].subject, /foi enviado$/);
  assert.ok(sent[3].text.includes("Código de rastreio: AA123456789BR"));
  assert.ok(sent[3].text.includes("Rastrear entrega: https://rastreio.example/AA123456789BR"));

  await run(`UPDATE orders SET fulfillment_status = 'delivered' WHERE id = $1`, [orderId]);
  await lib.notifyOrderProgress(run, orderId, deps());

  assert.deepEqual(sent.map((mail) => mail.subject.split(" ")[0]), ["Recebemos", "Pagamento", "Seu", "Seu", "Seu"]);
  const log = (await events(orderId)).filter((row) => row.event.startsWith("email_"));
  assert.deepEqual(log.map((row) => row.event).sort(), ["email_delivered", "email_paid", "email_received", "email_separating", "email_shipped"]);
  assert.ok(log.every((row) => row.note === "enviado"));
});

test("pulou etapa: vai só a atual; sem configuração só registra; falha no envio não lança; sem e-mail, arquivado ou orçamento: nada", async () => {
  const { run, add, sent, deps, events } = await makeDb();

  const jumped = await add({ status: "paid", fulfillment: "shipped" });
  assert.equal((await lib.notifyOrderProgress(run, jumped, deps())).stage, "shipped");
  await run(`UPDATE orders SET fulfillment_status = 'paid_to_prepare' WHERE id = $1`, [jumped]);
  assert.equal((await lib.notifyOrderProgress(run, jumped, deps())).reason, "already_sent", "não manda 'pago' depois do 'enviado'");

  const off = await add();
  assert.deepEqual(await lib.notifyOrderProgress(run, off, deps({ configured: false })), { sent: false, stage: "received", reason: "not_configured" });
  assert.match((await events(off))[0].note, /^não enviado: e-mail não configurado/);

  const failing = await add();
  const result = await lib.notifyOrderProgress(run, failing, deps({ send: async () => { throw new Error("rede"); } }));
  assert.deepEqual(result, { sent: false, stage: "received", reason: "send_failed" });
  assert.equal((await events(failing))[0].note, "não enviado: falha no envio");

  assert.equal((await lib.notifyOrderProgress(run, await add({ email: "sem-arroba" }), deps())).reason, "no_email");
  assert.equal((await lib.notifyOrderProgress(run, await add({ archived: true }), deps())).reason, "no_order");
  assert.equal((await lib.notifyOrderProgress(run, await add({ status: "quote", fulfillment: "" }), deps())).reason, "no_stage");
  assert.equal(sent.length, 1);
});

test("textos: B2B boleto com parcelas e vencimentos; cancelado; nenhum valor com mais de 2 casas; sem CPF/CNPJ ou endereço", () => {
  const view = {
    orderId: id(1), number: "ABCD1234", createdAt: new Date(), status: "pending", fulfillmentStatus: "paid_to_prepare", paymentMethod: "boleto",
    isB2B: true, items: [{ name: "Floral Stress 30 ml", qty: 12, unitPriceCents: 2990, bonified: false }, { name: "Display", qty: 1, unitPriceCents: 0, bonified: true }],
    subtotalCents: 35880, discountCents: 0, shippingCents: 0, totalCents: 35880, carrier: null, trackingCode: null, trackingUrl: null,
    addressPartial: "Campinas/SP · CEP 13000-***", timeline: { cancelled: false, steps: [] }, events: [], pixCode: null,
    boleto: [
      { installment: 1, installments: 3, dueDate: "2026-12-09", amountCents: 11960 },
      { installment: 2, installments: 3, dueDate: "2026-12-23", amountCents: 11960 },
      { installment: 3, installments: 3, dueDate: "2027-01-06", amountCents: 11960 },
    ],
  };
  const ctx = { name: "Gral Animal", trackUrl: `${SITE}/acompanhe/x`, payUrl: null, supportUrl: `${SITE}/atendimento` };

  const received = lib.buildOrderEmail("received", view, ctx);
  assert.equal(received.subject, "Recebemos seu pedido #ABCD1234 (boleto a prazo)");
  assert.ok(received.text.startsWith("Olá, Gral Animal."), "B2B: nome da loja inteiro");
  assert.ok(received.text.includes("Pagamento no boleto a prazo, em 3 parcela(s):"));
  assert.ok(received.text.includes("1ª parcela: R$ 119,60 · vence em 09/12/2026"));
  assert.ok(received.text.includes("3ª parcela: R$ 119,60 · vence em 06/01/2027"));
  assert.ok(received.text.includes("1× Display (bonificado)"));
  assert.ok(received.text.includes("Frete: grátis"));
  assert.ok(!received.text.includes("Campinas") && !received.text.includes("CEP"), "sem endereço");

  const cancelled = lib.buildOrderEmail("cancelled", view, ctx);
  assert.equal(cancelled.subject, "Pedido #ABCD1234 cancelado");
  assert.ok(cancelled.text.includes(`${SITE}/atendimento`));

  for (const stage of lib.ORDER_EMAIL_STAGES) {
    const mail = lib.buildOrderEmail(stage, view, ctx);
    assert.ok(!/\d,\d{3}\b/.test(mail.text.replace(/\d{1,3}(\.\d{3})+,/g, "")), `${stage}: no máximo 2 casas`);
    assert.ok(mail.html.startsWith("<!doctype html>") && mail.html.includes("Bio Florais"));
  }
  assert.equal(lib.brl(123456.7), "R$ 1.234,57");
});

test("fiação: recebido na criação (B2C/B2B) e no boleto; pago no Mercado Pago, Lunium, PixGo e na baixa; etapas no admin e na Central", () => {
  const has = (rel, text) => assert.ok(read(rel).includes(text), `${rel}: ${text}`);
  has("src/app/api/orders/create/route.ts", "scheduleOrderEmail(order.id);");
  has("src/app/api/b2b/orders/create/route.ts", "scheduleOrderEmail(order.id);");
  has("src/app/api/b2b/payments/boleto/route.ts", "scheduleOrderEmail(order.id);");
  has("src/lib/payments/finalize-mercadopago-paid.ts", "scheduleOrderEmail(input.orderId);");
  has("src/app/api/webhooks/lunium/route.ts", "scheduleOrderEmail(orderId);");
  has("src/app/api/webhooks/pixgo/route.ts", 'if (event === "payment.completed") scheduleOrderEmail(localOrderId);');
  has("src/app/api/admin/orders/[id]/fulfillment/route.ts", "scheduleOrderEmail(id);");
  has("src/app/api/admin/orders/[id]/events/route.ts", "scheduleOrderEmail(id);");
  has("src/app/api/admin/orders/[id]/shipment/route.ts", "if (markAsShipped) scheduleOrderEmail(id);");
  has("src/app/api/central/orders/[id]/progress/route.ts", "if (result.ok) scheduleOrderEmail(id);");
  has("src/app/api/admin/b2b/boletos/route.ts", "if (result.ok && result.orderPaid) scheduleOrderEmail(orderId);");
  const server = read("src/lib/order-emails-server.ts");
  assert.ok(server.includes("after(() => notifyOrderProgressSafe(orderId))") && server.includes("catch (error)"), "depois da resposta e sem lançar");
});
