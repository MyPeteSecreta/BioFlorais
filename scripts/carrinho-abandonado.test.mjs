/*
 * Carrinho abandonado (src/lib/cart-recovery.ts, SQL 56b; Luis, 12/11): só com aceite no checkout (caixa desmarcada), 2 h lembrete sem
 * desconto, 2 dias cupom VOLTA pessoal (só com a oferta de desconto ligada), no máximo 1 oferta a cada 30 dias por e-mail, sai quem
 * fez pedido, link para sair apaga, retenção de 30 dias, desligado por padrão.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "segredo-de-teste";

const lib = await import("../src/lib/cart-recovery.ts");
const offerLib = await import("../src/lib/recovery-offer.ts");
const tracking = await import("../src/lib/order-tracking.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const NOW = new Date("2026-11-12T15:00:00Z");
const ago = (hours) => new Date(NOW.getTime() - hours * 3600_000);
const SITE = "https://www.bioflorais.com.br";
const ITEMS = [{ productSlug: "adulto-floral-em-gotas-sono", qty: 2 }];

async function makeDb({ withTable = true } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text);
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, status text, total_cents int, created_at timestamp,
      b2b_offer_id uuid, b2b_client_id uuid);
    CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, event text, note text, created_by text,
      created_at timestamp DEFAULT now());
    CREATE TABLE coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, discount_type text NOT NULL,
      discount_value int NOT NULL, coupon_type text NOT NULL DEFAULT 'normal', scope text NOT NULL DEFAULT 'b2c', max_uses int,
      used_count int NOT NULL DEFAULT 0, one_per_customer boolean NOT NULL DEFAULT false, expires_at timestamp, active boolean NOT NULL DEFAULT true);
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now() NOT NULL);
  `);
  if (withTable) {
    await pg.exec(read("sql/b2b/56b_carrinho_abandonado.sql"));
    await pg.exec(read("sql/b2b/56b_carrinho_abandonado.sql")); // idempotente
  }
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  const sent = [];
  const deps = (now = NOW) => ({ siteUrl: SITE, now, send: async (mail) => (sent.push(mail), true) });
  const save = (email, hoursAgo, items = lib.sanitizeCartItems(ITEMS), name = "Maria Silva") =>
    lib.saveCartForRecovery(run, { email, name, items, now: ago(hoursAgo) });
  return { run, sent, deps, save };
}

test("entrada: só produtos do catálogo, quantidade 1 a 20, nome do catálogo; e-mail válido", () => {
  assert.deepEqual(lib.sanitizeCartItems([{ productSlug: "adulto-floral-em-gotas-sono", qty: 2, name: "<b>x</b>" }, { productSlug: "nao-existe", qty: 1 }, { productSlug: "adulto-floral-em-gotas-sono", qty: 30 }]), [
    { productSlug: "adulto-floral-em-gotas-sono", name: "Sono", qty: 20 },
  ]);
  assert.deepEqual(lib.sanitizeCartItems("x"), []);
  assert.equal(lib.cleanEmail(" Maria@Example.com "), "maria@example.com");
  assert.equal(lib.cleanEmail("sem-arroba"), null);
});

test("sem a tabela (SQL 56b) nada acontece; desligado por padrão: nada sai, mas a retenção de 30 dias roda", async () => {
  const none = await makeDb({ withTable: false });
  assert.deepEqual(await lib.runCartRecovery(none.run, none.deps()), { enabled: false, ready: false, reminders: 0, offers: 0, failed: 0, purged: 0 });

  const { run, sent, deps, save } = await makeDb();
  await save("maria@example.com", 3);
  await save("velha@example.com", 31 * 24);
  assert.equal(await lib.loadCartRecoveryEnabled(run), false);
  const result = await lib.runCartRecovery(run, deps());
  assert.deepEqual([result.enabled, result.reminders, result.purged, sent.length], [false, 0, 1, 0]);
  assert.equal((await run(`SELECT count(*)::int AS n FROM cart_recoveries`))[0].n, 1, "a de 31 dias foi apagada");
});

test("ligado: lembrete 2 h depois (sem desconto, uma vez); oferta em 2 dias só com a oferta de desconto ligada; cupom pessoal de 48 h", async () => {
  const { run, sent, deps, save } = await makeDb();
  await lib.saveCartRecoveryEnabled(run, true);
  await save("maria@example.com", 3);
  await save("cedo@example.com", 1); // ainda não deu 2 h

  let result = await lib.runCartRecovery(run, deps());
  assert.equal(result.reminders, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "maria@example.com");
  assert.equal(sent[0].subject, "Sua sacola na Bio Florais está guardada");
  assert.ok(sent[0].text.includes("2× Sono") && sent[0].text.includes(`${SITE}/sacola/`) && sent[0].text.includes(`${SITE}/sacola/sair/`));
  assert.ok(!/VOLTA-|desconto/i.test(sent[0].subject));

  result = await lib.runCartRecovery(run, deps());
  assert.equal(result.reminders, 0, "uma vez");

  // 2 dias depois, oferta desligada: nada
  const later = new Date(NOW.getTime() + 47 * 3600_000);
  assert.equal((await lib.runCartRecovery(run, deps(later))).offers, 0);

  // ligando a oferta (mesmo % do pedido não pago)
  await offerLib.saveRecoverySettings(run, { enabled: true, percent: 15 });
  result = await lib.runCartRecovery(run, deps(later));
  assert.equal(result.offers, 1);
  const mail = sent.at(-1);
  assert.equal(mail.subject, "15% de desconto para levar a sua sacola");
  const code = /VOLTA-[A-Z0-9]{6}/.exec(mail.text)[0];
  const [coupon] = await run(`SELECT discount_value, max_uses, one_per_customer, scope FROM coupons WHERE code = $1`, [code]);
  assert.deepEqual(coupon, { discount_value: 15, max_uses: 1, one_per_customer: true, scope: "b2c" });
  assert.equal(await offerLib.recoveryCouponOwnerError(run, code, "maria@example.com"), null, "preso ao e-mail");
  assert.ok(await offerLib.recoveryCouponOwnerError(run, code, "outra@example.com"));

  assert.equal((await lib.runCartRecovery(run, deps(later))).offers, 0, "uma oferta só");
});

test("quem fez pedido depois de mexer na sacola sai; quem recebeu a oferta do pedido não pago em 30 dias não recebe outra", async () => {
  const { run, sent, deps, save } = await makeDb();
  await lib.saveCartRecoveryEnabled(run, true);
  await offerLib.saveRecoverySettings(run, { enabled: true, percent: 10 });

  await save("comprou@example.com", 3);
  const [customer] = await run(`INSERT INTO customers (name, email) VALUES ('Ana', 'Comprou@Example.com') RETURNING id`);
  await run(`INSERT INTO orders (customer_id, status, total_cents, created_at) VALUES ($1, 'pending', 7180, $2::timestamp)`, [customer.id, ago(2.5).toISOString().replace("Z", "")]);

  const result = await lib.runCartRecovery(run, deps());
  assert.equal(result.reminders, 0);
  assert.equal(sent.length, 0);
  const [row] = await run(`SELECT converted_at FROM cart_recoveries WHERE email = 'comprou@example.com'`);
  assert.ok(row.converted_at, "convertida");

  // oferta do pedido não pago há 10 dias para o mesmo e-mail
  await save("joana@example.com", 50);
  await run(`UPDATE cart_recoveries SET reminder_sent_at = $1::timestamp WHERE email = 'joana@example.com'`, [ago(47).toISOString().replace("Z", "")]);
  const [c2] = await run(`INSERT INTO customers (name, email) VALUES ('Joana', 'joana@example.com') RETURNING id`);
  const [o2] = await run(`INSERT INTO orders (customer_id, status, total_cents, created_at) VALUES ($1, 'cancelled', 1, $2::timestamp) RETURNING id`, [c2.id, ago(400).toISOString().replace("Z", "")]);
  await run(`INSERT INTO order_events (order_id, event, note, created_at) VALUES ($1, 'recovery_offer', 'VOLTA-ABC123', $2::timestamp)`, [o2.id, ago(240).toISOString().replace("Z", "")]);
  assert.equal((await lib.runCartRecovery(run, deps())).offers, 0);
});

test("sacola nova depois de 30 dias recomeça; sacola vazia ou consentimento retirado apaga; link para sair apaga", async () => {
  const { run, save } = await makeDb();
  assert.equal(await save("maria@example.com", 3), "saved");
  assert.equal(await save("MARIA@example.com", 2), "saved", "o mesmo e-mail atualiza, não duplica");
  assert.equal((await run(`SELECT count(*)::int AS n FROM cart_recoveries`))[0].n, 1);
  assert.equal(await save("maria@example.com", 1, []), "removed");
  assert.equal((await run(`SELECT count(*)::int AS n FROM cart_recoveries`))[0].n, 0);

  await save("maria@example.com", 1);
  const [row] = await run(`SELECT id FROM cart_recoveries`);
  const token = tracking.signTrackingToken(row.id);
  assert.equal(tracking.verifyTrackingToken(token), row.id);
  const restored = await lib.loadCartForRestore(run, row.id);
  assert.deepEqual(restored, { items: [{ productSlug: "adulto-floral-em-gotas-sono", name: "Sono", qty: 2 }], offer: null });
  assert.equal(await lib.removeCartById(run, row.id), true);
  assert.equal(await lib.loadCartForRestore(run, row.id), null);
});

test("relatório e fiação: checkout com caixa DESMARCADA e só com o recurso ligado; tarefa de 15 min; páginas sem dado pessoal na URL", async () => {
  const { run, save } = await makeDb();
  await save("maria@example.com", 3);
  assert.deepEqual(await lib.loadCartRecoveryReport(run, NOW), { active: 1, reminders30: 0, offers30: 0, converted30: 0, couponsUsed: 0 });

  const optIn = read("src/components/cart/CartReminderOptIn.tsx");
  assert.ok(optIn.includes("useState(false);") && optIn.includes("if (!enabled) return null;"), "desmarcada e só com o recurso ligado");
  assert.ok(optIn.includes("Quero receber um lembrete da minha sacola por e-mail"));
  assert.ok(!/name="/.test(optIn), "a caixa não vai no pedido");
  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("<CartReminderOptIn items={reminderItems} />"));
  const cron = read("src/app/api/cron/remind-unpaid-orders/route.ts");
  assert.ok(cron.includes("runCartRecovery(run,"));
  const api = read("src/app/api/cart/recovery/route.ts");
  assert.ok(api.includes("if (body.consent !== true) {") && api.includes("removeCartByEmail(run, email)"), "retirar o aceite apaga");
  assert.ok(read("src/app/sacola/sair/[token]/page.tsx").includes("UnsubscribeCartButton"), "sair pede confirmação (leitor de e-mail não apaga sozinho)");
  const sql = read("sql/b2b/56b_carrinho_abandonado.sql");
  assert.ok(/CREATE TABLE IF NOT EXISTS cart_recoveries/.test(sql) && !/\b(UPDATE|DELETE|DROP)\b/.test(sql.replace(/--.*$/gm, "")), "só aditivo");
});
