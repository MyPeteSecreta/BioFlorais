/*
 * Rodada 4 (A2/A3/A5/A8): acompanhamento do pedido. Busca (acerto, erro,
 * limite), link assinado, isolamento entre clientes, linha do tempo, boleto,
 * itens com nome completo e bonificados; mensagens (chamada curta, rodízio).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = "segredo-de-teste-acompanhamento";

const {
  allowTrackingAttempt,
  buildTimeline,
  findOrderForTracking,
  findOrdersByEmailAndDocument,
  hashIp,
  listClientOrders,
  loadTrackingView,
  normalizeOrderNumber,
  parseContact,
  progressLabel,
  signTrackingToken,
  verifyTrackingToken,
} = await import("../src/lib/order-tracking.ts");
const { clampSeconds, parseMessageInput, DEFAULT_ROTATION } = await import("../src/lib/b2b/retailer-messages.ts");

const UUID = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const CUSTOMER_A = UUID(1);
const CUSTOMER_B = UUID(2);
const ORDER_A = UUID(11); // número 00000011
const ORDER_B = UUID(12);
const ORDER_PIX = UUID(13);
const ORDER_BOLETO = UUID(14);
const CLIENT_1 = UUID(21);
const CLIENT_2 = UUID(22);
const PRODUCT = UUID(31);

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text, cpf text, cnpj text);
    CREATE TABLE addresses (id uuid PRIMARY KEY, cep text, city text, state text, street text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text);
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, shipping_address_id uuid, status text, fulfillment_status text, payment_method text,
      subtotal_cents int, discount_cents int, shipping_cents int, total_cents int, shipping_service_name text, tracking_code text,
      b2b_client_id uuid, b2b_offer_id uuid, b2b_responsible_id uuid, b2b_responsible_name text, created_at timestamp DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int, product_name_snapshot text);
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, status text, method text, raw_payload jsonb, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_boleto_requests (order_id uuid PRIMARY KEY, installments int, installment_amount_cents int, last_installment_amount_cents int, status text DEFAULT 'pending_request', schedule jsonb);
    CREATE TABLE b2b_boleto_payments (order_id uuid, installment int, paid_at date, paid_cents int, note text, created_by text, created_at timestamp DEFAULT now(), PRIMARY KEY (order_id, installment));

    INSERT INTO customers VALUES ('${CUSTOMER_A}', 'Ana', 'Ana@Exemplo.com', '123.456.789-09', NULL), ('${CUSTOMER_B}', 'Beto', 'beto@exemplo.com', NULL, '12.345.678/0001-90');
    INSERT INTO addresses VALUES ('${UUID(41)}', '22041-001', 'Rio de Janeiro', 'RJ', 'Rua Secreta 100');
    INSERT INTO products VALUES ('${PRODUCT}', 'cosmeticos-pet-shampoo-agressividade', 'Agressividade', 'Shampoo', 'cosmeticos-pet');
    INSERT INTO b2b_clients VALUES ('${CLIENT_1}', 'Loja 1'), ('${CLIENT_2}', 'Loja 2');

    INSERT INTO orders (id, customer_id, shipping_address_id, status, fulfillment_status, payment_method, subtotal_cents, discount_cents, shipping_cents, total_cents, created_at)
      VALUES ('${ORDER_A}', '${CUSTOMER_A}', '${UUID(41)}', 'paid', 'paid_to_prepare', 'pix', 10000, 700, 990, 10290, '2026-10-01 12:00:00'),
             ('${ORDER_B}', '${CUSTOMER_B}', '${UUID(41)}', 'cancelled', 'cancelled', 'pix', 5000, 0, 0, 5000, '2026-10-02 12:00:00'),
             ('${ORDER_PIX}', '${CUSTOMER_A}', '${UUID(41)}', 'pending', 'awaiting_payment', 'pix', 8000, 0, 0, 8000, now() AT TIME ZONE 'UTC');
    INSERT INTO orders (id, customer_id, status, fulfillment_status, payment_method, subtotal_cents, discount_cents, shipping_cents, total_cents, b2b_client_id, b2b_offer_id, created_at)
      VALUES ('${ORDER_BOLETO}', '${CUSTOMER_A}', 'pending', 'awaiting_payment', 'boleto', 100000, 0, 0, 100000, '${CLIENT_1}', '${UUID(51)}', '2026-10-03 12:00:00');
    INSERT INTO orders (id, customer_id, status, fulfillment_status, payment_method, total_cents, b2b_client_id, b2b_offer_id)
      VALUES ('${UUID(15)}', '${CUSTOMER_B}', 'paid', 'shipped', 'pix', 9000, '${CLIENT_2}', '${UUID(52)}');

    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, product_name_snapshot) VALUES
      ('${ORDER_A}', '${PRODUCT}', 2, 5000, NULL), ('${ORDER_A}', '${PRODUCT}', 1, 0, NULL), ('${ORDER_BOLETO}', '${PRODUCT}', 1, 100000, 'Shampoo Agressividade · Cosméticos Pet · 500 ml');
    INSERT INTO payments (order_id, status, method, raw_payload, created_at) VALUES
      ('${ORDER_A}', 'paid', 'pix', '{}', '2026-10-01 12:10:00'),
      ('${ORDER_PIX}', 'pending', 'pix', '{"qr_code":"00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000"}', now() AT TIME ZONE 'UTC');
    INSERT INTO b2b_boleto_requests VALUES ('${ORDER_BOLETO}', 2, 50000, 50000, 'pending_request',
      '[{"installment":1,"dueDate":"2026-10-31","amountCents":50000},{"installment":2,"dueDate":"2026-11-14","amountCents":50000}]'::jsonb);
    INSERT INTO b2b_boleto_payments (order_id, installment, paid_at, paid_cents) VALUES ('${ORDER_BOLETO}', 1, '2026-10-30', 50000);
  `);
});

after(async () => {
  await pg?.close();
});

test("link assinado: confere, rejeita assinatura trocada, id de outro pedido e lixo; não leva PII", () => {
  const token = signTrackingToken(ORDER_A);
  assert.ok(token.startsWith(`${ORDER_A}.`));
  assert.equal(verifyTrackingToken(token), ORDER_A);
  assert.equal(token.includes("@"), false);

  assert.equal(verifyTrackingToken(`${ORDER_B}.${token.split(".")[1]}`), null); // assinatura de outro pedido
  assert.equal(verifyTrackingToken(`${ORDER_A}.${"x".repeat(32)}`), null);
  assert.equal(verifyTrackingToken(`${ORDER_A}.`), null);
  assert.equal(verifyTrackingToken("não-é-token"), null);
  assert.equal(verifyTrackingToken(null), null);
});

test("busca: número + e-mail OU CPF/CNPJ acha; erro (número errado, contato de outro cliente) devolve null igual", async () => {
  assert.equal(await findOrderForTracking(run, "#00000011", "ana@exemplo.com"), ORDER_A); // e-mail sem diferenciar maiúsculas
  assert.equal(await findOrderForTracking(run, "00000011", "123.456.789-09"), ORDER_A); // CPF com máscara
  assert.equal(await findOrderForTracking(run, "00000012", "12345678000190"), ORDER_B); // CNPJ
  assert.equal(await findOrderForTracking(run, "00000011", "beto@exemplo.com"), null); // contato de OUTRO cliente
  assert.equal(await findOrderForTracking(run, "00000099", "ana@exemplo.com"), null); // pedido inexistente
  assert.equal(await findOrderForTracking(run, "00000011", "123"), null); // contato inválido
  assert.equal(await findOrderForTracking(run, "xyz", "ana@exemplo.com"), null);
  assert.equal(normalizeOrderNumber("#3f9a21c4"), "3F9A21C4");
  assert.deepEqual(parseContact(" Ana@X.com "), { email: "ana@x.com", digits: null });
});

test("limite de tentativas: 5 a cada 10 min por IP, libera depois; IPs diferentes não se afetam", async () => {
  await pg.exec(sqlFile("23b_acompanhamento_pedido.sql"));
  await pg.exec(sqlFile("23b_acompanhamento_pedido.sql")); // idempotente

  const ip = hashIp("203.0.113.9");
  const t0 = new Date("2026-10-03T12:00:00Z");

  for (let i = 0; i < 5; i++) assert.equal(await allowTrackingAttempt(run, ip, new Date(t0.getTime() + i * 1000)), true);
  assert.equal(await allowTrackingAttempt(run, ip, new Date(t0.getTime() + 10_000)), false); // 6ª bloqueada
  assert.equal(await allowTrackingAttempt(run, hashIp("198.51.100.7"), new Date(t0.getTime() + 10_000)), true);
  assert.equal(await allowTrackingAttempt(run, ip, new Date(t0.getTime() + 11 * 60_000)), true); // passou a janela
});

test("tela do pedido: itens com NOME COMPLETO, bonificado, totais, endereço parcial (sem rua) e linha do tempo", async () => {
  const view = await loadTrackingView(run, ORDER_A);

  assert.equal(view.number, "00000011");
  assert.deepEqual(view.items.map((item) => [item.name, item.qty, item.bonified]), [
    ["Shampoo Agressividade · Cosméticos Pet · 500 ml", 2, false],
    ["Shampoo Agressividade · Cosméticos Pet · 500 ml", 1, true],
  ]);
  assert.deepEqual([view.subtotalCents, view.discountCents, view.shippingCents, view.totalCents], [10000, 700, 990, 10290]);
  assert.equal(view.addressPartial, "Rio de Janeiro/RJ · CEP 22041-***");
  assert.equal(JSON.stringify(view).includes("Rua Secreta"), false);

  assert.deepEqual(view.timeline.steps.map((step) => [step.key, step.state]), [
    ["received", "done"], ["payment", "done"], ["separating", "current"], ["shipped", "pending"], ["delivered", "pending"],
  ]);
});

test("linha do tempo: enviado com rastreio, entregue, cancelado e boleto parcial", () => {
  const base = { paymentMethod: "pix", createdAt: new Date("2026-10-01T12:00:00Z"), paidAt: new Date("2026-10-01T12:10:00Z"), boletoPaid: 0, boletoTotal: 0, trackingCode: null, carrier: null };
  const event = (name, extra = {}) => ({ event: name, carrier: null, trackingCode: null, trackingUrl: null, note: null, createdAt: new Date("2026-10-04T15:00:00Z"), ...extra });

  const shipped = buildTimeline({ ...base, status: "paid", fulfillmentStatus: "shipped", events: [event("shipped", { carrier: "Correios", trackingCode: "AA123" })] });
  assert.deepEqual(shipped.steps.map((step) => step.state), ["done", "done", "done", "done", "current"]);
  assert.match(shipped.steps[3].detail, /Correios/);

  const delivered = buildTimeline({ ...base, status: "paid", fulfillmentStatus: "delivered", events: [event("shipped"), event("delivered")] });
  assert.equal(delivered.steps[4].state, "done");

  assert.equal(buildTimeline({ ...base, status: "cancelled", fulfillmentStatus: "cancelled", events: [] }).cancelled, true);

  const boleto = buildTimeline({ ...base, paymentMethod: "boleto", status: "pending", fulfillmentStatus: "awaiting_payment", paidAt: null, boletoPaid: 1, boletoTotal: 2, events: [] });
  assert.equal(boleto.steps[1].detail, "Boleto: 1 de 2 parcela(s) paga(s)");
  assert.equal(progressLabel("pending", "awaiting_payment"), "Aguardando pagamento");
  assert.equal(progressLabel("paid", "shipped"), "Enviado");
});

test("Pix pendente e válido: mostra de novo o copia-e-cola; boleto: parcelas com situação", async () => {
  const pix = await loadTrackingView(run, ORDER_PIX);
  assert.match(pix.pixCode, /^000201/);

  const boleto = await loadTrackingView(run, ORDER_BOLETO);
  assert.equal(boleto.isB2B, true);
  assert.equal(boleto.boleto.length, 2);
  assert.equal(boleto.boleto[0].status, "pago");
  assert.ok(["aberto", "vencido"].includes(boleto.boleto[1].status));
  assert.equal(boleto.items[0].name, "Shampoo Agressividade · Cosméticos Pet · 500 ml");
});

test("A3 isolamento: 'Meus pedidos' lista só os pedidos do PRÓPRIO cliente (token da oferta → clientId)", async () => {
  const mine = await listClientOrders(run, CLIENT_1);
  assert.deepEqual(mine.map((order) => order.orderId), [ORDER_BOLETO]);

  const other = await listClientOrders(run, CLIENT_2);
  assert.deepEqual(other.map((order) => order.orderId), [UUID(15)]);
  assert.ok(!other.some((order) => order.orderId === ORDER_BOLETO));
  assert.deepEqual(await listClientOrders(run, "não-é-uuid"), []);
});

test("A5: cupom que desconta frete é só do admin: o B2B recusa cupom Partner/UGC e o B2C não lê discounts_shipping", () => {
  const resolver = readFileSync(new URL("../src/lib/b2b/coupon-resolver.ts", import.meta.url), "utf8");
  assert.match(resolver, /coupon\.couponType === "partner"/); // Partner/UGC nunca vale no B2B
  assert.match(resolver, /eq\(coupons\.scope, "b2b"\)/); // só cupom comercial da loja (scope b2b, cadastrado no admin)

  for (const rel of ["../src/app/api/orders/create/route.ts", "../src/app/api/coupons/validate/route.ts", "../src/app/api/cart/quote/route.ts"]) {
    assert.equal(/discountsShipping|discounts_shipping/.test(readFileSync(new URL(rel, import.meta.url), "utf8")), false, rel);
  }
});

test("A8: chamada curta até 30 caracteres, sem 'frete grátis'; rodízio 5–3600 s, padrão 60", () => {
  assert.equal(parseMessageInput({ title: "Oi", body: "texto", shortCall: "x".repeat(31) }).ok, false);
  assert.equal(parseMessageInput({ title: "Oi", body: "texto", shortCall: "Frete grátis hoje" }).ok, false);
  assert.equal(parseMessageInput({ title: "Oi", body: "texto", shortCall: "Novidades para você" }).value.shortCall, "Novidades para você");

  assert.deepEqual(DEFAULT_ROTATION, { bannerSeconds: 60, buttonSeconds: 60 });
  assert.equal(clampSeconds("30", 60), 30);
  assert.equal(clampSeconds("1", 60), 60);
  assert.equal(clampSeconds("abc", 60), 60);
  assert.equal(clampSeconds(99999, 60), 60);
});

test("25b: chamada curta + tempos padrão, idempotente, sem criar mensagens", async () => {
  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now());
                 CREATE TABLE b2b_retailer_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, body text);`);
  await pg.exec(sqlFile("25b_mensagens_chamada_e_rodizio.sql"));
  await pg.exec(sqlFile("25b_mensagens_chamada_e_rodizio.sql"));

  const settings = await run(`SELECT key, value FROM b2b_settings ORDER BY key`);
  assert.deepEqual(settings, [{ key: "retailer_banner_seconds", value: "60" }, { key: "retailer_button_seconds", value: "60" }]);
  assert.equal((await run(`SELECT count(*)::int AS total FROM b2b_retailer_messages`))[0].total, 0); // não semeia mensagens
  assert.equal((await run(`SELECT 1 FROM information_schema.columns WHERE table_name='b2b_retailer_messages' AND column_name='short_call'`)).length, 1);
});

test("busca por e-mail + CPF/CNPJ: 0, 1 e vários pedidos; só últimos 6 meses; só o mesmo cliente", async () => {
  const NOW = new Date("2026-10-05T15:00:00Z");
  const CARLA = UUID(61); // sem pedidos
  const DUDU = UUID(62); // 1 pedido
  const ANA_HOMONIMA = UUID(63); // mesmo e-mail da Ana, outro CPF
  await run(`INSERT INTO customers VALUES ($1,'Carla','carla@exemplo.com','111.444.777-35',NULL), ($2,'Dudu','dudu@exemplo.com',NULL,'11.222.333/0001-81'), ($3,'Outra','ana@exemplo.com','529.982.247-25',NULL)`, [CARLA, DUDU, ANA_HOMONIMA]);
  await run(`INSERT INTO orders (id, customer_id, status, fulfillment_status, payment_method, total_cents, created_at) VALUES
    ($1, $2, 'paid', 'shipped', 'pix', 7000, '2026-09-20 10:00:00'),
    ($3, $4, 'paid', 'paid_to_prepare', 'pix', 3000, '2026-10-04 10:00:00'),
    ($5, $4, 'paid', 'paid_to_prepare', 'pix', 9999, '2026-10-04 11:00:00'),
    ($6, $7, 'paid', 'delivered', 'pix', 4000, '2026-02-01 10:00:00')`,
    [UUID(71), DUDU, UUID(72), ANA_HOMONIMA, UUID(73), UUID(74), CUSTOMER_A]);

  // 0 pedidos
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "carla@exemplo.com", "111.444.777-35", NOW), []);
  // 1 pedido (CNPJ, e-mail em outra caixa)
  const one = await findOrdersByEmailAndDocument(run, " DUDU@exemplo.com ", "11222333000181", NOW);
  assert.equal(one.length, 1);
  assert.equal(one[0].number, "00000071");
  assert.equal(one[0].totalCents, 7000);
  // vários, mais novo primeiro, sem o de 8 meses atrás
  const many = await findOrdersByEmailAndDocument(run, "ANA@exemplo.com", "123.456.789-09", NOW);
  const ids = many.map((o) => o.orderId);
  assert.ok(ids.length >= 3);
  assert.ok(ids.includes(ORDER_A) && ids.includes(ORDER_BOLETO) && ids.includes(ORDER_PIX));
  assert.ok(!ids.includes(UUID(74)), "pedido de mais de 6 meses fora");
  assert.ok(!ids.includes(UUID(72)) && !ids.includes(UUID(73)), "pedidos de outro cliente com o mesmo e-mail fora");
  const times = many.map((o) => new Date(o.createdAt).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
  // a homônima enxerga só os dela
  const other = await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "52998224725", NOW);
  assert.deepEqual(other.map((o) => o.orderId).sort(), [UUID(72), UUID(73)].sort());
});

test("e-mail + CPF/CNPJ: um certo e o outro errado, ou faltando, devolve vazio (resposta genérica)", async () => {
  const NOW = new Date("2026-10-05T15:00:00Z");
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "000.000.000-00", NOW), []);
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "errado@exemplo.com", "123.456.789-09", NOW), []);
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "", NOW), []);
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "", "123.456.789-09", NOW), []);
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "ana@exemplo.com", "123", NOW), []);
  // CPF de uma pessoa com e-mail de outra
  assert.deepEqual(await findOrdersByEmailAndDocument(run, "beto@exemplo.com", "123.456.789-09", NOW), []);
});

test("rota de busca: limite de tentativas vem ANTES de qualquer consulta, nos dois modos; resposta genérica única; URL sem dado pessoal", () => {
  const route = readFileSync(new URL("../src/app/api/orders/track/route.ts", import.meta.url), "utf8");
  const limit = route.indexOf("allowTrackingAttempt");
  assert.ok(limit > 0);
  assert.ok(limit < route.indexOf("findOrdersByEmailAndDocument("), "limite antes da busca por e-mail+CPF");
  assert.ok(limit < route.indexOf("findOrderForTracking("), "limite antes da busca por número");
  assert.equal((route.match(/GENERIC/g) ?? []).length >= 3, true);
  const page = readFileSync(new URL("../src/app/acompanhe-seu-pedido/page.tsx", import.meta.url), "utf8");
  assert.ok(!/router\.push\([^)]*(email|document|contact)/.test(page), "nada de dado pessoal na URL");
  assert.ok(page.includes("Tenho o número do pedido"));
  const url = `/acompanhe/${signTrackingToken(ORDER_A)}`;
  assert.ok(!url.includes("ana") && !url.includes("123456789"));
});
