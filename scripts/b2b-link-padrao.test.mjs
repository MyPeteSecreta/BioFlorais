/*
 * Rodada 6 / L1: "Link padrão" — oferta ativa com TODAS as linhas B2B publicadas, sem promoção,
 * para cliente novo (só o nome) ou existente; Copiar, WhatsApp e QR Code na hora.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { validateDraftInput } = await import("../src/lib/b2b/offer-draft-input.ts");
const { commissionFor } = await import("../src/lib/b2b/commission.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const [ADULTO, PET, INFANTIL, B3] = ["a", "b", "c", "d"].map((c) => `${c.repeat(8)}-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}`);
const lines = [ADULTO, PET, INFANTIL].map((id, index) => ({ id, name: `Linha ${index}`, promotions: [{ id: B3, available: true }] }));
const matrix = { configured: true, basePercent: 10, normalExtraPercent: 15, rules: [] };

test("todas as linhas publicadas, sem promoção: a validação do Offer Builder aceita e a comissão é a do preço normal", () => {
  const parsed = validateDraftInput({ commercialGroupIds: lines.map((line) => line.id), promotions: [] }, lines, matrix);

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value.commercialGroupIds, [ADULTO, PET, INFANTIL]);
  assert.deepEqual(parsed.value.conditions, []);
  assert.deepEqual(commissionFor(matrix, { kind: "normal" }), { basePercent: 10, extraPercent: 15, totalPercent: 25 });
});

test("rota: só vendedor logado e cliente dele; sem promoção; cria o cliente só com o nome", () => {
  const route = read("src/app/api/b2b/offers/quick/route.ts");
  assert.ok(route.includes("requireResponsible(request)") && route.includes("findOwnedClient("));
  assert.ok(route.includes("promotions: []"), "sem promoção");
  assert.ok(route.includes("createClientForResponsible(responsible.id, name)"));
  assert.ok(route.includes("name.length < 2"));

  const lib = read("src/lib/b2b/quick-offer.ts");
  assert.ok(lib.includes("validateDraftInput(") && lib.includes('status: "active"') && lib.includes("issueOfferLink("));
  assert.ok(lib.indexOf('status: "draft"') < lib.indexOf('status: "active"'), "ativa só depois de gravar linhas e promoções");
});

test("painel: botão grande no topo, cliente novo ou existente, Copiar/WhatsApp/QR no resultado", () => {
  const page = read("src/app/b2b/painel/page.tsx");
  // Rodada 10: o card principal é "Montar oferta" e o link com o nome do cliente fica em "Links rápidos" (depois dele).
  assert.ok(page.indexOf("<OfferForClientCard") > 0 && page.indexOf("<OfferForClientCard") < page.indexOf("<QuickLinkPanel"));
  const panel = read("src/components/b2b/QuickLinkPanel.tsx");
  assert.ok(panel.includes("Link com o nome do cliente") && panel.includes("Gerar link"));
  assert.ok(panel.includes("<LinkSharePanel") && panel.includes("clientName={result.clientName}"));
  const share = read("src/components/b2b/LinkSharePanel.tsx");
  assert.ok(share.includes("Copiar link") && share.includes("Enviar pelo WhatsApp") && share.includes("Mostrar QR Code"));
});
