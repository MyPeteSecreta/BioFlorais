/*
 * A escolha de uma promoção vale por (promoção, LINHA): a mesma promoção pode estar em várias linhas
 * da mesma oferta, cada uma com a sua elegibilidade, o seu limite de usos e a sua comissão.
 * Cenário: Adulto = B3 "2 compras", Pet = B1 "3 compras", Infantil = B1 "60 dias".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { validateDraftInput } = await import("../src/lib/b2b/offer-draft-input.ts");
const { matchPromotionLines } = await import("../src/lib/b2b/promotion-lines.ts");
const { buildOrderItemSnapshots } = await import("../src/lib/b2b/order-commission.ts");
const { gateKey, loadOfferPromotionGate } = await import("../src/lib/b2b/promotion-gate.ts");
const { loadPromotionUsesByLine } = await import("../src/lib/b2b/purchase-history.ts");

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const ADULTO = UUID(20);
const PET = UUID(21);
const INFANTIL = UUID(22);
const B3 = UUID(40); // 3 por 2 (compre 2, leve 1)
const B1 = UUID(41); // compre 5, leve 1
const P_ADULTO = UUID(30);
const P_PET = UUID(31);
const P_INFANTIL = UUID(32);
const OFFER = UUID(10);
const CLIENT = UUID(1);

const matrix = {
  configured: true,
  basePercent: 10,
  normalExtraPercent: 15,
  rules: [
    { promotionId: B3, eligibilityMode: "uses", maxUses: 2, durationDays: null, extraPercent: 8 },
    { promotionId: B1, eligibilityMode: "uses", maxUses: 3, durationDays: null, extraPercent: 6 },
    { promotionId: B1, eligibilityMode: "days", maxUses: null, durationDays: 60, extraPercent: 4 },
  ],
};
const builderLines = [
  { id: ADULTO, name: "Adulto", promotions: [{ id: B3, available: true }, { id: B1, available: true }] },
  { id: PET, name: "Pet", promotions: [{ id: B3, available: true }, { id: B1, available: true }] },
  { id: INFANTIL, name: "Infantil", promotions: [{ id: B3, available: true }, { id: B1, available: true }] },
];
const body = {
  commercialGroupIds: [ADULTO, PET, INFANTIL],
  promotions: [
    { commercialGroupId: ADULTO, promotionId: B3, eligibilityMode: "uses", maxUses: 2 },
    { commercialGroupId: PET, promotionId: B1, eligibilityMode: "uses", maxUses: 3 },
    { commercialGroupId: INFANTIL, promotionId: B1, eligibilityMode: "days", durationDays: 60 },
  ],
};

test("gravação: a mesma promoção em duas linhas, com elegibilidade diferente em cada, é aceita; duas condições na mesma linha não", () => {
  const parsed = validateDraftInput(body, builderLines, matrix);
  assert.equal(parsed.ok, true);
  assert.deepEqual(
    parsed.value.conditions.map((c) => [c.commercialGroupId, c.condition.promotionId, c.condition.eligibilityMode, c.condition.maxUses, c.condition.durationDays]),
    [[ADULTO, B3, "uses", 2, null], [PET, B1, "uses", 3, null], [INFANTIL, B1, "days", null, 60]]
  );

  const twice = validateDraftInput(
    { commercialGroupIds: [PET], promotions: [body.promotions[1], { commercialGroupId: PET, promotionId: B3, eligibilityMode: "uses", maxUses: 2 }] },
    builderLines,
    matrix
  );
  assert.equal(twice.ok, false);
  assert.match(twice.error, /uma condição por linha/);
});

const productsById = new Map([
  [P_ADULTO, { commercialGroupIds: [ADULTO] }],
  [P_PET, { commercialGroupIds: [PET] }],
  [P_INFANTIL, { commercialGroupIds: [INFANTIL] }],
]);
const row = (promotionId, commercialGroupId, buy, free) => ({ promotionId, commercialGroupId, type: "buy_x_get_y_auto_same_sku", buyQuantity: buy, freeQuantity: free, percentage: null });
const active = [row(B3, ADULTO, 2, 1), row(B1, PET, 5, 1), row(B1, INFANTIL, 5, 1)];
const cart = [{ productId: P_ADULTO, qty: 10 }, { productId: P_PET, qty: 10 }, { productId: P_INFANTIL, qty: 10 }];

test("sacola/servidor: cada linha recebe só a sua promoção; linha cuja escolha deixou de valer não herda a da outra", () => {
  const all = matchPromotionLines({ active, productsById, explicitRows: [], groupRows: [], cartItems: cart });
  assert.deepEqual(
    all.bonusLines.map((b) => [b.productId, b.promotionId, b.commercialGroupId, b.qty]),
    [[P_ADULTO, B3, ADULTO, 5], [P_PET, B1, PET, 2], [P_INFANTIL, B1, INFANTIL, 2]]
  );
  assert.deepEqual(all.promotionIdsUsed.sort(), [B1, B3].sort());

  // Infantil (B1 "60 dias") venceu / indisponível: Pet segue com a sua B1 e o Infantil NÃO ganha bônus.
  const infantilGone = matchPromotionLines({ active: active.slice(0, 2), productsById, explicitRows: [], groupRows: [], cartItems: cart });
  assert.deepEqual(infantilGone.bonusLines.map((b) => b.productId), [P_ADULTO, P_PET]);

  // B1 do Pet esgotada (3 compras): Infantil continua com a sua.
  const petGone = matchPromotionLines({ active: [active[0], active[2]], productsById, explicitRows: [], groupRows: [], cartItems: cart });
  assert.deepEqual(petGone.bonusLines.map((b) => b.productId), [P_ADULTO, P_INFANTIL]);

  // Lista explícita de produtos continua limitando dentro da linha.
  const explicit = matchPromotionLines({ active, productsById, explicitRows: [{ promotionId: B1, productId: P_PET }], groupRows: [], cartItems: cart });
  assert.deepEqual(explicit.bonusLines.map((b) => b.productId), [P_ADULTO, P_PET]);
});

test("desconto % também é por linha (e carrega a linha)", () => {
  const pct = (promotionId, group) => ({ promotionId, commercialGroupId: group, type: "percentage_discount", buyQuantity: null, freeQuantity: null, percentage: "10" });
  const result = matchPromotionLines({ active: [pct(B1, PET)], productsById, explicitRows: [], groupRows: [], cartItems: cart });
  assert.deepEqual(result.discountLines, [{ productId: P_PET, percent: 10, promotionId: B1, commercialGroupId: PET }]);
});

test("comissão no pedido: a elegibilidade e o extra são os da LINHA do item (mesma promoção B1, regras diferentes)", () => {
  const terms = [
    { promotionId: B3, commercialGroupId: ADULTO, name: "B3", buyQuantity: 2, freeQuantity: 1, eligibilityMode: "uses", maxUses: 2, durationDays: null },
    { promotionId: B1, commercialGroupId: PET, name: "B1", buyQuantity: 5, freeQuantity: 1, eligibilityMode: "uses", maxUses: 3, durationDays: null },
    { promotionId: B1, commercialGroupId: INFANTIL, name: "B1", buyQuantity: 5, freeQuantity: 1, eligibilityMode: "days", maxUses: null, durationDays: 60 },
  ];
  const bonus = matchPromotionLines({ active, productsById, explicitRows: [], groupRows: [], cartItems: cart }).bonusLines;
  const snapshots = buildOrderItemSnapshots({
    matrix,
    offerPromotions: terms,
    lines: cart.map((c) => ({ productId: c.productId, qty: c.qty, unitPriceCents: 2000 })),
    bonusLines: bonus,
    window: { firstPaidAt: null, endsAt: null, open: true },
  });
  const paid = (productId) => snapshots.find((s) => s.productId === productId && s.unitPriceCents > 0);
  const bonusRow = (productId) => snapshots.find((s) => s.productId === productId && s.unitPriceCents === 0);

  assert.deepEqual([paid(P_ADULTO).commissionExtraPercent, paid(P_ADULTO).promotionId], ["8", B3]);
  assert.deepEqual([paid(P_PET).commissionExtraPercent, paid(P_PET).commissionTotalPercent], ["6", "16"], "Pet: B1 por 3 compras");
  assert.deepEqual([paid(P_INFANTIL).commissionExtraPercent, paid(P_INFANTIL).commissionTotalPercent], ["4", "14"], "Infantil: B1 por 60 dias");
  assert.equal(bonusRow(P_PET).commissionExtraPercent, "6");
  assert.equal(bonusRow(P_INFANTIL).commissionExtraPercent, "4");
});

test("33b: a chave única passa a ser (oferta, promoção, linha); idempotente; nada é apagado", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_offer_promotions (offer_id uuid NOT NULL, promotion_id uuid NOT NULL, commercial_group_id uuid, eligibility_mode text,
    PRIMARY KEY (offer_id, promotion_id));
    INSERT INTO b2b_offer_promotions VALUES ('${OFFER}', '${B1}', '${PET}', 'uses');`);
  await assert.rejects(pg.query(`INSERT INTO b2b_offer_promotions VALUES ('${OFFER}', '${B1}', '${INFANTIL}', 'days')`), "antes do 33b a mesma promoção em duas linhas é recusada");

  const pre = read("sql/b2b/33a_promocao_por_linha_preflight_one_shot.sql");
  const info = (await pg.query(pre)).rows[0].preflight_promocao_por_linha;
  assert.equal(info.restricoes_atuais.length, 1);
  assert.equal(info.indice_novo_existe, false);

  const sql = read("sql/b2b/33b_promocao_por_linha.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DELETE|TRUNCATE|DROP TABLE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  await pg.exec(sql);

  await pg.query(`INSERT INTO b2b_offer_promotions VALUES ('${OFFER}', '${B1}', '${INFANTIL}', 'days')`);
  await assert.rejects(pg.query(`INSERT INTO b2b_offer_promotions VALUES ('${OFFER}', '${B1}', '${INFANTIL}', 'uses')`), "mesma promoção na MESMA linha continua proibida");
  assert.equal((await pg.query(`SELECT count(*)::int AS n FROM b2b_offer_promotions`)).rows[0].n, 2);
  const after = (await pg.query(pre)).rows[0].preflight_promocao_por_linha;
  assert.equal(after.restricoes_atuais.length, 0);
  assert.equal(after.indice_novo_existe, true);
  await pg.close();
});

test("contador de usos e porteiro por (promoção, LINHA): compra no Pet não gasta o limite do Infantil", async () => {
  const pg = new PGlite();
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  await pg.exec(`
    CREATE TABLE products (id uuid PRIMARY KEY, slug text);
    CREATE TABLE b2b_commercial_group_products (commercial_group_id uuid, product_id uuid);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int, bonus_qty int, promotion_id text);
    CREATE TABLE b2b_boleto_requests (order_id uuid PRIMARY KEY);
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL);
    CREATE TABLE b2b_promotions (id uuid PRIMARY KEY, promo_type text);
    CREATE TABLE b2b_promotion_commercial_groups (promotion_id uuid, commercial_group_id uuid);
    CREATE TABLE b2b_offer_promotions (offer_id uuid NOT NULL, promotion_id uuid NOT NULL, commercial_group_id uuid);
    INSERT INTO products VALUES ('${P_ADULTO}', 'a'), ('${P_PET}', 'p'), ('${P_INFANTIL}', 'i');
    INSERT INTO b2b_commercial_group_products VALUES ('${ADULTO}', '${P_ADULTO}'), ('${PET}', '${P_PET}'), ('${INFANTIL}', '${P_INFANTIL}');
    INSERT INTO b2b_promotions VALUES ('${B3}', 'recorrente'), ('${B1}', 'recorrente');
    INSERT INTO b2b_offer_promotions VALUES ('${OFFER}', '${B3}', '${ADULTO}'), ('${OFFER}', '${B1}', '${PET}'), ('${OFFER}', '${B1}', '${INFANTIL}');
    INSERT INTO orders (id, status, payment_method, b2b_client_id, b2b_offer_id, created_at) VALUES
      ('${UUID(100)}', 'paid', 'pix', '${CLIENT}', '${OFFER}', now()), ('${UUID(101)}', 'paid', 'pix', '${CLIENT}', '${OFFER}', now());
    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, bonus_qty, promotion_id) VALUES
      ('${UUID(100)}', '${P_PET}', 10, 2000, 2, '${B1}'), ('${UUID(100)}', '${P_PET}', 2, 0, 2, '${B1}'),
      ('${UUID(101)}', '${P_PET}', 10, 2000, 2, '${B1}');
  `);

  const uses = await loadPromotionUsesByLine(run, OFFER);
  assert.equal(uses.get(gateKey(B1, PET)), 2, "dois pedidos bonificados no Pet");
  assert.equal(uses.get(gateKey(B1, INFANTIL)) ?? 0, 0, "o Infantil não gastou nada");
  assert.equal(uses.get(gateKey(B3, ADULTO)) ?? 0, 0);

  const gate = await loadOfferPromotionGate(OFFER, CLIENT, new Date(), run);
  assert.equal(gate.get(gateKey(B1, PET)).used, 2);
  assert.equal(gate.get(gateKey(B1, INFANTIL)).used, 0);
  assert.equal(gate.get(gateKey(B3, ADULTO)).used, 0);
  assert.equal(gate.size, 3, "uma entrada por (promoção, linha)");
  await pg.close();
});

test("fios: ativação grava só a linha certa, resolvedor usa a parte pura, notices e pedido carregam a linha", () => {
  const activate = read("src/app/api/b2b/offers/[offerId]/activate/route.ts");
  assert.ok(activate.includes("eq(b2bOfferPromotions.commercialGroupId, line.id)"));
  assert.ok(read("src/lib/b2b/promotion-resolver.ts").includes("matchPromotionLines({ active, productsById, explicitRows, groupRows, cartItems })"));
  assert.ok(read("src/app/api/b2b/orders/create/route.ts").includes("commercialGroupId: b2bOfferPromotions.commercialGroupId"));
  assert.ok(!read("src/lib/db/schema.ts").match(/primaryKey\(\{ columns: \[t\.offerId, t\.promotionId\] \}\)/));
  assert.ok(read("src/app/api/b2b/offers/draft/route.ts").includes("SQL 33b"));
  assert.ok(!read("src/lib/b2b/offer-draft-input.ts").includes("duas linhas"));
});
