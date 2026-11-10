/*
 * Catálogo do representante (/b2b/painel/catalogo), aprovado pelo Luis em 10/11: só leitura (linhas, preço ao lojista,
 * promoções com validade, PDFs, vídeo), a demonstração abre nele, item "Catálogo" no menu, botão final leva ao fluxo existente.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CATALOG_COMMISSION_SEAL,
  CATALOG_CONDITIONS,
  CATALOG_GROUPS,
  CATALOG_MATERIAL_BY_LINE,
  CATALOG_TRY_PATH,
  CATALOG_VIDEO_URL,
  groupCatalogLines,
  promotionValidityText,
} from "../src/lib/b2b/rep-catalog.ts";
import { findMaterial } from "../src/lib/b2b/sales-materials.ts";
import { HOME_LINE_IMAGES } from "../src/lib/b2b/line-images.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("grupos: Florais, Pet, Cosméticos e Home Care; toda linha do B2B tem grupo e PDF de Materiais de venda", () => {
  assert.deepEqual(CATALOG_GROUPS.map((group) => group.title), ["Florais", "Pet", "Cosméticos e Home Care"]);
  assert.deepEqual(CATALOG_GROUPS.find((group) => group.key === "pet").lines, ["pet", "cosmeticos-pet"]);

  const grouped = CATALOG_GROUPS.flatMap((group) => group.lines);
  for (const slug of Object.keys(HOME_LINE_IMAGES)) {
    assert.ok(grouped.includes(slug), `linha sem grupo: ${slug}`);
    assert.ok(findMaterial(CATALOG_MATERIAL_BY_LINE[slug]), `linha sem PDF: ${slug}`);
  }

  const lines = ["home-care", "adulto", "pet", "nova-linha", "cosmeticos-pet", "virtudes-divinas"].map((slug) => ({ slug }));
  const groups = groupCatalogLines(lines);
  assert.deepEqual(groups.map((group) => [group.title, group.lines.map((line) => line.slug)]), [
    ["Florais", ["adulto", "virtudes-divinas"]],
    ["Pet", ["pet", "cosmeticos-pet"]],
    ["Cosméticos e Home Care", ["home-care"]],
    ["Outras linhas", ["nova-linha"]],
  ]);
});

test("condições no topo, selo de comissão, vídeo e validade das promoções", () => {
  // o formatador de moeda põe espaço não separável depois do "R$"
  assert.deepEqual(CATALOG_CONDITIONS.map((text) => text.replace(/ /g, " ")), [
    "Pedido mínimo de R$ 250,00",
    "Frete grátis acima de R$ 450,00 (na opção econômica)",
    "Promoções válidas por até 6 meses",
  ]);
  assert.equal(CATALOG_COMMISSION_SEAL, "Até 25% de comissão, direto da indústria");
  assert.equal(CATALOG_VIDEO_URL, "https://www.youtube.com/watch?v=xSeneSbx3Fo");
  assert.equal(promotionValidityText(new Date("2026-12-31T23:59:00-03:00")), "Válida até 31/12/2026");
  assert.equal(promotionValidityText(null), "Sem data de término");
  assert.equal(promotionValidityText("lixo"), "Sem data de término");
});

test("tela só de leitura: sessão do vendedor, fonte do Offer Builder, nada é criado; botão final leva ao fluxo de cliente existente", () => {
  const page = read("src/app/b2b/painel/catalogo/page.tsx");
  assert.ok(page.includes("await requireResponsiblePage()"), "exige sessão do vendedor");
  assert.ok(page.includes("loadBuilderLines(new Date(), null)"), "mesmas linhas e promoções do Offer Builder");
  assert.ok(!/<form|method="post"|fetch\(|"use client"|INSERT|createPromoLink|createClient/i.test(page), "nada se cria nesta tela");
  assert.ok(page.includes('data-testid="catalogo-criar-exemplo"') && page.includes("Quero testar: criar um cliente de exemplo"));
  assert.equal(CATALOG_TRY_PATH, "/b2b/painel#montar-oferta-titulo");
  assert.ok(read("src/components/b2b/OfferForClientCard.tsx").includes('id="montar-oferta-titulo"'), "a âncora existe no card de criar cliente");
  // PDFs: na demonstração a versão do representante segue liberada e a do lojista só após o cadastro
  assert.ok(page.includes("PDF do lojista (após o cadastro)") && page.includes("?versao=representante") && page.includes("?versao=lojista"));
  assert.ok(/demo\.isDemo \? \(\s*<span[\s\S]*?após o cadastro/.test(page));
  assert.ok(page.includes("promotionValidityText(promotion.endsAt)") && page.includes("CATALOG_COMMISSION_SEAL") && page.includes("CATALOG_VIDEO_URL"));
  assert.ok(read("src/lib/b2b/offer-builder.ts").includes("endsAt: row.endsAt ?? null,"), "a validade vem da promoção do admin");
});

test("menu com Catálogo (vendedor e demo); a demonstração abre no catálogo; boas-vindas apontam para ele", () => {
  const layout = read("src/app/b2b/painel/layout.tsx");
  const catalogLink = layout.indexOf('href="/b2b/painel/catalogo"');
  assert.ok(catalogLink > 0 && catalogLink < layout.indexOf("{!demo.isDemo && ("), "o Catálogo aparece também na demonstração");

  const demo = read("src/app/b2b/demo/[token]/route.ts");
  assert.ok(demo.includes('const DEMO_START_PATH = "/b2b/painel/catalogo";'));
  assert.equal((demo.match(/redirectTo\(DEMO_START_PATH\)/g) ?? []).length, 2, "entrada nova e volta no mesmo navegador");
  assert.ok(!demo.includes('redirectTo("/b2b/painel")'));

  const welcome = read("src/components/b2b/DemoWelcome.tsx");
  assert.ok(welcome.includes("Veja o <strong>Catálogo</strong>") && welcome.includes("Ver o catálogo"));
});
