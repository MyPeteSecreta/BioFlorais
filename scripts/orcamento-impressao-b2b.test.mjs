/*
 * Rodada 19c/19d — imprimir / PDF do pedido (marca, itens, quantidades, preços, descontos, frete, total, condição de pagamento,
 * observações) e SALVAR COMO ORÇAMENTO (pedido sem pagamento: status "Orçamento (pendente)", sem estoque, sem Omie, sem comissão;
 * reabre, ajusta e vira pedido; validade de 15 dias configurável).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const q = await import("../src/lib/b2b/quote-order.ts");
const sheet = await import("../src/lib/b2b/order-sheet.ts");
const history = await import("../src/lib/b2b/purchase-history.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const CLIENT = "50000000-0000-4000-8000-000000000001";
const OTHER = "50000000-0000-4000-8000-000000000002";
const OFFER = "60000000-0000-4000-8000-000000000001";
const QUOTE = "70000000-0000-4000-8000-000000000001";
const ORDER = "70000000-0000-4000-8000-000000000002";
const CUSTOMER = "80000000-0000-4000-8000-000000000001";
const ADDRESS = "81000000-0000-4000-8000-000000000001";
const P1 = "90000000-0000-4000-8000-000000000001";
const P2 = "90000000-0000-4000-8000-000000000002";

test("validade do orçamento: 15 dias por padrão, configurável (1 a 90), inválido volta ao padrão", () => {
  assert.equal(q.quoteValidityDays(undefined), 15);
  assert.equal(q.quoteValidityDays(""), 15);
  assert.equal(q.quoteValidityDays("30"), 30);
  assert.equal(q.quoteValidityDays("0"), 15);
  assert.equal(q.quoteValidityDays("91"), 15);
  assert.equal(q.quoteValidityDays("abc"), 15);
  const from = new Date("2026-10-01T12:00:00Z");
  assert.equal(q.quoteExpiry(from, 15).toISOString(), "2026-10-16T12:00:00.000Z");
  assert.equal(q.isQuoteExpired("2026-10-16T12:00:00Z", new Date("2026-10-16T11:59:59Z")), false);
  assert.equal(q.isQuoteExpired("2026-10-16T12:00:00Z", new Date("2026-10-16T12:00:01Z")), true);
  assert.equal(q.isQuoteExpired(null), false);
});

test("rótulos de status: Orçamento (pendente), vencido, convertido, substituído; pedido comum não tem rótulo de orçamento", () => {
  assert.equal(q.quoteStatusLabel("quote", "2099-01-01T00:00:00Z"), "Orçamento (pendente)");
  assert.equal(q.quoteStatusLabel("quote", "2000-01-01T00:00:00Z"), "Orçamento vencido");
  assert.equal(q.quoteStatusLabel("quote_converted"), "Orçamento convertido em pedido");
  assert.equal(q.quoteStatusLabel("quote_replaced"), "Orçamento substituído por outro");
  assert.equal(q.quoteStatusLabel("pending"), null);
  assert.equal(q.isQuoteStatus("quote"), true);
  assert.equal(q.isQuoteStatus("paid"), false);
});

test("orçamento NÃO conta como compra, NÃO reserva promoção, NÃO vai à Central/Omie e NÃO paga", () => {
  const counts = history.countsAsPurchaseSql("o");
  const reserves = history.reservesUseSql("o");
  assert.ok(!counts.includes("quote") && !reserves.includes("quote"));
  assert.ok(counts.includes("o.status = 'paid'") && reserves.includes("o.status = 'pending'"), "só pago e pendente contam");

  const central = read("src/lib/central/brand-api.ts");
  assert.ok(central.includes("WHERE o.status IN ('paid', 'approved')"), "a Central/Omie só lê pedido pago");
  assert.ok(read("src/lib/ads-tag-server.ts").includes("status IN ('paid', 'approved')"), "tag de anúncio só em pedido pago");

  for (const file of ["src/app/api/b2b/payments/boleto/route.ts"]) assert.ok(read(file).includes('order.status !== "pending"'), file);
  for (const file of ["src/app/api/b2b/payments/mercadopago/pix/route.ts", "src/app/api/b2b/payments/mercadopago/card/route.ts"]) {
    assert.ok(/pending/.test(read(file)), `${file}: só pedido pending é pago`);
  }
});

async function seed({ withQuoteColumn = true } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text, phone text, cpf text, cnpj text);
    CREATE TABLE addresses (id uuid PRIMARY KEY, cep text, street text, number text, complement text, district text, city text, state text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, subtotal_cents int, coupon_code text, coupon_discount_cents int DEFAULT 0,
      payment_method_discount_cents int DEFAULT 0, shipping_service_name text, shipping_cents int, total_cents int, customer_id uuid, shipping_address_id uuid,
      b2b_responsible_name text, b2b_client_id uuid, b2b_offer_id uuid, origin text, commercial_adjustments_json text, created_at timestamptz DEFAULT now());
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid, qty int, unit_price_cents int, product_name_snapshot text,
      promotion_percent text, promotion_discount_cents int);
    INSERT INTO customers VALUES ('${CUSTOMER}', 'Loja Flor de Lis Ltda', 'loja@x.com', '11912345678', NULL, '11222333000181');
    INSERT INTO addresses VALUES ('${ADDRESS}', '01310100', 'Av. Paulista', '1000', 'Sala 12', 'Bela Vista', 'São Paulo', 'SP');
    INSERT INTO products VALUES ('${P1}', 'adulto-floral-em-gotas-sono', 'Sono', 'floral', 'adulto'), ('${P2}', 'cosmeticos-shampoo-x', 'Shampoo X', 'shampoo', 'cosmeticos');
    INSERT INTO orders (id, status, subtotal_cents, shipping_service_name, shipping_cents, total_cents, customer_id, shipping_address_id, b2b_responsible_name, b2b_client_id, b2b_offer_id, commercial_adjustments_json)
      VALUES ('${QUOTE}', 'quote', 50000, 'PAC', 4500, 54500, '${CUSTOMER}', '${ADDRESS}', 'Vendedora Ana', '${CLIENT}', '${OFFER}', '{"displays":[{"key":"adulto-compacto","name":"Display Adulto","count":1}]}');
    INSERT INTO orders (id, status, payment_method, subtotal_cents, payment_method_discount_cents, shipping_service_name, shipping_cents, total_cents, customer_id, shipping_address_id, b2b_responsible_name, b2b_client_id, b2b_offer_id, commercial_adjustments_json)
      VALUES ('${ORDER}', 'paid', 'boleto', 50000, 0, 'PAC', 4500, 54500, '${CUSTOMER}', '${ADDRESS}', 'Vendedora Ana', '${CLIENT}', '${OFFER}', '{"installments":2}');
    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, promotion_percent, promotion_discount_cents) VALUES
      ('${QUOTE}', '${P1}', 10, 4000, '10', 4000), ('${QUOTE}', '${P1}', 2, 0, NULL, NULL), ('${QUOTE}', '${P2}', 5, 2000, NULL, NULL),
      ('${ORDER}', '${P1}', 10, 4000, NULL, NULL);`);
  if (withQuoteColumn) await pg.exec(read("sql/b2b/48b_orcamento_b2b.sql"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  return { pg, run };
}

test("48a/48b: aditivo, idempotente, linha final ok; conferência antes e depois", async () => {
  const { pg } = await seed({ withQuoteColumn: false });
  const conf = read("sql/b2b/48a_orcamento_b2b_conferencia_one_shot.sql");
  const before = (await pg.query(conf)).rows[0].conferencia_orcamento_b2b;
  assert.equal(before.coluna_quote_expires_at_existe, false);
  assert.equal(before.orcamentos_pendentes, 1);
  assert.equal(before.orcamentos_com_pagamento, 0);

  const sql = read("sql/b2b/48b_orcamento_b2b.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /SELECT 'ok' AS resultado;\s*$/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.equal((await pg.exec(sql)).at(-1).rows[0].resultado, "ok");
  await pg.exec(sql);
  const after = (await pg.query(conf)).rows[0].conferencia_orcamento_b2b;
  assert.equal(after.coluna_quote_expires_at_existe, true);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(conf.replace(/--.*$/gm, "")), "conferência é só leitura");
});

test("banco: validade, lista de orçamentos pendentes, converter/substituir só o do próprio cliente, sem apagar", async () => {
  const { run } = await seed();
  q.resetQuoteColumnCache();
  assert.equal(await q.quoteColumnReady(run), true);

  assert.equal(await q.setQuoteExpiry(run, QUOTE, new Date("2099-01-01T00:00:00Z")), true);
  assert.equal(await q.setQuoteExpiry(run, ORDER, new Date("2099-01-01T00:00:00Z")), false, "pedido comum não ganha validade");

  const list = await q.listClientQuotes(run, CLIENT);
  assert.equal(list.length, 1);
  assert.equal(list[0].orderId, QUOTE);
  assert.equal(list[0].offerId, OFFER);
  assert.equal(list[0].totalCents, 54500);
  assert.equal(list[0].expired, false);
  assert.equal((await q.listClientQuotes(run, OTHER)).length, 0);

  assert.equal(await q.closeQuote(run, QUOTE, OTHER, q.QUOTE_CONVERTED), false, "outro cliente não fecha o orçamento");
  assert.equal(await q.closeQuote(run, ORDER, CLIENT, q.QUOTE_CONVERTED), false, "pedido comum não é orçamento");
  assert.equal(await q.closeQuote(run, QUOTE, CLIENT, q.QUOTE_CONVERTED), true);
  assert.equal(await q.closeQuote(run, QUOTE, CLIENT, q.QUOTE_REPLACED), false, "já fechado");
  assert.equal((await q.listClientQuotes(run, CLIENT)).length, 0);
  assert.equal((await run(`SELECT status FROM orders WHERE id = '${QUOTE}'`))[0].status, "quote_converted", "nada é apagado");
  assert.equal((await run(`SELECT count(*)::int AS c FROM order_items WHERE order_id = '${QUOTE}'`))[0].c, 3);
});

test("folha do pedido: marca, comprador, itens (qtd, preço, desconto, grátis), displays, frete, total, condição de pagamento e observações", async () => {
  const { pg, run } = await seed();
  await pg.exec(`ALTER TABLE orders ADD COLUMN customer_note text; UPDATE orders SET customer_note = 'Entregar após as 14h' WHERE id = '${ORDER}'`);

  const data = await sheet.loadOrderSheet(run, ORDER, CLIENT);
  assert.equal(data.kind, "order");
  assert.equal(data.brand, "Bio Florais");
  assert.equal(data.number, "70000000");
  assert.equal(data.buyer.name, "Loja Flor de Lis Ltda");
  assert.equal(data.buyer.document, "CNPJ 11.222.333/0001-81");
  assert.equal(data.buyer.phone, "(11) 91234-5678");
  assert.deepEqual(data.addressLines, ["Av. Paulista, 1000", "Sala 12 · Bela Vista", "São Paulo/SP · CEP 01310-100"]);
  assert.equal(data.seller, "Vendedora Ana");
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].qty, 10);
  assert.equal(data.items[0].unitCents, 4000);
  assert.equal(data.items[0].totalCents, 40000);
  assert.equal(data.subtotalCents, 50000);
  assert.equal(data.shippingLabel, "PAC");
  assert.equal(data.shippingCents, 4500);
  assert.equal(data.totalCents, 54500);
  assert.equal(data.paymentLabel, "Boleto em 2x");
  assert.equal(data.note, "Entregar após as 14h");
  assert.equal(data.validUntilLabel, null);

  // outro cliente / inexistente / id inválido: nada
  assert.equal(await sheet.loadOrderSheet(run, ORDER, OTHER), null);
  assert.equal(await sheet.loadOrderSheet(run, "70000000-0000-4000-8000-0000000000ff", CLIENT), null);
  assert.equal(await sheet.loadOrderSheet(run, "x", CLIENT), null);
});

test("folha do orçamento: validade, desconto %, unidades grátis, display, valor por forma de pagamento e 'a definir'", async () => {
  const { pg, run } = await seed();
  await pg.exec(`UPDATE orders SET quote_expires_at = '2099-01-16T00:00:00Z' WHERE id = '${QUOTE}'`);

  const data = await sheet.loadOrderSheet(run, QUOTE, CLIENT);
  assert.equal(data.kind, "quote");
  assert.match(data.validUntilLabel, /^1[56]\/01\/2099$/);
  const sono = data.items.find((item) => item.qty === 10);
  assert.equal(sono.bonusQty, 2);
  assert.equal(sono.discountPercent, "10");
  assert.equal(sono.listUnitCents, 4400);
  assert.equal(sono.unitCents, 4000);
  assert.deepEqual(data.displays, ["1× Display Adulto (brinde)"]);
  assert.equal(data.paymentLabel, "A definir (escolhida ao fechar o pedido)");
  assert.deepEqual(data.paymentOptions.map((o) => o.label), ["Pix", "Cartão de crédito", "Boleto"]);
  const byLabel = Object.fromEntries(data.paymentOptions.map((o) => [o.label, o.totalCents]));
  assert.equal(byLabel.Boleto, 54500, "boleto = preço cheio (referência do orçamento)");
  assert.equal(byLabel["Cartão de crédito"], 53000, "cartão 3% sobre os produtos");
  assert.equal(byLabel.Pix, 51000, "Pix 7% sobre os produtos");
  assert.equal(data.totalCents, 54500);

  // vencido
  const expired = sheet.buildSheetFromRows({ order: { id: QUOTE, status: "quote", expires_at: "2000-01-01T00:00:00Z", subtotal_cents: 100, shipping_cents: 0, total_cents: 100 }, customer: null, address: null, items: [] });
  assert.match(expired.validUntilLabel, /\(vencido\)$/);
});

test("condição de pagamento e folha da revisão (antes de o pedido existir)", () => {
  assert.equal(sheet.paymentConditionLabel("pix"), "Pix");
  assert.equal(sheet.paymentConditionLabel("card", 1), "Cartão de crédito à vista");
  assert.equal(sheet.paymentConditionLabel("card", 3), "Cartão de crédito em 3x");
  assert.equal(sheet.paymentConditionLabel("boleto", 2), "Boleto em 2x");
  assert.match(sheet.paymentConditionLabel(null), /^A definir/);

  const review = sheet.buildReviewSheet({
    lines: [{ name: "Floral Sono", qty: 10, priceCents: 4400, discountPercent: null }, { name: "Shampoo X", qty: 5, priceCents: 2000 }],
    lineIds: ["p1", "p2"],
    discountLines: [{ productId: "p1", percent: 10, listUnitPriceCents: 4400, unitPriceCents: 3960 }],
    bonusByProduct: new Map([["p1", 2]]),
    displays: ["1× Display Adulto (brinde)"],
    buyer: { name: "Loja", document: "11222333000181", email: "a@x.com", phone: "11912345678" },
    address: { street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP", cep: "01310100" },
    couponCode: "BEMVINDO",
    subtotalCents: 53600,
    couponDiscountCents: 1000,
    shipping: { serviceName: "PAC", priceCents: 4500 },
    totalsByPaymentMethod: { pix: 52000, card: 57100, boleto: 57100 },
    paymentMethod: "pix",
    installments: 1,
    note: "  Ligar antes  ",
    now: new Date("2026-10-19T12:00:00Z"),
  });
  assert.equal(review.kind, "review");
  assert.equal(review.items[0].unitCents, 3960);
  assert.equal(review.items[0].discountPercent, "10");
  assert.equal(review.items[0].bonusQty, 2);
  assert.equal(review.items[1].totalCents, 10000);
  assert.equal(review.totalCents, 52000);
  assert.equal(review.paymentDiscountCents, 5100);
  assert.equal(review.paymentLabel, "Pix");
  assert.equal(review.note, "Ligar antes");
  assert.equal(review.couponLabel, "Cupom BEMVINDO");
  assert.equal(sheet.sheetTitle("quote"), "Orçamento");
  assert.equal(sheet.sheetTitle("review"), "Revisão do pedido");
});

test("ligações do orçamento: rota de criação (sem pagamento, status quote, sem cupom/atribuição, SQL 48b, fecha o anterior), checkout, Meus pedidos, painel do vendedor e admin", () => {
  const route = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(route.includes("const asQuote = body.asQuote === true"));
  assert.ok(route.includes('status: asQuote ? "quote" : "pending"'));
  assert.ok(route.includes("option.totalsByPaymentMethod.boleto"), "total de referência a preço cheio (boleto)");
  assert.ok(route.includes("if (!asQuote && quote.couponId && quote.couponCode)"), "cupom só é consumido no pedido real");
  assert.ok(route.includes("if (!launched && !asQuote)"), "atribuição de anúncio só no pedido real");
  assert.ok(route.includes("quoteColumnReady(getAppSqlRunner())") && route.includes("SQL_48B_MESSAGE"));
  assert.ok(route.includes("closeQuote(getAppSqlRunner(), String(body.quoteId), context.clientId, asQuote ? QUOTE_REPLACED : QUOTE_CONVERTED)"));
  assert.ok(route.includes("quote: {") && route.includes("validityDays"));

  const reopen = read("src/app/api/b2b/orders/quote/route.ts");
  assert.ok(reopen.includes("WHERE o.id = $1::uuid AND o.status = $2") && reopen.includes("authorizeOrderView"), "acesso pela autorização única (link pessoal, link geral ou sessão)");
  assert.ok(reopen.includes("computeB2BQuote"), "preços recalculados ao reabrir");

  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  for (const part of ["handleSaveQuote", "asQuote: true", 'data-testid="salvar-orcamento"', "<PrintOrderButton", "buildReviewSheet", "cart.load(", "quoteId", "orcamento-salvo", "imprimir-pedido-criado"]) {
    assert.ok(checkout.includes(part), part);
  }

  const mine = read("src/app/b2b/oferta/[token]/pedidos/page.tsx");
  assert.ok(mine.includes("listClientQuotes") && mine.includes("<QuoteActions") && mine.includes("imprimir-meu-pedido"), "orçamento com Continuar compra (Rodada 19b); pedido com Imprimir");
  assert.ok(mine.includes("!isQuoteStatus(order.status)"), "orçamento não aparece misturado aos pedidos");

  const print = read("src/app/b2b/oferta/[token]/pedidos/[orderId]/imprimir/page.tsx");
  assert.ok(print.includes("authorizeOrderView(run, { orderId, token, sessionCookie") && print.includes("loadOrderSheet(run, orderId, null)"), "acesso decidido por order-access.ts (Rodada 19b)");

  const vendor = read("src/app/b2b/painel/cliente/[clientId]/page.tsx");
  assert.ok(vendor.includes("listClientQuotes") && vendor.includes("QuoteReopenButton") && vendor.includes("Orçamentos pendentes"));
  assert.ok(read("src/components/b2b/QuoteReopenButton.tsx").includes("continueQuotePath(token, quoteId, true)"), "painel do vendedor continua a compra em modo lançar");

  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/page.tsx").includes("Orçamento (pendente)"));
  assert.ok(read("src/app/admin/(protected)/pedidos/page.tsx").includes("Orçamento (pendente)"));
  assert.ok(read("src/lib/b2b/cart-context.tsx").includes('case "LOAD"'));
});

test("impressão: folha A4 com marca, só a folha sai no papel; nunca mostra comissão nem custo real do frete", () => {
  const component = read("src/components/b2b/OrderSheet.tsx");
  for (const part of ["Condição de pagamento", "Observações", "Qtd.", "Preço un.", "Frete", "Total", "Desde 1997", "data.brand"]) assert.ok(component.includes(part), part);
  const code = (component + read("src/lib/b2b/order-sheet.ts")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/comiss|realPrice|shipping_cost|shippingCost|margem/i.test(code), "sem dado interno");
  const button = read("src/components/b2b/PrintOrderButton.tsx");
  assert.ok(button.includes("window.print()") && button.includes("@page { size: A4") && button.includes("body * { visibility: hidden"));
});
