/*
 * Pedido não pago → oferta de desconto em 2 dias (src/lib/recovery-offer.ts): desligada por padrão; janela 48–72 h; nunca pago,
 * cancelado, B2B, arquivado, quem comprou depois ou já recebeu oferta em 30 dias; uma vez por pedido; cupom VOLTA de uso único,
 * 48 h, preso ao e-mail; relatório; texto; e o lembrete passou de 1 h para 2 h.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "segredo-de-teste";

const lib = await import("../src/lib/recovery-offer.ts");
const reminder = await import("../src/lib/payment-reminder.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const NOW = new Date("2026-11-12T15:00:00Z");
const ago = (hours) => new Date(NOW.getTime() - hours * 3600_000).toISOString().replace("Z", "");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SITE = "https://www.bioflorais.com.br";

async function makeDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, status text, total_cents int, created_at timestamp, b2b_offer_id uuid,
      b2b_client_id uuid, archived_at timestamp, coupon_code text);
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid, qty int, unit_price_cents int);
    CREATE TABLE payments (id serial PRIMARY KEY, order_id uuid, method text, status text, created_at timestamp DEFAULT now());
    CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, note text, created_by text,
      created_at timestamp DEFAULT now());
    CREATE TABLE coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, discount_type text NOT NULL,
      discount_value int NOT NULL, coupon_type text NOT NULL DEFAULT 'normal', scope text NOT NULL DEFAULT 'b2c', max_uses int,
      used_count int NOT NULL DEFAULT 0, one_per_customer boolean NOT NULL DEFAULT false, expires_at timestamp, active boolean NOT NULL DEFAULT true);
    CREATE TABLE coupon_redemptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid, customer_email text, order_id uuid,
      discount_cents int, redeemed_at timestamp DEFAULT now());
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now() NOT NULL);
    INSERT INTO products VALUES ('${id(900)}', 'floral-stress', 'Floral Stress'), ('${id(901)}', 'brinde', 'Brinde');
  `);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  let n = 0;
  const add = async ({ status = "pending", hours = 50, email = "maria@example.com", offer = null, archived = false, coupon = null, payment = null } = {}) => {
    n += 1;
    const orderId = id(n);
    await run(`INSERT INTO customers VALUES ($1, 'Maria Silva', $2)`, [id(100 + n), email]);
    await run(
      `INSERT INTO orders (id, customer_id, status, total_cents, created_at, b2b_offer_id, archived_at, coupon_code) VALUES ($1,$2,$3,7180,$4,$5,$6,$7)`,
      [orderId, id(100 + n), status, ago(hours), offer, archived ? ago(1) : null, coupon]
    );
    await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, '${id(900)}', 2, 3590), ($1, '${id(901)}', 1, 0)`, [orderId]);
    if (payment) await run(`INSERT INTO payments (order_id, method, status) VALUES ($1, 'pix', $2)`, [orderId, payment]);
    return orderId;
  };
  const sent = [];
  const deps = (over = {}) => ({ siteUrl: SITE, now: NOW, send: async (mail) => (sent.push(mail), true), ...over });
  return { run, add, sent, deps };
}

test("lembrete sem desconto passou para 2 h (Luis, 12/11)", () => {
  assert.equal(reminder.REMINDER_MIN_AGE_MS, 2 * 60 * 60 * 1000);
});

test("desligada por padrão: nada sai até ligar no admin; % fica entre 5 e 30", async () => {
  const { run, add, sent, deps } = await makeDb();
  await add();
  assert.deepEqual(await lib.loadRecoverySettings(run), { enabled: false, percent: 10 });
  assert.equal((await lib.runRecoveryOffers(run, deps())).sent, 0);
  assert.equal(sent.length, 0);

  assert.deepEqual(await lib.saveRecoverySettings(run, { enabled: true, percent: 80 }), { enabled: true, percent: 30 });
  assert.deepEqual(await lib.saveRecoverySettings(run, { enabled: true, percent: 10 }), { enabled: true, percent: 10 });
});

test("seleção: só B2C não pago entre 2 e 3 dias, com e-mail, sem oferta, sem compra depois e sem oferta ao mesmo e-mail em 30 dias", async () => {
  const { run, add } = await makeDb();
  const ok = await add({ hours: 50 });
  await add({ hours: 47, email: "a@example.com" }); // antes dos 2 dias
  await add({ hours: 80, email: "b@example.com" }); // fora da janela (não manda para pedido antigo ao ligar)
  await add({ status: "paid", email: "c@example.com" });
  await add({ status: "cancelled", email: "d@example.com" });
  await add({ status: "quote", email: "e@example.com" });
  await add({ offer: id(500), email: "f@example.com" });
  await add({ archived: true, email: "g@example.com" });
  await add({ email: "sem-arroba" });
  await add({ coupon: "VOLTA-AAAAAA", email: "h@example.com" });
  await add({ payment: "paid", email: "i@example.com" });
  await add({ hours: 55, email: "j@example.com" });
  await add({ status: "paid", hours: 10, email: "J@example.com" }); // comprou depois (mesmo e-mail, maiúsculas)

  const found = await lib.findRecoveryCandidates(run, NOW);
  assert.deepEqual(found.map((c) => c.orderId), [ok]);
  assert.deepEqual(found[0].items, [{ slug: "floral-stress", name: "Floral Stress", qty: 2 }], "brinde (R$ 0) fora");
});

test("envio: uma vez por pedido; cupom VOLTA de uso único, 48 h, B2C, preso ao e-mail; e-mail com código e link /retomar", async () => {
  const { run, add, sent, deps } = await makeDb();
  await lib.saveRecoverySettings(run, { enabled: true, percent: 10 });
  const orderId = await add();

  assert.deepEqual(await lib.runRecoveryOffers(run, deps()), { enabled: true, candidates: 1, sent: 1, failed: 0 });
  assert.equal((await lib.runRecoveryOffers(run, deps())).sent, 0, "segunda rodada não repete");
  assert.equal(sent.length, 1);

  const [event] = await run(`SELECT note FROM order_events WHERE order_id = $1 AND event = 'recovery_offer'`, [orderId]);
  const code = event.note;
  assert.match(code, /^VOLTA-[A-Z2-9]{6}$/);

  const [coupon] = await run(`SELECT * FROM coupons WHERE code = $1`, [code]);
  assert.equal(coupon.discount_type, "percentage");
  assert.equal(coupon.discount_value, 10);
  assert.equal(coupon.scope, "b2c");
  assert.equal(coupon.max_uses, 1);
  assert.equal(coupon.one_per_customer, true);
  assert.equal(new Date(`${coupon.expires_at.toISOString?.() ?? coupon.expires_at}`).getTime() > 0, true);

  assert.equal(await lib.recoveryCouponOwnerError(run, code, "MARIA@example.com"), null);
  assert.match(await lib.recoveryCouponOwnerError(run, code, "outra@example.com"), /pessoal/);
  assert.equal(await lib.recoveryCouponOwnerError(run, "GPT10", "outra@example.com"), null, "cupom comum não muda");
  assert.match(await lib.recoveryCouponOwnerError(run, "VOLTA-ZZZZZZ", "maria@example.com"), /não é válido/);

  const mail = sent[0];
  assert.equal(mail.to, "maria@example.com");
  assert.equal(mail.subject, `10% de desconto para concluir seu pedido #${orderId.slice(0, 8).toUpperCase()}`);
  assert.ok(mail.text.includes(code));
  assert.ok(mail.text.includes(`Retomar com 10% de desconto: ${SITE}/retomar/${orderId}.`));
  assert.ok(mail.text.includes("Vale até 14/11 às 12:00 (48 horas)"), mail.text);
  assert.ok(mail.html.includes(code) && mail.html.includes("dashed"));

  assert.deepEqual(await lib.loadRecoveryForOrder(run, orderId), { code, percent: 10, valid: true });
  assert.deepEqual(await lib.loadOrderCartItems(run, orderId), [{ productSlug: "floral-stress", name: "Floral Stress", qty: 2 }]);

  // relatório: 1 enviada, 1 usada, 1 paga
  const [{ id: couponId }] = await run(`SELECT id FROM coupons WHERE code = $1`, [code]);
  await run(`INSERT INTO coupon_redemptions (coupon_id, customer_email, order_id, discount_cents) VALUES ($1, 'maria@example.com', $2, 718)`, [couponId, id(77)]);
  await run(`INSERT INTO orders (id, status, total_cents, created_at, coupon_code) VALUES ($1, 'paid', 6462, now(), $2)`, [id(77), code]);
  const report = await lib.loadRecoveryReport(run, new Date());
  assert.deepEqual(report, { sent: 1, sent30: 1, used: 1, used30: 1, paidOrders: 1, paidCents: 6462 });
});

test("falha no envio não lança e fica registrada; oferta ao mesmo e-mail não se repete em 30 dias", async () => {
  const { run, add, deps } = await makeDb();
  await lib.saveRecoverySettings(run, { enabled: true, percent: 15 });
  const first = await add({ hours: 50 });
  assert.equal((await lib.runRecoveryOffers(run, deps({ send: async () => { throw new Error("rede"); } }))).failed, 1);
  const [event] = await run(`SELECT note FROM order_events WHERE order_id = $1`, [first]);
  assert.match(event.note, /não enviado: falha no envio$/);

  await run(`UPDATE order_events SET created_at = $1::timestamp`, [ago(1)]);
  await add({ hours: 60 }); // outro pedido do mesmo e-mail
  assert.equal((await lib.findRecoveryCandidates(run, NOW)).length, 0);
});

test("fiação: cron depois dos lembretes, trava do cupom na criação do pedido, checkout com ?cupom=, /retomar e admin", () => {
  assert.ok(read("src/app/api/cron/remind-unpaid-orders/route.ts").includes("runRecoveryOffers(run,"));
  const create = read("src/app/api/orders/create/route.ts");
  assert.ok(create.includes("recoveryCouponOwnerError(getAppSqlRunner(), code, customerEmail)"));
  assert.ok(read("src/app/checkout/page.tsx").includes('new URLSearchParams(window.location.search).get("cupom")'));
  assert.ok(read("src/app/retomar/[token]/page.tsx").includes("verifyTrackingToken"));
  assert.ok(read("src/app/api/admin/recovery-offer/route.ts").includes("isAdminRequest(request)"));
  assert.ok(read("src/app/admin/(protected)/layout.tsx").includes('href="/admin/recuperacao"'));
});
