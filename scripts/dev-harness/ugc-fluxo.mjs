/*
 * HARNESS (só desenvolvimento, dados de teste): fluxo do cupom de criadora até a Academia, item 20 (18/11).
 * Roda contra o proxy local (neon-proxy.mjs) e uma "Academia" falsa nesta máquina, que só registra os eventos recebidos.
 *   node --require ./scripts/dev-harness/patch.cjs --import ./scripts/register-ts-paths.mjs scripts/dev-harness/ugc-fluxo.mjs
 * com DATABASE_URL=postgres://u:p@ep-teste.local.neon.tech/db e ACADEMIA_PARTNER_API_URL=http://127.0.0.1:5998.
 */
import http from "node:http";
import assert from "node:assert/strict";

const received = [];
let failNext = 0;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const event = body ? JSON.parse(body) : {};
    if (failNext > 0) {
      failNext -= 1;
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "unavailable", message: "fora do ar", retryable: true } }));
      return;
    }
    received.push(`${event.eventType}:${String(event.externalOrderId).slice(0, 8)}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ accepted: true, eventId: event.eventId, eventType: event.eventType }));
  });
});
await new Promise((resolve) => server.listen(5998, "127.0.0.1", resolve));

process.env.ACADEMIA_PARTNER_CLIENT_ID = "cliente-teste";
process.env.ACADEMIA_PARTNER_CLIENT_SECRET = "segredo-teste";

const { getAppSqlRunner } = await import("../../src/lib/b2b/ownership.ts");
const { confirmPartnerPaid, enqueuePartnerCancelled, PARTNER_EVENT_PARKED_UNTIL } = await import("../../src/lib/partners/confirm-paid.ts");
const { dispatchPartnerOutbox } = await import("../../src/lib/partners/outbox.ts");

const run = getAppSqlRunner();
const [customer] = await run(`INSERT INTO customers (person_type, name, email, phone) VALUES ('pf', 'Cliente Teste', 'cliente@teste.local', '11999990000') RETURNING id`);
const [address] = await run(`INSERT INTO addresses (customer_id, cep, street, number, district, city, state) VALUES ($1, '01310100', 'Rua Teste', '1', 'Centro', 'São Paulo', 'SP') RETURNING id`, [customer.id]);

async function order(partner) {
  const [row] = await run(
    `INSERT INTO orders (customer_id, shipping_address_id, status, subtotal_cents, total_cents, partner_coupon_id, partner_id, partner_commission_percent, partner_commission_cents, partner_commission_status)
     VALUES ($1, $2, 'checkout_pending', 10000, 9500, $3, $4, $5, $6, $7) RETURNING id`,
    [customer.id, address.id, partner ? "cupom-teste-1" : null, partner ? "criadora-teste" : null, partner ? "10" : null, partner ? 950 : 0, partner ? "pending_payment" : null]
  );
  return String(row.id);
}

async function parkOrderCreated(orderId) {
  const eventId = `bio-florais:${orderId}:order_created`;
  await run(
    `INSERT INTO partner_event_outbox (event_id, event_type, brand, external_order_id, partner_coupon_id, payload, status, next_attempt_at)
     VALUES ($1, 'order_created', 'bio-florais', $2, 'cupom-teste-1', $3::jsonb, 'pending', $4::timestamp)`,
    [eventId, orderId, JSON.stringify({ schemaVersion: 1, eventId, eventType: "order_created", brand: "bio-florais", externalOrderId: orderId }), PARTNER_EVENT_PARKED_UNTIL.toISOString().replace("Z", "")]
  );
}

// 1) cartão: o order_created fica estacionado e não sai antes do pagamento
const card = await order(true);
await parkOrderCreated(card);
await dispatchPartnerOutbox(10);
assert.deepEqual(received, [], "estacionado não sai");

// 2) pagamento aprovado: sai order_created e depois paid, na ordem
await confirmPartnerPaid(card, { provider: "mercadopago", providerPaymentId: "pg-teste-1", paidAt: new Date().toISOString() });
assert.deepEqual(received, [`order_created:${card.slice(0, 8)}`, `paid:${card.slice(0, 8)}`]);

// 3) cancelamento no admin: sai "cancelled" uma vez; pedido sem cupom de criadora não gera nada
await enqueuePartnerCancelled(card);
await enqueuePartnerCancelled(card);
const plain = await order(false);
assert.deepEqual(await enqueuePartnerCancelled(plain), { partner: false });
assert.deepEqual(received.slice(2), [`cancelled:${card.slice(0, 8)}`]);

// 4) Academia fora do ar: o evento fica na fila para nova tentativa (o cron de 15 min reenvia)
const pix = await order(true);
failNext = 1;
await confirmPartnerPaid(pix, { provider: "mercadopago", providerPaymentId: "pg-teste-2", paidAt: new Date().toISOString() });
const [queued] = await run(`SELECT status, attempt_count FROM partner_event_outbox WHERE event_id = $1`, [`bio-florais:${pix}:paid`]);
assert.equal(queued.status, "retry_scheduled");
await run(`UPDATE partner_event_outbox SET next_attempt_at = now() - interval '1 minute' WHERE event_id = $1`, [`bio-florais:${pix}:paid`]);
await dispatchPartnerOutbox(20);
assert.equal(received.at(-1), `paid:${pix.slice(0, 8)}`);

console.log("FLUXO OK:", received.join(" → "));
server.close();
process.exit(0);
