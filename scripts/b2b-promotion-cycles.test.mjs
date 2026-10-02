/*
 * RODADA 2 (02/10/2026): tipos de promoção (abertura/reconquista x
 * recorrente), ciclo por linha, definição única de "compra" e contador de
 * usos dinâmico. Roda as MESMAS consultas da aplicação
 * (src/lib/b2b/purchase-history.ts) num Postgres real em memória (PGlite).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import {
  buildHistory,
  commissionWindowForItem,
  historyForGroup,
  loadClientPurchases,
  loadPromotionUses,
  loadReconquistaMonths,
  promotionAvailability,
} from "../src/lib/b2b/purchase-history.ts";

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = UUID(1);
const VENDOR_A = UUID(2);
const VENDOR_B = UUID(3);
const OFFER_A = UUID(10);
const OFFER_B = UUID(11);
const ADULTO = UUID(20);
const PET = UUID(21);
const P_ADULTO = UUID(30);
const P_PET = UUID(31);
const PROMO = UUID(40);

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const MONTHS = 6;
const DAY = 24 * 60 * 60 * 1000;

let seq = 100;
/** Pedido B2B do cliente: `ago` = quanto tempo atrás foi criado. */
async function order({ offer = OFFER_A, status = "paid", method = "pix", ago = "1 day", product = P_ADULTO, price = 2000, bonus = 0, promo = null, boleto = false }) {
  const id = UUID(++seq);
  await run(
    `INSERT INTO orders (id, status, payment_method, b2b_client_id, b2b_offer_id, created_at)
     VALUES ($1, $2, $3, $4, $5, (now() AT TIME ZONE 'UTC') - $6::interval)`,
    [id, status, method, CLIENT, offer, ago]
  );
  await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, bonus_qty, promotion_id) VALUES ($1,$2,3,$3,$4,$5)`,
    [id, product, price, bonus, promo]);
  if (bonus > 0) {
    await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, bonus_qty, promotion_id) VALUES ($1,$2,$3,0,$3,$4)`,
      [id, product, bonus, promo]);
  }
  if (boleto) await run(`INSERT INTO b2b_boleto_requests (order_id) VALUES ($1)`, [id]);
  return id;
}

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE products (id uuid PRIMARY KEY, slug text);
    CREATE TABLE b2b_commercial_group_products (commercial_group_id uuid, product_id uuid);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, b2b_client_id uuid, b2b_offer_id uuid,
                         created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int,
                              unit_price_cents int, bonus_qty int, promotion_id text);
    CREATE TABLE b2b_boleto_requests (order_id uuid PRIMARY KEY);
    INSERT INTO products VALUES ('${P_ADULTO}', 'adulto-1'), ('${P_PET}', 'pet-1');
    INSERT INTO b2b_commercial_group_products VALUES ('${ADULTO}', '${P_ADULTO}'), ('${PET}', '${P_PET}');
  `);
});

after(async () => {
  await pg?.close();
});

async function reset() {
  await pg.exec(`DELETE FROM b2b_boleto_requests; DELETE FROM order_items; DELETE FROM orders;`);
}

const now = () => new Date();

test("cliente novo: promoção de abertura disponível; recorrente também", async () => {
  await reset();
  const purchases = await loadClientPurchases(run, CLIENT);
  const history = historyForGroup(purchases, ADULTO, now(), MONTHS);

  assert.equal(purchases.length, 0);
  assert.equal(promotionAvailability("abertura_reconquista", history).available, true);
  assert.match(promotionAvailability("abertura_reconquista", history).reason, /nunca comprou esta linha/);
  assert.equal(promotionAvailability("recorrente", history).available, true);
});

test("cliente na fase de preço normal: abertura bloqueada (com a data de volta), recorrente liberada", async () => {
  await reset();
  await order({ status: "paid", ago: "60 days" });

  const purchases = await loadClientPurchases(run, CLIENT);
  const history = historyForGroup(purchases, ADULTO, now(), MONTHS);
  const opening = promotionAvailability("abertura_reconquista", history);

  assert.equal(opening.available, false);
  assert.match(opening.reason, /Indisponível: cliente comprou esta linha em \d\d\/\d\d\/\d{4}; abertura volta a valer em \d\d\/\d\d\/\d{4}/);
  assert.equal(promotionAvailability("recorrente", history).available, true);

  // Outra linha (Pet) continua virgem para este cliente.
  assert.equal(promotionAvailability("abertura_reconquista", historyForGroup(purchases, PET, now(), MONTHS)).available, true);
});

test("sem compra na linha há 7 meses: reconquista libera a abertura e a janela de 180 dias recomeça", async () => {
  await reset();
  await order({ status: "paid", ago: "210 days" }); // ~7 meses

  const purchases = await loadClientPurchases(run, CLIENT);
  const history = historyForGroup(purchases, ADULTO, now(), MONTHS);
  const opening = promotionAvailability("abertura_reconquista", history);

  assert.equal(opening.available, true);
  assert.match(opening.reason, /sem compras nesta linha desde .* \(reconquista\)/);

  const window = commissionWindowForItem(purchases, [ADULTO], now(), MONTHS);
  assert.equal(window.open, true);
  assert.equal(window.endsAt, null); // ciclo novo só começa no próximo pedido
});

test("ciclos: compra depois de mais de 6 meses abre ciclo novo; antes disso o ciclo continua", () => {
  const at = (iso) => new Date(`${iso}T12:00:00Z`);
  const today = at("2027-06-01");

  // jan, mar (continua), out (lacuna > 6 meses = novo ciclo em out)
  const history = buildHistory([at("2026-01-10"), at("2026-03-10"), at("2026-10-20")], today, 6);
  assert.equal(history.cycleStart.toISOString().slice(0, 10), "2026-10-20");

  const same = buildHistory([at("2026-01-10"), at("2026-03-10"), at("2026-08-20")], today, 6);
  assert.equal(same.cycleStart.toISOString().slice(0, 10), "2026-01-10");
});

test("janela de 180 dias é por LINHA; parametrizável para MARCA", async () => {
  await reset();
  await order({ status: "paid", ago: "100 days", product: P_ADULTO });
  const purchases = await loadClientPurchases(run, CLIENT);

  const adulto = commissionWindowForItem(purchases, [ADULTO], now(), MONTHS, "line");
  const pet = commissionWindowForItem(purchases, [PET], now(), MONTHS, "line");
  const marca = commissionWindowForItem(purchases, [PET], now(), MONTHS, "brand");

  assert.ok(adulto.endsAt, "linha comprada tem janela em curso");
  assert.equal(pet.endsAt, null, "linha nunca comprada: janela ainda não começou");
  assert.ok(marca.endsAt, "por marca, a compra de Adulto abre a janela também para Pet");
  assert.equal(Math.round((adulto.endsAt - adulto.firstPaidAt) / DAY), 180);
});

test("troca de vendedor: nada reinicia (histórico é do cliente, não do vendedor)", async () => {
  await reset();
  await order({ offer: OFFER_A, status: "paid", ago: "40 days" }); // oferta do vendedor A

  // Oferta nova do vendedor B para o mesmo cliente: mesma história.
  const purchases = await loadClientPurchases(run, CLIENT, OFFER_B);
  const history = historyForGroup(purchases, ADULTO, now(), MONTHS);

  assert.equal(promotionAvailability("abertura_reconquista", history).available, false); // continua bloqueada
  assert.ok(commissionWindowForItem(purchases, [ADULTO], now(), MONTHS).endsAt, "janela segue a do cliente");
});

test("a compra feita pela própria oferta não invalida a promoção de abertura dessa oferta", async () => {
  await reset();
  await order({ offer: OFFER_A, status: "paid", ago: "3 days" });

  const own = await loadClientPurchases(run, CLIENT, OFFER_A);
  assert.equal(own.length, 0);
  assert.equal(promotionAvailability("abertura_reconquista", historyForGroup(own, ADULTO, now(), MONTHS)).available, true);
});

test("R4: boleto GERADO e não pago conta; boleto sem solicitação, cancelado, Pix expirado e Pix pendente não contam", async () => {
  await reset();
  await order({ status: "pending", method: "boleto", boleto: true, ago: "2 days", product: P_ADULTO }); // conta
  await order({ status: "pending", method: "boleto", boleto: false, ago: "2 days", product: P_PET }); // sem solicitação
  await order({ status: "cancelled", method: "boleto", boleto: true, ago: "2 days", product: P_PET }); // cancelado
  await order({ status: "expired", method: "pix", ago: "5 days", product: P_PET });
  await order({ status: "pending", method: "pix", ago: "3 hours", product: P_PET });
  await order({ status: "pending", method: "card", ago: "10 minutes", product: P_PET });

  const purchases = await loadClientPurchases(run, CLIENT);

  assert.deepEqual(purchases.map((purchase) => purchase.groupId), [ADULTO]);
});

test("R5: contador dinâmico: pago e boleto gerado contam; Pix pendente < 60 min reserva; expirado/antigo libera", async () => {
  await reset();
  await order({ status: "paid", bonus: 1, promo: PROMO, ago: "20 days" }); // pago
  await order({ status: "pending", method: "boleto", boleto: true, bonus: 1, promo: PROMO, ago: "3 days" }); // boleto gerado
  await order({ status: "pending", method: "pix", bonus: 1, promo: PROMO, ago: "20 minutes" }); // reserva
  await order({ status: "pending", method: "pix", bonus: 1, promo: PROMO, ago: "2 hours" }); // abandonado: libera
  await order({ status: "expired", method: "pix", bonus: 1, promo: PROMO, ago: "1 day" }); // expirado: libera
  await order({ status: "paid", bonus: 0, promo: null, ago: "1 day" }); // sem bonificação: não conta

  const uses = await loadPromotionUses(run, OFFER_A);

  assert.equal(uses.get(PROMO), 3); // pago + boleto + reserva (cada pedido conta UMA vez, mesmo com 2 linhas de item)
});

test("R5: dois pedidos pendentes simultâneos não usam o último uso duas vezes", async () => {
  await reset();
  const MAX_USES = 1;

  const usedBefore = (await loadPromotionUses(run, OFFER_A)).get(PROMO) ?? 0;
  assert.ok(usedBefore < MAX_USES, "1º pedido ainda pode usar");

  await order({ status: "pending", method: "pix", bonus: 1, promo: PROMO, ago: "1 minute" }); // 1º pedido, ainda pendente

  const usedAfter = (await loadPromotionUses(run, OFFER_A)).get(PROMO) ?? 0;
  assert.ok(usedAfter >= MAX_USES, "2º pedido já enxerga o uso reservado e fica sem a promoção");
});

test("reconquista_meses: padrão 6 sem tabela; lê b2b_settings quando existe", async () => {
  assert.equal(await loadReconquistaMonths(run), 6); // tabela ausente (SQL 14b não aplicado)

  await pg.exec(`CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL);
                 INSERT INTO b2b_settings VALUES ('reconquista_meses', '9');`);
  assert.equal(await loadReconquistaMonths(run), 9);

  await pg.exec(`UPDATE b2b_settings SET value = 'abc'`);
  assert.equal(await loadReconquistaMonths(run), 6);
});

import { validateDraftInput } from "../src/lib/b2b/offer-draft-input.ts";
import { buildOrderItemSnapshots } from "../src/lib/b2b/order-commission.ts";

const matrix = {
  configured: true,
  basePercent: 10,
  normalExtraPercent: 15,
  rules: [{ promotionId: PROMO, eligibilityMode: "uses", maxUses: 2, durationDays: null, extraPercent: 8 }],
};

test("servidor rejeita promoção indisponível mesmo se a tela mandar; aceita disponível e recorrente", () => {
  const lines = (available, reason = "") => [
    { id: ADULTO, name: "Adulto", promotions: [{ id: PROMO, available, reason }] },
  ];
  const body = {
    commercialGroupIds: [ADULTO],
    promotions: [{ commercialGroupId: ADULTO, promotionId: PROMO, eligibilityMode: "uses", maxUses: 2 }],
  };

  const blocked = validateDraftInput(
    body,
    lines(false, "Indisponível: cliente comprou esta linha em 01/09/2026; abertura volta a valer em 01/03/2027"),
    matrix
  );
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Indisponível: cliente comprou esta linha/);

  assert.equal(validateDraftInput(body, lines(true), matrix).ok, true);
});

test("comissão por item usa a janela da LINHA do produto (linha nova = 25; linha com ciclo vencido = 10)", () => {
  const first = new Date("2026-01-01T12:00:00Z");
  const open = { firstPaidAt: new Date(), endsAt: new Date(Date.now() + 10 * DAY), open: true };
  const closed = { firstPaidAt: first, endsAt: new Date(first.getTime() + 180 * DAY), open: false };

  const items = buildOrderItemSnapshots({
    matrix,
    offerPromotions: [],
    lines: [
      { productId: P_ADULTO, qty: 1, unitPriceCents: 2000 },
      { productId: P_PET, qty: 1, unitPriceCents: 2000 },
    ],
    bonusLines: [],
    window: (productId) => (productId === P_ADULTO ? closed : open),
  });

  assert.deepEqual(items.map((item) => [item.commissionBasis, item.commissionTotalPercent]), [
    ["base_only", "10"],
    ["normal_price", "25"],
  ]);
});
