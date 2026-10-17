/*
 * Rodada 6 / L2: "Minhas ofertas padrão" — modelo por vendedor (nome + linhas + promoção por (promoção, linha)),
 * conferência contra o cliente (promoção indisponível/desativada sai da oferta com aviso), isolamento.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { reconcileTemplate } = await import("../src/lib/b2b/quick-offer.ts");
const { archiveTemplate, getTemplate, listTemplates } = await import("../src/lib/b2b/offer-templates.ts");
const { validateDraftInput } = await import("../src/lib/b2b/offer-draft-input.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const [ADULTO, PET, INFANTIL, BABY] = [U(20), U(21), U(22), U(23)];
const [B3, B1] = [U(40), U(41)];

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
const promo = (id, name, over = {}) => ({ id, name, buyQuantity: 2, freeQuantity: 1, percent: null, promoType: "recorrente", available: true, reason: "", onlyProducts: [], scopeText: null, ...over });
const lines = [
  { id: ADULTO, slug: "adulto", name: "Adulto", image: null, promotions: [promo(B3, "B3"), promo(B1, "B1")] },
  { id: PET, slug: "pet", name: "Pet", image: null, promotions: [promo(B1, "B1", { available: false, reason: "Indisponível: cliente comprou esta linha em 01/09/2026" })] },
  { id: INFANTIL, slug: "infantil", name: "Infantil", image: null, promotions: [promo(B1, "B1")] },
];
const template = {
  commercialGroupIds: [ADULTO, PET, INFANTIL, BABY],
  promotions: [
    { commercialGroupId: ADULTO, promotionId: B3, promotionName: "B3", eligibilityMode: "uses", maxUses: 2, durationDays: null },
    { commercialGroupId: PET, promotionId: B1, promotionName: "B1", eligibilityMode: "uses", maxUses: 3, durationDays: null },
    { commercialGroupId: INFANTIL, promotionId: B1, promotionName: "B1", eligibilityMode: "days", maxUses: null, durationDays: 60 },
  ],
};

test("modelo salvo por (promoção, linha): a mesma promoção em linhas diferentes passa na validação do Offer Builder", () => {
  const parsed = validateDraftInput(
    { commercialGroupIds: [ADULTO, PET, INFANTIL], promotions: template.promotions.map(({ promotionName: _n, ...rest }) => rest) },
    lines.map((line) => ({ ...line, promotions: lines[0].promotions })),
    matrix
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.conditions.length, 3);
});

test("conferência: abertura indisponível para o cliente, linha despublicada e promoção desativada viram AVISO; o resto fica", () => {
  const evaluation = reconcileTemplate(lines, matrix, template);

  assert.deepEqual(evaluation.commercialGroupIds, [ADULTO, PET, INFANTIL], "Baby não está mais publicada");
  assert.deepEqual(evaluation.promotions.map((p) => [p.commercialGroupId, p.promotionId]), [[ADULTO, B3], [INFANTIL, B1]]);
  assert.equal(evaluation.warnings.length, 2);
  assert.match(evaluation.warnings.join(" | "), /Pet: 3 por 2 \(3 compras\) saiu desta oferta, Indisponível: cliente comprou esta linha/);
  assert.match(evaluation.warnings.join(" | "), /não está mais publicada/);

  const report = Object.fromEntries(evaluation.lines.map((line) => [line.id, line]));
  assert.equal(report[ADULTO].promotion.eligibility, "2 compras");
  assert.equal(report[PET].promotion, null, "Pet vai com preço normal");
  assert.equal(report[INFANTIL].promotion.eligibility, "60 dias");
  assert.equal(report[BABY].included, false);
});

test("promoção desativada (some da linha) e elegibilidade sem regra de comissão saem com aviso", () => {
  const noPromo = lines.map((line) => (line.id === ADULTO ? { ...line, promotions: [] } : line));
  const a = reconcileTemplate(noPromo, matrix, { commercialGroupIds: [ADULTO], promotions: [template.promotions[0]] });
  assert.deepEqual(a.promotions, []);
  assert.match(a.warnings[0], /desativada ou saiu da vigência/);

  const b = reconcileTemplate(lines, { ...matrix, rules: [] }, { commercialGroupIds: [ADULTO], promotions: [template.promotions[0]] });
  assert.deepEqual(b.promotions, []);
  assert.match(b.warnings[0], /não está configurada nas regras de comissão/);

  const clean = reconcileTemplate(lines, matrix, { commercialGroupIds: [ADULTO, INFANTIL], promotions: [template.promotions[0], template.promotions[2]] });
  assert.deepEqual(clean.warnings, []);
  assert.equal(clean.promotions.length, 2);
});

test("34b: tabela aditiva e idempotente; cada vendedor só vê e arquiva os próprios modelos", async () => {
  const pg = new PGlite();
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  await pg.exec(`CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, status text);
    INSERT INTO b2b_responsibles VALUES ('${U(1)}', 'active'), ('${U(2)}', 'active');`);
  assert.equal((await run(read("sql/b2b/34a_modelos_de_oferta_preflight_one_shot.sql")))[0].preflight_modelos_de_oferta.tabela_modelos_existe, false);

  const sql = read("sql/b2b/34b_modelos_de_oferta.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  await pg.exec(sql);
  assert.equal((await run(read("sql/b2b/34a_modelos_de_oferta_preflight_one_shot.sql")))[0].preflight_modelos_de_oferta.tabela_modelos_existe, true);

  await run(
    `INSERT INTO b2b_offer_templates (id, responsible_id, name, commercial_group_ids, promotions) VALUES
      ('${U(50)}', '${U(1)}', 'Pet shop', $1::jsonb, $2::jsonb), ('${U(51)}', '${U(2)}', 'Do outro', '[]', '[]')`,
    [JSON.stringify([ADULTO, PET]), JSON.stringify([template.promotions[0]])]
  );

  const mine = await listTemplates(run, U(1));
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].name, mine[0].commercialGroupIds, mine[0].promotions[0].promotionId], ["Pet shop", [ADULTO, PET], B3]);
  assert.equal(await getTemplate(run, U(1), U(51)), null, "modelo de outro vendedor");
  assert.equal(await archiveTemplate(run, U(1), U(51)), false);
  assert.equal(await archiveTemplate(run, U(1), U(50)), true);
  assert.equal((await listTemplates(run, U(1))).length, 0);
  assert.equal((await run(`SELECT count(*)::int AS n FROM b2b_offer_templates`))[0].n, 2, "nada apagado");
  await pg.close();
});

test("telas e rotas: modelos no painel, mesmo Offer Builder, conferência antes de gerar, rotas protegidas", () => {
  assert.ok(read("src/components/b2b/OfferForClientCard.tsx").includes("Usar uma oferta pronta") && read("src/app/b2b/painel/modelos/page.tsx").includes("Ofertas prontas"));
  const builderPage = read("src/app/b2b/painel/modelos/[id]/page.tsx");
  assert.ok(builderPage.includes("<OfferBuilder") && builderPage.includes("templateMode"));
  const builder = read("src/app/b2b/painel/cliente/[clientId]/oferta/OfferBuilder.tsx");
  assert.ok(builder.includes("/api/b2b/offer-templates") && builder.includes("Salvar modelo"));
  const panel = read("src/components/b2b/TemplatesPanel.tsx");
  assert.ok(panel.includes("Usar com um cliente") && panel.includes("Conferir a oferta") && panel.includes("Atenção antes de gerar"));
  assert.ok(panel.includes("<LinkSharePanel") && panel.includes("clientName={result.clientName}"), "Copiar, WhatsApp e QR");
  for (const f of ["src/app/api/b2b/offer-templates/route.ts", "src/app/api/b2b/offers/from-template/route.ts"]) {
    assert.ok(read(f).includes("requireResponsible(request)"), f);
  }
  const route = read("src/app/api/b2b/offers/from-template/route.ts");
  assert.ok(route.includes("getTemplate(run, responsible.id") && route.includes("findOwnedClient(run, responsible.id"));
  assert.ok(route.includes("body.preview"));
});
