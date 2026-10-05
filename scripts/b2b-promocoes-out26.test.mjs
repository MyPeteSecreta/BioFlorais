/*
 * PROMOÇÕES REAIS de outubro/26 (Bio): o seed 29b aplicado num banco de teste gera EXATAMENTE a
 * tabela do Luis (B1..B11); só elas ficam ativas e selecionáveis; as demais são desativadas (nada
 * é apagado); cada mecânica calcula certo; B9 liga só os SKUs exatos; 29a trava quando falta linha.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ??= "postgresql://build:build@127.0.0.1:5432/build_placeholder";

const { eligibilityOptions, loadCommissionMatrix } = await import("../src/lib/b2b/commission.ts");
const { applyB2BPercentDiscount, calculateB2BPromotionBonusQty } = await import("../src/lib/b2b/promotion-engine.ts");
const { describeScope } = await import("../src/lib/b2b/product-label.ts");
const { lineBadge } = await import("../src/lib/b2b/offer-notices.ts");

const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

const LINE_NAMES = { adulto: "Adulto", pet: "Pet", infantil: "Infantil", baby: "Baby", kids: "Kids", teen: "Teen", "dose-unica": "Dose Única", "virtudes-divinas": "Virtudes Divinas", cosmeticos: "Cosméticos", "cosmeticos-pet": "Cosméticos Pet", "home-care": "Home Care" };
const LINES = ["adulto", "pet", "infantil", "baby", "kids", "teen", "dose-unica", "virtudes-divinas", "cosmeticos", "cosmeticos-pet", "home-care"];
const B9_SKUS = [
  ["cosmeticos-sabonete-liquido-alegria", "cosmeticos"], ["cosmeticos-sabonete-liquido-relaxante", "cosmeticos"],
  ["cosmeticos-pet-higiene-oral-spray-para-halito-menta", "cosmeticos-pet"],
  ["home-care-aromatizador-spray-harmonia", "home-care"], ["home-care-aromatizador-spray-serenidade", "home-care"],
];
const NOT_B9 = [["home-care-sabonete-liquido-alegria", "home-care"], ["cosmeticos-shampoo-uso-diario", "cosmeticos"], ["cosmeticos-pet-shampoo-agressividade", "cosmeticos-pet"]];

// A TABELA do Luis (Bio): código → [tipo, mecânica, buy, free, %, alcance, 1x,2x,3x,30,60,90,180] ("—" = null)
const F = "Adulto, Pet, Infantil, Baby";
const K = "Kids, Teen, Dose Única, Virtudes Divinas";
const C = "Cosméticos, Cosméticos Pet, Home Care";
const TABLE = {
  B1: ["abertura_reconquista", "bonus", 2, 1, null, F, [10, 8, 6, 10, 8, 6, 3]],
  B2: ["recorrente", "percentage", null, null, 10, F, [10, 8, 6, 10, 8, 6, 3]],
  B3: ["abertura_reconquista", "bonus", 2, 2, null, F, [6, 4, 2, 6, 4, 2, 1]],
  B4: ["recorrente", "percentage", null, null, 15, F, [7, 5, 3, 7, 5, 3, 1]],
  B5: ["abertura_reconquista", "bonus", 1, 2, null, K, [5, 3, null, 5, 3, 1, null]],
  B6: ["recorrente", "percentage", null, null, 15, K, [10, 8, 6, 10, 8, 6, 3]],
  B7: ["abertura_reconquista", "bonus", 1, 1, null, K, [7, 5, 3, 7, 5, 3, null]],
  B8: ["recorrente", "percentage", null, null, 20, K, [7, 5, 3, 7, 5, 3, 1]],
  B9: ["abertura_reconquista", "bonus", 3, 1, null, C, [7, 5, 3, 7, 5, 3, null]],
  B10: ["recorrente", "percentage", null, null, 8, C, [8, 6, 4, 8, 6, 4, 1]],
  B11: ["recorrente", "percentage", null, null, 10, C, [6, 4, 2, 6, 4, 2, 1]],
};
const SLOTS = ["1x", "2x", "3x", "30d", "60d", "90d", "180d"];

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, name text, active boolean DEFAULT true);
    CREATE TABLE b2b_commercial_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, name text, active boolean DEFAULT true,
      b2b_visible boolean DEFAULT true, sort_order int DEFAULT 0);
    CREATE TABLE b2b_commercial_group_products (commercial_group_id uuid, product_id uuid, PRIMARY KEY (commercial_group_id, product_id));
    CREATE TABLE b2b_promotions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, scope text NOT NULL, type text NOT NULL,
      commercial_purpose text NOT NULL DEFAULT 'general', eligibility_scope text NOT NULL DEFAULT 'none', buy_quantity int, free_quantity int,
      percentage numeric, seller_selectable boolean NOT NULL DEFAULT true, starts_at timestamp, ends_at timestamp, active boolean NOT NULL DEFAULT true,
      promo_type text NOT NULL DEFAULT 'abertura_reconquista', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE b2b_promotion_commercial_groups (promotion_id uuid, commercial_group_id uuid, PRIMARY KEY (promotion_id, commercial_group_id));
    CREATE TABLE b2b_promotion_products (promotion_id uuid, product_id uuid, PRIMARY KEY (promotion_id, product_id));
    CREATE TABLE b2b_offer_promotions (offer_id uuid, promotion_id uuid);
    CREATE TABLE b2b_commission_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL, responsible_id uuid, client_id uuid,
      commercial_group_id uuid, product_id uuid, promotion_id uuid, eligibility_mode text, max_uses int, duration_days int,
      base_percent numeric, extra_percent numeric, active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
  `);

  // Linhas com 1 produto cada + os SKUs da B9 (e SKUs que NÃO podem entrar na B9).
  for (const [index, slug] of LINES.entries()) {
    await run(`INSERT INTO b2b_commercial_groups (slug, name, sort_order) VALUES ($1, $2, $3)`, [slug, LINE_NAMES[slug], index]);
  }
  for (const [slug, line] of [...B9_SKUS, ...NOT_B9, ...LINES.map((l) => [`${l}-produto-base`, l])]) {
    const [{ id }] = await run(`INSERT INTO products (slug, name) VALUES ($1, $1) RETURNING id`, [slug]);
    await run(`INSERT INTO b2b_commercial_group_products SELECT g.id, $1 FROM b2b_commercial_groups g WHERE g.slug = $2`, [id, line]);
  }

  // Promoções ANTIGAS (seed de teste do 06b e uma criada pelo admin) + ofertas que as usam.
  await run(`INSERT INTO b2b_promotions (name, scope, type, buy_quantity, free_quantity) VALUES
      ('3 por 2 - Adulto', 'b2b', 'buy_x_get_y_auto_same_sku', 2, 1), ('4 por 2 - Baby Sono', 'b2b', 'buy_x_get_y_auto_same_sku', 2, 2),
      ('Black Friday criada no admin', 'b2b', 'percentage_discount', NULL, NULL)`);
  await run(`UPDATE b2b_promotions SET percentage = 12 WHERE name LIKE 'Black%'`);
  await run(`INSERT INTO b2b_offer_promotions SELECT gen_random_uuid(), id FROM b2b_promotions WHERE name = '3 por 2 - Adulto'`);
  await run(`INSERT INTO b2b_commission_rules (scope, base_percent) VALUES ('responsible_base', 10)`);
  await run(`INSERT INTO b2b_commission_rules (scope, extra_percent) VALUES ('normal_price', 15)`);
});

after(async () => {
  await pg?.close();
});

test("29a: preflight em uma linha JSON — linhas existem, B9 acha 5 SKUs em 3 grupos, lista o que será desativado", async () => {
  const [row] = await run(sqlFile("29a_promocoes_out26_preflight_one_shot.sql"));
  const pre = row.preflight_promocoes_out26;

  assert.equal(pre.pode_prosseguir, true);
  assert.equal(pre.linhas.length, 11);
  assert.equal(pre.b9_skus.length, 5); // 2 sabonetes + 1 spray + 2 aromatizadores (home-care-sabonete fica de fora)
  assert.deepEqual(Object.values(pre.b9_total_por_grupo).map(Number).sort(), [1, 2, 2]);
  assert.equal(pre.b9_skus.some((sku) => sku.slug.startsWith("home-care-sabonete")), false);
  assert.equal(pre.ofertas_com_promocao_a_desativar, 1);
  assert.deepEqual(pre.promocoes_atuais.filter((p) => p.sera_desativada).map((p) => p.name).sort(), ["3 por 2 - Adulto", "4 por 2 - Baby Sono", "Black Friday criada no admin"]);
});

test("29b: aplica a tabela EXATA (11 promoções), é idempotente e nada é apagado", async () => {
  const antes = (await run(`SELECT count(*)::int AS total FROM b2b_promotions`))[0].total;

  // O arquivo é uma transação: executa inteiro e lê a última consulta (conferência).
  const results = await pg.exec(sqlFile("29b_promocoes_out26.sql"));
  const lines = results.find((result) => result.fields?.some((field) => field.name === "codigo")).rows;

  assert.equal(lines.length, 11);
  assert.deepEqual(lines.map((row) => row.codigo), Object.keys(TABLE));

  for (const row of lines) {
    const [tipo, kind, buy, free, pct, alcance, extras] = TABLE[row.codigo];
    assert.equal(row.tipo, tipo, row.codigo);
    assert.equal(row.ativa, true);
    assert.equal(row.selecionavel, true);
    if (row.codigo !== "B9") assert.equal(row.alcance.split(", ").sort().join(", "), alcance.split(", ").sort().join(", "), `${row.codigo} alcance`);
    SLOTS.forEach((slot, index) => assert.equal(row[slot], extras[index] === null ? "—" : String(extras[index]), `${row.codigo} ${slot}`));

    const [promo] = await run(`SELECT type, buy_quantity, free_quantity, percentage FROM b2b_promotions WHERE name = $1`, [row.promocao]);
    assert.equal(promo.type, kind === "percentage" ? "percentage_discount" : "buy_x_get_y_auto_same_sku");
    assert.deepEqual([promo.buy_quantity, promo.free_quantity, promo.percentage === null ? null : Number(promo.percentage)], [buy, free, pct]);
  }

  // Idempotente: segunda execução não duplica nada.
  const snapshot = async () => ({
    promos: (await run(`SELECT count(*)::int AS total FROM b2b_promotions`))[0].total,
    rules: (await run(`SELECT count(*)::int AS total FROM b2b_commission_rules WHERE scope = 'promotion_eligibility'`))[0].total,
    groups: (await run(`SELECT count(*)::int AS total FROM b2b_promotion_commercial_groups`))[0].total,
    products: (await run(`SELECT count(*)::int AS total FROM b2b_promotion_products`))[0].total,
  });
  const first = await snapshot();
  await pg.exec(sqlFile("29b_promocoes_out26.sql"));
  assert.deepEqual(await snapshot(), first);

  // Nada apagado: as 3 promoções antigas + as 11 novas.
  assert.equal(first.promos, antes + 11);
});

test("só as 11 ficam ativas e selecionáveis; as antigas (inclusive a criada no admin) foram desativadas, sem DELETE, e a oferta antiga continua existindo", async () => {
  const visible = await run(`SELECT name FROM b2b_promotions WHERE active AND seller_selectable ORDER BY name`);
  assert.equal(visible.length, 11);
  assert.ok(visible.every((row) => /^(Compre|\d+%)/.test(row.name)));
  assert.ok(visible.every((row) => !/teste/i.test(row.name))); // sem a palavra "teste"

  const old = await run(`SELECT name, active, seller_selectable FROM b2b_promotions WHERE name IN ('3 por 2 - Adulto', '4 por 2 - Baby Sono', 'Black Friday criada no admin')`);
  assert.equal(old.length, 3); // não foram apagadas
  assert.ok(old.every((row) => row.active === false && row.seller_selectable === false));
  assert.equal((await run(`SELECT count(*)::int AS total FROM b2b_offer_promotions`))[0].total, 1); // oferta antiga intacta
});

test("B9: liga SÓ os SKUs exatos (sabonetes de Cosméticos, Spray Menta, aromatizadores); fora ficam sabonete de Home Care, shampoo etc.", async () => {
  const skus = await run(`SELECT p.slug FROM b2b_promotion_products x JOIN b2b_promotions pr ON pr.id = x.promotion_id JOIN products p ON p.id = x.product_id
                           WHERE pr.name LIKE 'Compre 3 ganhe mais 1%' ORDER BY p.slug`);
  assert.deepEqual(skus.map((row) => row.slug), B9_SKUS.map(([slug]) => slug).sort());

  // Só a B9 tem produtos explícitos (as demais valem pela linha inteira).
  assert.equal((await run(`SELECT count(DISTINCT promotion_id)::int AS total FROM b2b_promotion_products`))[0].total, 1);
});

test("elegibilidades: o vendedor vê exatamente as marcadas (desmarcadas não aparecem) e a comissão extra da tabela", async () => {

  const matrix = await loadCommissionMatrix(run, "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002");
  const promos = await run(`SELECT id, name FROM b2b_promotions WHERE active AND seller_selectable`);
  const byName = new Map(promos.map((row) => [row.name, row.id]));

  const b5 = eligibilityOptions(matrix, byName.get("Compre 3 pague 1 · Florais Kids, Teen, Dose Única e Virtudes"));
  assert.deepEqual(b5.uses.map((rule) => [rule.maxUses, rule.extraPercent]), [[1, 5], [2, 3]]); // 3x desmarcada
  assert.deepEqual(b5.days.map((rule) => [rule.durationDays, rule.extraPercent]), [[30, 5], [60, 3], [90, 1]]); // 180d desmarcada

  const b1 = eligibilityOptions(matrix, byName.get("Compre 3 pague 2 · Florais"));
  assert.deepEqual(b1.uses.map((rule) => rule.extraPercent), [10, 8, 6]);
  assert.deepEqual(b1.days.map((rule) => rule.extraPercent), [10, 8, 6, 3]);
});

test("cada mecânica calcula certo: bonificação (X pagas + Y grátis) e desconto percentual", () => {
  // Compre 3 pague 2 = a cada 2 pagas, +1 grátis
  assert.equal(calculateB2BPromotionBonusQty(2, 2, 1), 1);
  assert.equal(calculateB2BPromotionBonusQty(4, 2, 1), 2);
  assert.equal(calculateB2BPromotionBonusQty(3, 2, 1), 1);
  // Compre 4 pague 2 = a cada 2 pagas, +2 grátis
  assert.equal(calculateB2BPromotionBonusQty(2, 2, 2), 2);
  assert.equal(calculateB2BPromotionBonusQty(5, 2, 2), 4);
  // Compre 3 pague 1 = a cada 1 paga, +2 grátis
  assert.equal(calculateB2BPromotionBonusQty(1, 1, 2), 2);
  assert.equal(calculateB2BPromotionBonusQty(3, 1, 2), 6);
  // Compre 1 ganhe mais 1 = a cada 1 paga, +1 grátis
  assert.equal(calculateB2BPromotionBonusQty(1, 1, 1), 1);
  assert.equal(calculateB2BPromotionBonusQty(4, 1, 1), 4);
  // Compre 3 ganhe mais 1 = a cada 3 pagas, +1 grátis
  assert.equal(calculateB2BPromotionBonusQty(2, 3, 1), 0);
  assert.equal(calculateB2BPromotionBonusQty(3, 3, 1), 1);
  assert.equal(calculateB2BPromotionBonusQty(7, 3, 1), 2);
  // Percentuais da tabela: 8%, 10%, 15%, 20% sobre R$ 30,00
  for (const [pct, expected] of [[8, 2760], [10, 2700], [15, 2550], [20, 2400]]) assert.equal(applyB2BPercentDiscount(3000, pct), expected);
});

test("B9: aviso único por linha, sem listar item por item", () => {
  const sab = [
    { slug: "cosmeticos-sabonete-liquido-alegria", name: "Alegria" },
    { slug: "cosmeticos-sabonete-liquido-relaxante", name: "Relaxante" },
    { slug: "cosmeticos-sabonete-liquido-energizante", name: "Energizante" },
    { slug: "cosmeticos-sabonete-liquido-hidratante", name: "Hidratante" },
  ];
  assert.equal(describeScope(sab), "os sabonetes líquidos");
  assert.equal(describeScope([{ slug: "cosmeticos-pet-higiene-oral-spray-para-halito-menta", name: "Spray para Hálito - Menta" }]), "o Spray para Hálito – Menta");
  assert.equal(
    describeScope([{ slug: "home-care-aromatizador-spray-harmonia", name: "Harmonia" }, { slug: "home-care-aromatizador-spray-serenidade", name: "Serenidade" }, { slug: "home-care-aromatizador-spray-bem-estar", name: "Bem Estar" }, { slug: "home-care-aromatizador-spray-limpeza-e-protecao", name: "Limpeza" }]),
    "os aromatizadores de ambiente"
  );

  const notice = { promotionId: "p", commercialGroupId: "g", percent: null, buyQuantity: 3, freeQuantity: 1, productIds: ["a", "b"], usesRemaining: null, validUntil: null };
  assert.equal(lineBadge([notice], "g", "os sabonetes líquidos"), "4 por 3 · Oferta válida para os sabonetes líquidos");
  assert.equal(lineBadge([{ ...notice, productIds: [] }], "g", null), "4 por 3"); // linha inteira: sem aviso de alcance
});

test("29a e 29b PARAM quando uma linha do alcance não tem grupo/produto (nada é alterado)", async () => {
  await run(`UPDATE b2b_commercial_groups SET active = false WHERE slug = 'teen'`);

  const [row] = await run(sqlFile("29a_promocoes_out26_preflight_one_shot.sql"));
  assert.equal(row.preflight_promocoes_out26.pode_prosseguir, false);

  const before = (await run(`SELECT count(*)::int AS total FROM b2b_promotions WHERE active`))[0].total;
  await assert.rejects(pg.exec(sqlFile("29b_promocoes_out26.sql")), /abortadas/);
  await pg.exec("ROLLBACK"); // no Neon a transação inteira é desfeita; aqui encerramos a aberta pelo BEGIN
  assert.equal((await run(`SELECT count(*)::int AS total FROM b2b_promotions WHERE active`))[0].total, before); // transação desfeita

  await run(`UPDATE b2b_commercial_groups SET active = true WHERE slug = 'teen'`);
});
