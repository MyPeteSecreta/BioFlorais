/*
 * C1/C2 (Rodada 3): promoção criada pelo admin precisa ser SELECIONÁVEL pelo
 * vendedor. Fluxo coberto: admin define elegibilidades + comissão extra →
 * vendedor vê as opções → escolhe 2x → rascunho aceito → pedido congela a
 * comissão da promoção. Mais os SQL 16a/16b contra Postgres em memória.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ??= "postgresql://build:build@127.0.0.1:5432/build_placeholder";

const { parsePromotionBody } = await import("../src/lib/b2b/admin-promotions.ts");
const { defaultEligibilityRows, parseEligibilities } = await import("../src/lib/b2b/promotion-eligibility-defaults.ts");
const { eligibilityOptions, loadCommissionMatrix } = await import("../src/lib/b2b/commission.ts");
const { validateDraftInput } = await import("../src/lib/b2b/offer-draft-input.ts");
const { buildOrderItemSnapshots } = await import("../src/lib/b2b/order-commission.ts");

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PROMO_NEW = UUID(1);
const PROMO_OLD = UUID(2);
const LINE = UUID(10);
const PRODUCT = UUID(20);
const VENDOR = UUID(30);
const CLIENT = UUID(31);

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_promotions (
      id uuid PRIMARY KEY, name text, active boolean DEFAULT true, buy_quantity int, free_quantity int,
      promo_type text DEFAULT 'abertura_reconquista', seller_selectable boolean DEFAULT true);
    CREATE TABLE b2b_commission_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL, responsible_id uuid, client_id uuid,
      commercial_group_id uuid, product_id uuid, promotion_id uuid, eligibility_mode text, max_uses int,
      duration_days int, base_percent numeric, extra_percent numeric, active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    INSERT INTO b2b_commission_rules (scope, base_percent) VALUES ('responsible_base', 10);
    INSERT INTO b2b_commission_rules (scope, extra_percent) VALUES ('normal_price', 15);
  `);
});

after(async () => {
  await pg?.close();
});

test("admin: promoção ativa sem nenhuma elegibilidade é recusada; com elegibilidade é aceita", () => {
  const base = { name: "Black Friday", promoType: "recorrente", buyQuantity: 2, freeQuantity: 1, active: true };

  const empty = parsePromotionBody({ ...base, eligibilities: [] });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /Marque ao menos uma elegibilidade/);

  // Inativa pode ficar sem elegibilidade (rascunho do admin).
  assert.equal(parsePromotionBody({ ...base, active: false, eligibilities: [] }).ok, true);

  const ok = parsePromotionBody({ ...base, eligibilities: [{ mode: "uses", value: 2, extraPercent: 8 }] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value.eligibilities, [{ mode: "uses", value: 2, extraPercent: 8 }]);
});

test("admin: só opções permitidas (1x/2x/3x, 30/60/90/180) e extra entre 0 e 100", () => {
  assert.equal(parseEligibilities([{ mode: "uses", value: 4, extraPercent: 5 }]).ok, false);
  assert.equal(parseEligibilities([{ mode: "days", value: 45, extraPercent: 5 }]).ok, false);
  assert.equal(parseEligibilities([{ mode: "uses", value: 1, extraPercent: 120 }]).ok, false);
  assert.equal(parseEligibilities([{ mode: "uses", value: 1, extraPercent: 5 }, { mode: "uses", value: 1, extraPercent: 6 }]).ok, false);
  assert.equal(parseEligibilities([{ mode: "days", value: 180, extraPercent: 3 }]).ok, true);
});

test("valores padrão: 3 por 2 e 4 por 2 vêm marcados com a tabela fechada", () => {
  const three = defaultEligibilityRows(2, 1);
  assert.deepEqual(three.map((r) => [r.mode, r.value, r.extraPercent, r.enabled]), [
    ["uses", 1, 10, true], ["uses", 2, 8, true], ["uses", 3, 6, true],
    ["days", 30, 10, true], ["days", 60, 8, true], ["days", 90, 6, true], ["days", 180, 3, true],
  ]);
  const four = defaultEligibilityRows(2, 2);
  assert.deepEqual(four.map((r) => r.extraPercent), [6, 4, 2, 6, 4, 2, 1]);
  assert.equal(defaultEligibilityRows(5, 1).every((r) => !r.enabled), true); // outras combinações: o admin define
});

test("C1: promoção SEM regra não oferece 1x/2x (bug); com as regras do admin o vendedor seleciona 2x, o rascunho passa e o pedido congela 10+8", async () => {
  await run(`INSERT INTO b2b_promotions (id, name, buy_quantity, free_quantity, promo_type) VALUES ($1, 'Nova recorrente', 2, 1, 'recorrente')`, [PROMO_NEW]);

  // Antes: sem regra, nenhuma opção (era o que o Luis viu: card sem clique).
  let matrix = await loadCommissionMatrix(run, VENDOR, CLIENT);
  assert.equal(eligibilityOptions(matrix, PROMO_NEW).uses.length + eligibilityOptions(matrix, PROMO_NEW).days.length, 0);

  // O admin marca 1x/2x/3x e 30 dias: o MESMO que replacePromotionEligibilities grava (regras gerais).
  for (const [mode, uses, days, extra] of [["uses", 1, null, 10], ["uses", 2, null, 8], ["uses", 3, null, 6], ["days", null, 30, 10]]) {
    await run(
      `INSERT INTO b2b_commission_rules (scope, promotion_id, eligibility_mode, max_uses, duration_days, extra_percent)
       VALUES ('promotion_eligibility', $1, $2, $3, $4, $5)`,
      [PROMO_NEW, mode, uses, days, extra]
    );
  }

  matrix = await loadCommissionMatrix(run, VENDOR, CLIENT);
  const options = eligibilityOptions(matrix, PROMO_NEW);
  assert.deepEqual(options.uses.map((rule) => [rule.maxUses, rule.extraPercent]), [[1, 10], [2, 8], [3, 6]]);
  assert.deepEqual(options.days.map((rule) => [rule.durationDays, rule.extraPercent]), [[30, 10]]);

  // Vendedor escolhe 2x no rascunho: o servidor aceita.
  const lines = [{ id: LINE, name: "Adulto", promotions: [{ id: PROMO_NEW, available: true }] }];
  const draft = validateDraftInput(
    {
      commercialGroupIds: [LINE],
      promotions: [{ commercialGroupId: LINE, promotionId: PROMO_NEW, eligibilityMode: "uses", maxUses: 2 }],
    },
    lines,
    matrix
  );
  assert.equal(draft.ok, true);

  // Elegibilidade que o admin NÃO marcou (3 compras em dias: 90) é recusada.
  const notMarked = validateDraftInput(
    {
      commercialGroupIds: [LINE],
      promotions: [{ commercialGroupId: LINE, promotionId: PROMO_NEW, eligibilityMode: "days", durationDays: 90 }],
    },
    lines,
    matrix
  );
  assert.equal(notMarked.ok, false);

  // Pedido: o item bonificado congela base 10 + extra 8 = 18 (promotion).
  const [item] = buildOrderItemSnapshots({
    matrix,
    offerPromotions: [
      { promotionId: PROMO_NEW, name: "Nova recorrente", buyQuantity: 2, freeQuantity: 1, eligibilityMode: "uses", maxUses: 2, durationDays: null },
    ],
    lines: [{ productId: PRODUCT, qty: 2, unitPriceCents: 1990 }],
    bonusLines: [{ productId: PRODUCT, qty: 1, promotionId: PROMO_NEW }],
    window: { firstPaidAt: null, endsAt: null, open: true },
  });
  assert.deepEqual(
    [item.commissionBasis, item.commissionBasePercent, item.commissionExtraPercent, item.commissionTotalPercent],
    ["promotion", "10", "8", "18"]
  );
});

test("16a lista a promoção ativa sem regra; 16b cria as 7 regras padrão só para 3 por 2 / 4 por 2 e é idempotente", async () => {
  await run(`INSERT INTO b2b_promotions (id, name, buy_quantity, free_quantity) VALUES ($1, 'Antiga 4 por 2 sem regra', 2, 2)`, [PROMO_OLD]);
  await run(`INSERT INTO b2b_promotions (id, name, buy_quantity, free_quantity) VALUES ($1, 'Outra combinacao', 5, 1)`, [UUID(3)]);

  const [before16] = await run(sqlFile("16a_promocoes_sem_elegibilidade.sql"));
  const names = before16.promocoes_sem_elegibilidade.promocoes_ativas_sem_elegibilidade.map((p) => p.name).sort();
  assert.deepEqual(names, ["Antiga 4 por 2 sem regra", "Outra combinacao"]);

  await pg.exec(sqlFile("16b_elegibilidade_padrao_promocoes_sem_regra.sql"));
  await pg.exec(sqlFile("16b_elegibilidade_padrao_promocoes_sem_regra.sql")); // idempotente

  const rules = await run(
    `SELECT eligibility_mode, max_uses, duration_days, extra_percent FROM b2b_commission_rules
      WHERE promotion_id = $1 ORDER BY eligibility_mode DESC, max_uses, duration_days`, [PROMO_OLD]);
  assert.equal(rules.length, 7);
  assert.deepEqual(rules.map((r) => Number(r.extra_percent)), [6, 4, 2, 6, 4, 2, 1]); // tabela do 4 por 2

  const [{ total }] = await run(`SELECT count(*)::int AS total FROM b2b_commission_rules WHERE promotion_id = $1`, [UUID(3)]);
  assert.equal(total, 0); // combinação fora da tabela: não inventa percentual
});

// ---------------------------------------------------------------------------
// C3: promoção de DESCONTO PERCENTUAL
// ---------------------------------------------------------------------------
const { applyB2BPercentDiscount } = await import("../src/lib/b2b/promotion-engine.ts");
const { isB2BPromotionComplete } = await import("../src/lib/b2b/promotion-resolver.ts");
const { resolveB2BOrderTotalsByPaymentMethod } = await import("../src/lib/b2b/pricing.ts");
const { loadPromotionUses } = await import("../src/lib/b2b/purchase-history.ts");

test("C3: preço com X% de desconto (centavo), 0% e 100% não mexem; Pix/cartão incidem depois, sobre o preço já com a promoção", () => {
  assert.equal(applyB2BPercentDiscount(2990, 10), 2691); // 29,90 -> 26,91
  assert.equal(applyB2BPercentDiscount(1990, 15), 1692); // arredonda ao centavo (16,915 -> 16,92 em float; confere o inteiro)
  assert.equal(applyB2BPercentDiscount(1990, 0), 1990);
  assert.equal(applyB2BPercentDiscount(1990, 100), 1990);

  // Subtotal com a promoção -> total por forma de pagamento (Pix 7% / cartão 3% depois da promoção).
  const subtotalWithPromo = 10 * applyB2BPercentDiscount(3000, 10); // 10 un. a 30,00 com -10% = 270,00
  assert.equal(subtotalWithPromo, 27000);
  const totals = resolveB2BOrderTotalsByPaymentMethod(subtotalWithPromo, 0);
  assert.equal(totals.pix, Math.round(27000 * 0.93));
  assert.equal(totals.card, Math.round(27000 * 0.97));
  assert.equal(totals.boleto, 27000);
});

test("C3: promoção percentual só é válida com percentual entre 0 e 100; bonificação precisa de X e Y", () => {
  assert.equal(isB2BPromotionComplete({ type: "percentage_discount", buyQuantity: null, freeQuantity: null, percentage: "10" }), true);
  assert.equal(isB2BPromotionComplete({ type: "percentage_discount", buyQuantity: null, freeQuantity: null, percentage: null }), false);
  assert.equal(isB2BPromotionComplete({ type: "percentage_discount", buyQuantity: null, freeQuantity: null, percentage: "100" }), false);
  assert.equal(isB2BPromotionComplete({ type: "buy_x_get_y_auto_same_sku", buyQuantity: 2, freeQuantity: 1, percentage: null }), true);
  assert.equal(isB2BPromotionComplete({ type: "buy_x_get_y_auto_same_sku", buyQuantity: 2, freeQuantity: null, percentage: null }), false);
});

test("C3: admin cria promoção percentual (kind=percentage) e recusa percentual inválido", () => {
  const base = { name: "Black Friday 10%", promoType: "recorrente", active: true, eligibilities: [{ mode: "days", value: 30, extraPercent: 5 }] };
  const ok = parsePromotionBody({ ...base, kind: "percentage", percentage: 10 });
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.value.kind, ok.value.percentage], ["percentage", 10]);
  assert.equal(parsePromotionBody({ ...base, kind: "percentage", percentage: 0 }).ok, false);
  assert.equal(parsePromotionBody({ ...base, kind: "percentage", percentage: 100 }).ok, false);
  assert.equal(parsePromotionBody({ ...base, kind: "bonus", buyQuantity: 2, freeQuantity: 1 }).ok, true);
});

test("C3: snapshot do item com desconto % (preço efetivo, valor descontado, tipo e %), comissão da promoção", async () => {
  const PCT = UUID(50);
  await run(`INSERT INTO b2b_promotions (id, name, buy_quantity, free_quantity) VALUES ($1, 'Black Friday 10%', NULL, NULL)`, [PCT]);
  await run(`INSERT INTO b2b_commission_rules (scope, promotion_id, eligibility_mode, max_uses, extra_percent) VALUES ('promotion_eligibility', $1, 'uses', 2, 7)`, [PCT]);
  const matrixPct = await loadCommissionMatrix(run, VENDOR, CLIENT);

  const list = 3000;
  const effective = applyB2BPercentDiscount(list, 10);
  const [item, other] = buildOrderItemSnapshots({
    matrix: matrixPct,
    offerPromotions: [{ promotionId: PCT, name: "Black Friday 10%", buyQuantity: null, freeQuantity: null, eligibilityMode: "uses", maxUses: 2, durationDays: null }],
    lines: [
      { productId: PRODUCT, qty: 4, unitPriceCents: effective, listUnitPriceCents: list },
      { productId: UUID(21), qty: 1, unitPriceCents: 2000, listUnitPriceCents: 2000 },
    ],
    bonusLines: [],
    discountLines: [{ productId: PRODUCT, percent: 10, promotionId: PCT }],
    window: { firstPaidAt: null, endsAt: null, open: true },
  });

  assert.equal(item.unitPriceCents, 2700); // Omie lê o preço efetivo
  assert.deepEqual([item.promotionType, item.promotionPercent, item.promotionDiscountCents], ["percentage_discount", "10", (3000 - 2700) * 4]);
  assert.deepEqual([item.commissionBasis, item.commissionTotalPercent], ["promotion", "17"]); // 10 base + 7 extra
  assert.deepEqual([other.promotionType, other.promotionDiscountCents, other.commissionBasis], [null, null, "normal_price"]);
});

test("C3 + R5: pedido com desconto % (sem bonificação) conta como uso da promoção", async () => {
  const PCT = UUID(50);
  const OFFER = UUID(60);
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS orders (id uuid PRIMARY KEY, status text, payment_method text, b2b_client_id uuid, b2b_offer_id uuid, created_at timestamp DEFAULT now());
    CREATE TABLE IF NOT EXISTS order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int, bonus_qty int, promotion_id text);
    CREATE TABLE IF NOT EXISTS b2b_boleto_requests (order_id uuid PRIMARY KEY);
  `);
  await run(`INSERT INTO orders (id, status, payment_method, b2b_client_id, b2b_offer_id) VALUES ($1, 'paid', 'pix', $2, $3)`, [UUID(61), CLIENT, OFFER]);
  await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, bonus_qty, promotion_id) VALUES ($1, $2, 4, 2700, 0, $3)`, [UUID(61), PRODUCT, PCT]);

  assert.equal((await loadPromotionUses(run, OFFER)).get(PCT), 1);
});

test("17b é idempotente", async () => {
  await pg.exec(`CREATE TABLE IF NOT EXISTS order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid())`);
  await pg.exec(sqlFile("17b_promocao_percentual_snapshot.sql"));
  await pg.exec(sqlFile("17b_promocao_percentual_snapshot.sql"));
  const cols = await run(`SELECT column_name FROM information_schema.columns WHERE table_name='order_items' AND column_name LIKE 'promotion_%' ORDER BY 1`);
  assert.deepEqual(cols.map((c) => c.column_name), ["promotion_discount_cents", "promotion_id", "promotion_percent", "promotion_type"]);
});

// ---------------------------------------------------------------------------
// C4: alcance por linha
// ---------------------------------------------------------------------------
const { promotionScopeForGroup } = await import("../src/lib/b2b/promotion-scope.ts");
const { lineBadge } = await import("../src/lib/b2b/offer-notices.ts");

test("C4: promoção de SKU único só aparece na linha que tem o produto; 'somente X' lista só os produtos da linha", () => {
  const FILHOTES = UUID(70), ADULTOS = UUID(71), SNACK = UUID(72), OUTRO = UUID(73);
  const membership = new Map([[FILHOTES, new Set([SNACK])], [ADULTOS, new Set([OUTRO])]]);

  // Admin ligou a promoção às DUAS linhas, mas o produto só está em Filhotes: o bug era aparecer nas duas.
  const promo = { linkedGroupIds: [FILHOTES, ADULTOS], productIds: [SNACK] };
  assert.deepEqual(promotionScopeForGroup(promo, FILHOTES, membership), { applies: true, onlyProductIds: [SNACK] });
  assert.equal(promotionScopeForGroup(promo, ADULTOS, membership).applies, false);

  // Só produto, sem linha ligada: aparece na linha do produto (antes não aparecia em lugar nenhum).
  assert.equal(promotionScopeForGroup({ linkedGroupIds: [], productIds: [SNACK] }, FILHOTES, membership).applies, true);
  assert.equal(promotionScopeForGroup({ linkedGroupIds: [], productIds: [SNACK] }, ADULTOS, membership).applies, false);

  // Linha inteira ligada: só nas ligadas. Sem nada ligado: vale em qualquer linha.
  assert.equal(promotionScopeForGroup({ linkedGroupIds: [ADULTOS], productIds: [] }, FILHOTES, membership).applies, false);
  assert.equal(promotionScopeForGroup({ linkedGroupIds: [ADULTOS], productIds: [] }, ADULTOS, membership).applies, true);
  assert.equal(promotionScopeForGroup({ linkedGroupIds: [], productIds: [] }, FILHOTES, membership).applies, true);
});

test("C4: selo do card da linha só nasce na linha da promoção e nomeia só produtos dessa linha", () => {
  const A = UUID(71), F = UUID(70), SNACK = UUID(72);
  const notice = { promotionId: UUID(1), commercialGroupId: F, percent: null, buyQuantity: 2, freeQuantity: 1, productIds: [SNACK], usesRemaining: null, validUntil: null };

  assert.equal(lineBadge([notice], A, new Map()), null); // linha Adultos: sem aviso
  assert.match(lineBadge([notice], F, new Map([[SNACK, "Snack Floral Filhotes"]])), /promoção somente em Snack Floral Filhotes/);
});

test("ORDEM DE CÁLCULO única: promoção % → mínimo R$250 → cupom → Pix 7%/cartão 3% (só produtos) → frete", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/lib/b2b/quote.ts", import.meta.url), "utf8");
  const at = (needle) => {
    const i = src.indexOf(needle);
    assert.ok(i > 0, needle);
    return i;
  };
  // Na cotação autoritativa: promoção %, depois mínimo, depois cupom, depois totais por forma de pagamento (frete entra aqui).
  assert.ok(at("applyB2BPercentDiscount(line.listUnitPriceCents") < at("isB2BOrderAboveMinimum(subtotalCents)"));
  assert.ok(at("isB2BOrderAboveMinimum(subtotalCents)") < at("resolveB2BCouponDiscount("));
  assert.ok(at("resolveB2BCouponDiscount(") < at("resolveB2BOrderTotalsByPaymentMethod("));

  // Números: 10 un. a 30,00 com -10% = 270,00 (>= 250 mesmo que o preço cheio...); cupom depois; Pix só nos produtos.
  const withPromo = 10 * applyB2BPercentDiscount(3000, 10);
  assert.equal(withPromo, 27000);
  const afterCoupon = withPromo - 2700; // cupom de 10% sobre o total já com a promoção
  const totals = resolveB2BOrderTotalsByPaymentMethod(afterCoupon, 990); // frete 9,90 não leva desconto
  assert.equal(totals.pix, Math.round(afterCoupon * 0.93) + 990);
  assert.equal(totals.card, Math.round(afterCoupon * 0.97) + 990);
  assert.equal(totals.boleto, afterCoupon + 990);
});

test("PONTA A PONTA % : admin cria → vendedor seleciona → link (riscado e −X%) → sacola → pedido", async () => {
  const { effectiveUnitPriceCents: cartLineUnitCents } = await import("../src/lib/b2b/promotion-engine.ts");
  const { productPromotionRule, productPromotionText } = await import("../src/lib/b2b/offer-notices.ts");
  const PCT = UUID(80), LINE2 = UUID(81), PROD = UUID(82), VEND = UUID(83), CLI = UUID(84);

  // 1) Admin cria (tipo %, recorrente) com a tabela do 3 por 2 como padrão editável.
  const parsed = parsePromotionBody({
    name: "Black Friday 10%", promoType: "recorrente", kind: "percentage", percentage: 10, active: true,
    eligibilities: defaultEligibilityRows(2, 1).map((r) => ({ mode: r.mode, value: r.value, extraPercent: r.extraPercent })),
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.eligibilities.length, 7);
  await run(`INSERT INTO b2b_promotions (id, name, buy_quantity, free_quantity) VALUES ($1, 'Black Friday 10%', NULL, NULL)`, [PCT]);
  for (const e of parsed.value.eligibilities) {
    await run(
      `INSERT INTO b2b_commission_rules (scope, promotion_id, eligibility_mode, max_uses, duration_days, extra_percent) VALUES ('promotion_eligibility', $1, $2, $3, $4, $5)`,
      [PCT, e.mode, e.mode === "uses" ? e.value : null, e.mode === "days" ? e.value : null, e.extraPercent]
    );
  }

  // 2) Vendedor: vê as opções e escolhe "2 compras".
  const matrixE2E = await loadCommissionMatrix(run, VEND, CLI);
  assert.deepEqual(eligibilityOptions(matrixE2E, PCT).uses.map((r) => r.extraPercent), [10, 8, 6]);
  const lines = [{ id: LINE2, name: "Adulto", promotions: [{ id: PCT, available: true }] }];
  assert.equal(
    validateDraftInput({ commercialGroupIds: [LINE2], promotions: [{ commercialGroupId: LINE2, promotionId: PCT, eligibilityMode: "uses", maxUses: 2 }] }, lines, matrixE2E).ok,
    true
  );

  // 3) Link: selo e preço riscado/−X% vêm do aviso da oferta.
  const notice = { promotionId: PCT, commercialGroupId: LINE2, percent: 10, buyQuantity: 0, freeQuantity: 0, productIds: [], usesRemaining: 2, validUntil: null };
  assert.equal(lineBadge([notice], LINE2, new Map()), "10% OFF");
  assert.match(productPromotionText([notice], LINE2, PROD), /−10% neste produto/);
  const rule = productPromotionRule([notice], LINE2, PROD);
  assert.equal(rule.percent, 10);
  const listPrice = 3000;
  assert.equal(applyB2BPercentDiscount(listPrice, rule.percent), 2700); // preço efetivo exibido ao lado do riscado (30,00)

  // 4) Sacola: usa o preço com desconto no subtotal.
  assert.equal(cartLineUnitCents({ priceCents: listPrice, discountPercent: rule.percent }) * 10, 27000);

  // 5) Pedido: item com preço efetivo, desconto e comissão da promoção (10 base + 8 extra, 2 compras).
  const [item] = buildOrderItemSnapshots({
    matrix: matrixE2E,
    offerPromotions: [{ promotionId: PCT, name: "Black Friday 10%", buyQuantity: null, freeQuantity: null, eligibilityMode: "uses", maxUses: 2, durationDays: null }],
    lines: [{ productId: PROD, qty: 10, unitPriceCents: 2700, listUnitPriceCents: listPrice }],
    bonusLines: [],
    discountLines: [{ productId: PROD, percent: 10, promotionId: PCT }],
    window: { firstPaidAt: null, endsAt: null, open: true },
  });
  assert.deepEqual([item.unitPriceCents, item.promotionType, item.promotionDiscountCents, item.commissionTotalPercent], [2700, "percentage_discount", 3000, "18"]);
});
