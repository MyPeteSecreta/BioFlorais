/*
 * Rodada 10 — painel do vendedor claro: "Montar oferta para um cliente" é o 1º e maior card; Lançar pedido,
 * links rápidos (com o nome / geral) com comparativo, Mostruário e Meus clientes com botões visíveis;
 * "Minhas ofertas padrão" vira "Ofertas prontas" com botão grande de criar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("painel: ordem dos cards e textos da Rodada 10", () => {
  const page = read("src/app/b2b/painel/page.tsx");
  const order = ["saudacao", "<OfferForClientCard", "card-lancar-pedido", "links-rapidos", "card-mostruario", "meus-clientes"].map((marker) => page.indexOf(marker));
  assert.ok(order.every((index) => index > 0), "todos os blocos existem");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "ordem: saudação, oferta, lançar, links, mostruário, clientes");
  assert.ok(page.includes("O que você quer fazer agora?") && page.includes("Olá, {firstName}"));
  assert.ok(page.includes("Links rápidos — preço de lojista, sem promoção") && page.includes("Todas as linhas, preço B2B cheio (sem promoção). Comissão normal para você."));
  assert.ok(page.includes("Peça amostras para mostrar aos lojistas, com preço de mostruário e limite por linha a cada 45 dias."));
  assert.ok(page.includes("O lojista está com você (na loja ou ao telefone) e não quer link?"));
  assert.ok(page.includes("Oferta ativa desde") && page.includes("<ClientCardActions"));
  assert.ok(page.includes("<LinkChooser"));
});

test("card principal: maior, cor da marca, textos e botões grandes", () => {
  const card = read("src/components/b2b/OfferForClientCard.tsx");
  assert.ok(card.includes("Montar oferta para um cliente"));
  assert.ok(card.includes("A forma que mais vende. Você escolhe as linhas e a promoção de cada uma, vê sua comissão e envia um link com o nome do"));
  assert.ok(card.includes("Escolher cliente ▾") && card.includes("+ Cliente novo") && card.includes("Usar uma oferta pronta"));
  assert.ok(card.includes("text-3xl") && card.includes("bg-[#55245f]"), "maior que os demais (título 3xl, fundo da marca)");
  assert.ok(/min-h-\[(5[0-9]|4[4-9])px\]/.test(card), "botões >= 44 px");
  assert.ok(card.includes("/oferta"), "escolher cliente abre o Offer Builder");
});

test("links rápidos: textos novos e comparativo com miniaturas", () => {
  const quick = read("src/components/b2b/QuickLinkPanel.tsx");
  assert.ok(quick.includes("Link com o nome do cliente") && quick.includes("o cliente só quer ver a tabela e comprar") && quick.includes("Gerar link"));
  const referral = read("src/components/b2b/ReferralLinkPanel.tsx");
  assert.ok(referral.includes("Link geral para divulgar") && referral.includes("flyer, cartão, Instagram, grupo de WhatsApp") && referral.includes("fica na sua carteira"));
  const chooser = read("src/components/b2b/LinkChooser.tsx");
  assert.ok(chooser.includes("Não sabe qual usar?") && chooser.includes("useState(false)"), "fechado por padrão");
  for (const text of ["Oferta para o cliente", "Link com o nome do cliente", "Link geral para divulgar", "Leve 3 pague 2", "Olá, Pet Honjo", "Identifique-se ao finalizar", "Base + extra da promoção"]) {
    assert.ok(chooser.includes(text), text);
  }
  assert.ok(!chooser.includes("<img") && !chooser.includes("next/image"), "miniatura sem foto");
});

test("Meus clientes: Nova oferta sempre visível + Copiar/WhatsApp/QR", () => {
  const actions = read("src/components/b2b/ClientCardActions.tsx");
  assert.ok(actions.includes("Nova oferta") && actions.includes("Copiar link") && actions.includes("WhatsApp") && actions.includes("QR"));
  assert.ok(actions.includes("min-h-[44px]"));
  assert.ok(actions.includes("/api/b2b/offers/link?offerId="));
});

test("Ofertas prontas (era Minhas ofertas padrão): nome, explicação e botões grandes", () => {
  const page = read("src/app/b2b/painel/modelos/page.tsx");
  assert.ok(page.includes("<h1") && page.includes("Ofertas prontas") && !page.includes("Minhas ofertas padrão</h1>"));
  assert.ok(page.includes("Monte uma vez as linhas e promoções que você mais usa e aplique em qualquer cliente em 1 clique."));
  assert.ok(page.includes("+ Criar oferta pronta") && page.includes("min-h-[56px]"));
  const panel = read("src/components/b2b/TemplatesPanel.tsx");
  assert.ok(panel.includes("Usar com um cliente") && panel.includes("Editar") && panel.includes("min-h-[44px]"));
  // rotas e dados não mudam
  assert.ok(page.includes("/b2b/painel/modelos/novo") && panel.includes("/api/b2b/offers/from-template") && panel.includes("/api/b2b/offer-templates"));
});
