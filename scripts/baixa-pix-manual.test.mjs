/*
 * Baixa manual de Pix recebido fora do site (aprovada em princípio, 16/11): só pedido Pix pendente e não arquivado, valor igual ao
 * total, registro em payments (manual/pix/paid na data do recebimento) e em order_events (quem/quando/valor/comprovante), sem CPF na
 * referência, segunda baixa recusada, retomada se o finalizador falhou, e o finalizador do pagamento aprovado é o mesmo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import { MANUAL_PIX_EVENT, recordManualPix, validateManualPix } from "../src/lib/admin/manual-pix.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ORDER = "6d1f0c2a-1111-4c2b-9d7e-000000000001";
const ok = { by: "Luis", amountCents: 25990, receivedOn: "2026-11-15", reference: "E2E 123456789 Itaú 14h32" };

test("validação: nome, valor, data (não futura), referência; CPF/CNPJ na referência é recusado", () => {
  assert.equal(validateManualPix(ok, "2026-11-16").ok, true);
  assert.equal(validateManualPix({ ...ok, by: " " }, "2026-11-16").ok, false);
  assert.equal(validateManualPix({ ...ok, amountCents: 0 }, "2026-11-16").ok, false);
  assert.equal(validateManualPix({ ...ok, amountCents: 259.9 }, "2026-11-16").ok, false);
  assert.equal(validateManualPix({ ...ok, receivedOn: "2026-11-17" }, "2026-11-16").ok, false, "futuro");
  assert.equal(validateManualPix({ ...ok, receivedOn: "15/11/2026" }, "2026-11-16").ok, false);
  assert.equal(validateManualPix({ ...ok, reference: "ok" }, "2026-11-16").ok, false);
  assert.match(validateManualPix({ ...ok, reference: "pago por 123.456.789-09" }, "2026-11-16").error, /CPF/);
  assert.match(validateManualPix({ ...ok, reference: "12.345.678/0001-90" }, "2026-11-16").error, /CNPJ/);
});

test("baixa: grava payments e order_events, chama o finalizador; 2ª baixa recusada; valor diferente, cartão, pago ou arquivado: recusa", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE orders (id uuid PRIMARY KEY, status text NOT NULL, total_cents integer NOT NULL, payment_method text, archived_at timestamp);
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL, provider text NOT NULL, external_id text, method text,
      status text NOT NULL DEFAULT 'pending', raw_payload jsonb, created_at timestamp DEFAULT now());
    CREATE TABLE order_events (id serial PRIMARY KEY, order_id uuid, event text, note text, created_by text, created_at timestamp DEFAULT now());
  `);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  await run(`INSERT INTO orders (id, status, total_cents, payment_method) VALUES ($1, 'pending', 25990, 'pix')`, [ORDER]);

  const finalized = [];
  const finalize = async (args) => {
    finalized.push(args);
    await run(`UPDATE orders SET status = 'paid' WHERE id = $1`, [args.orderId]);
  };
  const opts = { today: "2026-11-16", nowIso: "2026-11-16T22:00:00.000Z", finalize };

  // valor diferente do total: recusa, nada gravado
  const wrong = await recordManualPix(run, ORDER, { ...ok, amountCents: 25000 }, opts);
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /diferente do total/);
  assert.equal((await run(`SELECT count(*)::int AS n FROM payments`))[0].n, 0);

  const done = await recordManualPix(run, ORDER, ok, opts);
  assert.deepEqual(done, { ok: true, resumed: false });
  const [payment] = await run(`SELECT provider, method, status, external_id, raw_payload, to_char(created_at, 'YYYY-MM-DD') AS dia FROM payments`);
  assert.deepEqual([payment.provider, payment.method, payment.status, payment.dia], ["manual", "pix", "paid", "2026-11-15"], "data do recebimento (comissão conta daí)");
  assert.equal(payment.raw_payload.by, "Luis");
  assert.equal(payment.raw_payload.amountCents, 25990);
  assert.equal(payment.raw_payload.reference, ok.reference);
  const [event] = await run(`SELECT event, note, created_by FROM order_events`);
  assert.equal(event.event, MANUAL_PIX_EVENT);
  assert.match(event.note, /Pix pago fora do site: R\$\s?259,90 em 15\/11\/2026, comprovante E2E 123456789 Itaú 14h32, por Luis/);
  assert.equal(event.created_by, "admin: Luis");
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].paidAt, "2026-11-15T15:00:00.000Z");
  assert.match(finalized[0].providerPaymentId, /^manual-pix:/);

  // segunda baixa (pedido já pago): recusada, nada novo
  const again = await recordManualPix(run, ORDER, ok, opts);
  assert.equal(again.ok, false);
  assert.equal((await run(`SELECT count(*)::int AS n FROM payments`))[0].n, 1);
  assert.equal(finalized.length, 1);

  // finalizador falhou antes: a baixa existe e o pedido ainda está pendente -> só termina (sem gravar de novo)
  await run(`UPDATE orders SET status = 'pending' WHERE id = $1`, [ORDER]);
  const resumed = await recordManualPix(run, ORDER, ok, opts);
  assert.deepEqual(resumed, { ok: true, resumed: true });
  assert.equal((await run(`SELECT count(*)::int AS n FROM payments`))[0].n, 1);
  assert.equal((await run(`SELECT count(*)::int AS n FROM order_events`))[0].n, 1);

  // cartão, arquivado e inexistente
  const CARD = "6d1f0c2a-1111-4c2b-9d7e-000000000002";
  const ARCH = "6d1f0c2a-1111-4c2b-9d7e-000000000003";
  await run(`INSERT INTO orders (id, status, total_cents, payment_method) VALUES ($1, 'pending', 25990, 'card')`, [CARD]);
  await run(`INSERT INTO orders (id, status, total_cents, payment_method, archived_at) VALUES ($1, 'pending', 25990, 'pix', now())`, [ARCH]);
  assert.match((await recordManualPix(run, CARD, ok, opts)).error, /não é de Pix/);
  assert.match((await recordManualPix(run, ARCH, ok, opts)).error, /arquivado/);
  assert.equal((await recordManualPix(run, "6d1f0c2a-1111-4c2b-9d7e-000000000009", ok, opts)).status, 404);
});

test("fiação: rota só para admin; usa o finalizador do pagamento aprovado; botão só em pedido Pix pendente", () => {
  const route = read("src/app/api/admin/orders/[id]/manual-pix/route.ts");
  assert.ok(route.includes("if (!isAdminRequest(request))"));
  assert.ok(route.includes("finalize: finalizeMercadoPagoPaid"), "mesmo finalizador: status, separação, cupom, e-mail uma vez por etapa");
  const page = read("src/app/admin/(protected)/pedidos/[id]/page.tsx");
  assert.ok(page.includes(`{order.status === "pending" && order.paymentMethod === "pix" && <ManualPixButton orderId={order.id} totalCents={order.totalCents} />}`));
  // e-mail: uma vez por etapa (o finalizador agenda; a regra de não repetir é do order-emails)
  assert.ok(read("src/lib/payments/finalize-mercadopago-paid.ts").includes("scheduleOrderEmail(input.orderId)"));
});
