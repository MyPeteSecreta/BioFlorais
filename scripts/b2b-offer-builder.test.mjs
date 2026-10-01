/*
 * Offer Builder: validação do rascunho, comissão "base + extra = total",
 * snapshot de comissão no pedido e varredura de isolamento das rotas.
 * Rodar: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  commissionFor,
  eligibilityOptions,
  formatPercent,
  promotionShortLabel,
} from "../src/lib/b2b/commission.ts";
import { validateDraftInput } from "../src/lib/b2b/offer-draft-input.ts";
import { buildOrderItemSnapshots } from "../src/lib/b2b/order-commission.ts";

const P3 = "11111111-1111-4111-8111-111111111111";
const P4 = "22222222-2222-4222-8222-222222222222";
const ADULTO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BABY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SONO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COLICA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const matrix = {
  configured: true,
  basePercent: 10,
  normalExtraPercent: 15,
  rules: [
    { promotionId: P3, eligibilityMode: "uses", maxUses: 1, durationDays: null, extraPercent: 10 },
    { promotionId: P3, eligibilityMode: "uses", maxUses: 2, durationDays: null, extraPercent: 8 },
    { promotionId: P3, eligibilityMode: "uses", maxUses: 3, durationDays: null, extraPercent: 6 },
    { promotionId: P3, eligibilityMode: "days", maxUses: null, durationDays: 30, extraPercent: 10 },
    { promotionId: P3, eligibilityMode: "days", maxUses: null, durationDays: 180, extraPercent: 3 },
    { promotionId: P4, eligibilityMode: "uses", maxUses: 1, durationDays: null, extraPercent: 6 },
  ],
};

const lines = [
  { id: ADULTO, name: "Adulto", promotions: [{ id: P3 }] },
  { id: BABY, name: "Baby", promotions: [{ id: P4 }] },
];

test("comissão: base + extra = total (normal e promoção); sem regra = null", () => {
  assert.deepEqual(commissionFor(matrix, { kind: "normal" }), {
    basePercent: 10, extraPercent: 15, totalPercent: 25,
  });
  assert.deepEqual(
    commissionFor(matrix, { kind: "promotion", promotionId: P3, eligibilityMode: "days", maxUses: null, durationDays: 180 }),
    { basePercent: 10, extraPercent: 3, totalPercent: 13 }
  );
  assert.equal(
    commissionFor(matrix, { kind: "promotion", promotionId: P3, eligibilityMode: "days", maxUses: null, durationDays: 45 }),
    null
  );
  assert.equal(formatPercent(12.5), "12,5%");
});

test("elegibilidades vêm só da matriz (sem campo livre, sem compras + prazo)", () => {
  const options = eligibilityOptions(matrix, P3);
  assert.deepEqual(options.uses.map((rule) => rule.maxUses), [1, 2, 3]);
  assert.deepEqual(options.days.map((rule) => rule.durationDays), [30, 180]);
  assert.deepEqual(eligibilityOptions(matrix, P4).days, []);
});

test("rótulos 3 por 2 e 4 por 2", () => {
  assert.equal(promotionShortLabel(2, 1), "3 por 2");
  assert.equal(promotionShortLabel(2, 2), "4 por 2");
});

test("rascunho válido: linha normal + linha com promoção e elegibilidade configurada", () => {
  const parsed = validateDraftInput(
    {
      commercialGroupIds: [ADULTO, BABY, ADULTO],
      promotions: [{ commercialGroupId: BABY, promotionId: P4, eligibilityMode: "uses", maxUses: 1 }],
    },
    lines,
    matrix
  );

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value.commercialGroupIds, [ADULTO, BABY]);
  assert.deepEqual(parsed.value.conditions, [
    {
      commercialGroupId: BABY,
      condition: { kind: "promotion", promotionId: P4, eligibilityMode: "uses", maxUses: 1, durationDays: null },
    },
  ]);
});

test("rascunho recusado: sem linha, promoção de outra linha, elegibilidade não configurada", () => {
  assert.equal(validateDraftInput({ commercialGroupIds: [] }, lines, matrix).ok, false);
  assert.equal(validateDraftInput({ commercialGroupIds: ["x"] }, lines, matrix).ok, false);

  const otherLine = validateDraftInput(
    { commercialGroupIds: [ADULTO], promotions: [{ commercialGroupId: ADULTO, promotionId: P4, eligibilityMode: "uses", maxUses: 1 }] },
    lines,
    matrix
  );
  assert.equal(otherLine.ok, false);

  const notConfigured = validateDraftInput(
    { commercialGroupIds: [ADULTO], promotions: [{ commercialGroupId: ADULTO, promotionId: P3, eligibilityMode: "uses", maxUses: 7 }] },
    lines,
    matrix
  );
  assert.equal(notConfigured.ok, false);
  assert.match(notConfigured.error, /Elegibilidade não configurada/);

  const lineNotSelected = validateDraftInput(
    { commercialGroupIds: [BABY], promotions: [{ commercialGroupId: ADULTO, promotionId: P3, eligibilityMode: "uses", maxUses: 1 }] },
    lines,
    matrix
  );
  assert.equal(lineNotSelected.ok, false);
});

test("pedido: comissão congelada por item (promoção que bonificou x preço normal)", () => {
  const snapshots = buildOrderItemSnapshots({
    matrix,
    offerPromotions: [
      { promotionId: P3, name: "3 por 2 - Baby Sono", buyQuantity: 2, freeQuantity: 1, eligibilityMode: "days", maxUses: null, durationDays: 30 },
    ],
    lines: [
      { productId: SONO, qty: 4, unitPriceCents: 1990 },
      { productId: COLICA, qty: 3, unitPriceCents: 1990 },
    ],
    bonusLines: [{ productId: SONO, qty: 2, promotionId: P3 }],
  });

  assert.equal(snapshots.length, 3);

  const [sonoPaid, sonoBonus, colica] = snapshots;

  assert.deepEqual(
    [sonoPaid.qty, sonoPaid.unitPriceCents, sonoPaid.paidQty, sonoPaid.bonusQty, sonoPaid.physicalQty],
    [4, 1990, 4, 2, 6]
  );
  assert.deepEqual(
    [sonoPaid.commissionBasePercent, sonoPaid.commissionExtraPercent, sonoPaid.commissionTotalPercent],
    ["10", "10", "20"]
  );
  assert.equal(sonoPaid.promotionName, "3 por 2 - Baby Sono");

  assert.deepEqual([sonoBonus.qty, sonoBonus.unitPriceCents], [2, 0]);
  assert.equal(sonoBonus.commissionTotalPercent, "20");

  assert.equal(colica.promotionId, null);
  assert.deepEqual(
    [colica.commissionBasePercent, colica.commissionExtraPercent, colica.commissionTotalPercent],
    ["10", "15", "25"]
  );
});

test("pedido sem matriz configurada: snapshot sem comissão (nunca inventa percentual)", () => {
  const [item] = buildOrderItemSnapshots({
    matrix: { configured: false, basePercent: 0, normalExtraPercent: 0, rules: [] },
    offerPromotions: [],
    lines: [{ productId: COLICA, qty: 1, unitPriceCents: 1990 }],
    bonusLines: [],
  });

  assert.equal(item.commissionTotalPercent, null);
});

// ---------------------------------------------------------------------------
// Varredura: toda rota/página do vendedor exige sessão e usa ownership.ts
// ---------------------------------------------------------------------------

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test("área do vendedor: sessão obrigatória e consultas de posse centralizadas", () => {
  const sellerRoutes = [
    "app/api/b2b/clients/route.ts",
    "app/api/b2b/offers/draft/route.ts",
    "app/api/b2b/offers/link/route.ts",
    "app/api/b2b/offers/[offerId]/activate/route.ts",
  ];

  for (const rel of sellerRoutes) {
    const source = readFileSync(join(SRC, rel), "utf8");
    assert.match(source, /requireResponsible\(request\)/, `${rel}: precisa de requireResponsible`);
    assert.match(source, /from "@\/lib\/b2b\/ownership"/, `${rel}: precisa usar ownership.ts`);
  }

  const sellerPages = walk(join(SRC, "app/b2b/painel")).filter((file) => file.endsWith("page.tsx"));
  assert.ok(sellerPages.length >= 4);

  for (const file of sellerPages) {
    const source = readFileSync(file, "utf8");
    const rel = relative(SRC, file).replace(/\\/g, "/");
    assert.match(source, /requireResponsiblePage\(\)/, `${rel}: precisa de requireResponsiblePage`);
  }

  // Nenhuma rota do vendedor cria oferta já ativa (sem revisão).
  const apiFiles = walk(join(SRC, "app/api/b2b")).filter((file) => file.endsWith("route.ts"));
  for (const file of apiFiles) {
    const source = readFileSync(file, "utf8");
    const rel = relative(SRC, file).replace(/\\/g, "/");
    if (rel.endsWith("offers/[offerId]/activate/route.ts")) continue;
    assert.doesNotMatch(source, /status:\s*"active",\s*\n?\s*activatedAt/, `${rel}: só a revisão ativa oferta`);
  }
});
