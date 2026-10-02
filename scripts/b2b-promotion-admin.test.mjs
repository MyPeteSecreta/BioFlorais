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
