/*
 * Sugestões no carrinho para chegar ao frete grátis (R$ 70): cartão entre os itens e o total, 3 sugestões por tipo de sacola,
 * "Você ganhou frete grátis" ao bater R$ 70, versão compacta no checkout e evento sugestao_adicionada (origem e campanha).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bioProducts } from "../src/lib/catalog/bio-products.ts";
import { ANALYTICS_EVENTS } from "../src/lib/analytics-events.ts";
import { buildCartSuggestions, shippingGap, suggestionAudience } from "../src/lib/cart-suggestions.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const bySlug = new Map(bioProducts.map((product) => [product.slug, product]));
const STRESS = "adulto-floral-em-gotas-stress";
const PET = "pet-floral-em-gotas-ansiedade";

test("floral humano: outro floral de gotas (mais vendido, sem repetir), um sabonete líquido e o aromatizador It's Blossom", () => {
  const suggestions = buildCartSuggestions([STRESS]);

  assert.equal(suggestions.length, 3);
  assert.equal(bySlug.get(suggestions[0].slug).category, "Floral em gotas");
  assert.equal(bySlug.get(suggestions[0].slug).lineSlug, "adulto");
  assert.equal(bySlug.get(suggestions[1].slug).category, "Sabonete Líquido");
  assert.equal(bySlug.get(suggestions[1].slug).lineSlug, "cosmeticos");
  assert.equal(bySlug.get(suggestions[2].slug).category, "Aromatizador Spray");
  assert.equal(bySlug.get(suggestions[2].slug).lineSlug, "home-care");
  assert.ok(!suggestions.some((suggestion) => suggestion.slug === STRESS), "não repete o que já está na sacola");

  // o floral sugerido sai da lista dos mais vendidos e pula o que já está na sacola
  const first = suggestions[0].slug;
  assert.notEqual(buildCartSuggestions([STRESS, first])[0].slug, first);
  assert.ok(!buildCartSuggestions([STRESS, first]).some((suggestion) => suggestion.slug === first));
});

test("floral pet: outro floral pet, um cosmético pet e o floral de ambiente pet", () => {
  const suggestions = buildCartSuggestions([PET]);

  assert.equal(suggestionAudience([PET]), "pet");
  assert.equal(suggestions.length, 3);
  assert.deepEqual([bySlug.get(suggestions[0].slug).lineSlug, bySlug.get(suggestions[0].slug).category], ["pet", "Floral em gotas"]);
  assert.deepEqual([bySlug.get(suggestions[1].slug).lineSlug, bySlug.get(suggestions[1].slug).category], ["cosmeticos-pet", "Shampoo"]);
  assert.deepEqual([bySlug.get(suggestions[2].slug).lineSlug, bySlug.get(suggestions[2].slug).category], ["cosmeticos-pet", "Floral de Ambiente"]);
  assert.ok(suggestions.every((suggestion) => suggestion.slug !== PET));
});

test("sacola mista segue o último item; sacola vazia ou só de cosmético humano usa a regra humana", () => {
  assert.equal(suggestionAudience([PET, STRESS]), "humano");
  assert.equal(suggestionAudience([STRESS, PET]), "pet");
  assert.equal(suggestionAudience([]), "humano");
  assert.equal(suggestionAudience(["cosmeticos-sabonete-liquido-relaxante"]), "humano");
});

test("sem promessa de saúde e sem condição sensível: nunca sugere Rescue/S.O.S./Tristeza/Depressão; sempre com preço", () => {
  for (const cart of [[STRESS], [PET], ["home-care-aromatizador-spray-harmonia"], ["cosmeticos-pet-shampoo-filhotes"]]) {
    for (const suggestion of buildCartSuggestions(cart)) {
      assert.ok(!/rescue|s\.o\.s|depress|tristeza/i.test(suggestion.name), suggestion.name);
      assert.ok(suggestion.priceCents > 0);
      assert.ok(!/trata|cura|alivia|remédio|medic/i.test(`${suggestion.kind} ${suggestion.name}`));
    }
  }
});

test("quanto falta: R$ 70, barra de progresso e 'ganhou' ao bater", () => {
  assert.deepEqual(shippingGap(3590, 7000), { remainingCents: 3410, reached: false, progress: (3590 / 7000) * 100 });
  assert.equal(shippingGap(7000, 7000).reached, true);
  assert.equal(shippingGap(7180, 7000).remainingCents, 0);
  assert.equal(shippingGap(0, 7000).reached, false);
  assert.equal(shippingGap(99999, 7000).progress, 100);
});

test("telas: cartão no carrinho entre itens e total, versão compacta no checkout, evento sugestao_adicionada sem inflar sacola", () => {
  assert.ok(ANALYTICS_EVENTS.includes("sugestao_adicionada"));

  const cart = read("src/app/carrinho/page.tsx");
  assert.ok(cart.includes("<CartShippingSuggestions baseCents={freeShippingBaseCents} />"));
  assert.ok(cart.indexOf("<CartShippingSuggestions") > cart.indexOf("removeProduct(") && cart.indexOf("<CartShippingSuggestions") < cart.indexOf("Resumo"), "entre os itens e o total");

  assert.ok(read("src/app/checkout/page.tsx").includes('<CartShippingSuggestions baseCents={merchandiseTotalCents} variant="compact" />'));

  const component = read("src/components/cart/CartShippingSuggestions.tsx");
  assert.ok(component.includes("que tal levar junto?") && component.includes("+ Adicionar") && component.includes("Você ganhou frete grátis") && component.includes('"sugestao"'));
  assert.ok(!component.includes("Dialog") && !component.includes("fixed"), "sem pop-up");

  const provider = read("src/components/cart/CartProvider.tsx");
  assert.ok(provider.includes('source === "sugestao" ? "sugestao_adicionada" : "sacola"'));
  assert.ok(read("src/components/layout/HideOnB2B.tsx").includes('pathname === "/carrinho"'));
});

test("convite de criadoras: sem prazo (30/09), mantendo a condição", () => {
  const ugc = read("src/components/ugc/UgcFloatingButton.tsx");

  assert.ok(ugc.includes("Condição vigente. Pode ser combinada com promoções da loja."));
  assert.ok(!ugc.includes("30/09"));
});
