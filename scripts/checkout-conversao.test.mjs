/*
 * Checkout B2C no celular: evento checkout_etapa (só etapa, origem e campanha), correção do estouro de largura, frete logo abaixo do CEP,
 * máscara do CEP, campos opcionais recolhidos, barra fixa com total e botão, motivo do botão apagado e sem barras flutuantes por cima.
 * Nenhuma regra de preço, cupom ou desconto do Pix foi tocada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAttributionCookie } from "../src/lib/attribution.ts";
import { ANALYTICS_EVENTS, CHECKOUT_STEPS, checkoutStepProps, eventProps } from "../src/lib/analytics-events.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const COOKIE = buildAttributionCookie({ utm_source: "instagram", utm_medium: "organic", utm_campaign: "2110_rotina", referrer_domain: "l.instagram.com" }, true).split(";")[0];

test("evento checkout_etapa: 4 etapas; propriedades só etapa + origem + campanha (nada pessoal)", () => {
  assert.ok(ANALYTICS_EVENTS.includes("checkout_etapa"));
  assert.deepEqual([...CHECKOUT_STEPS], ["dados", "endereco", "frete", "pagamento"]);

  for (const step of CHECKOUT_STEPS) {
    const props = checkoutStepProps(step, COOKIE);

    assert.deepEqual(Object.keys(props).sort(), ["campanha", "etapa", "origem"]);
    assert.equal(props.etapa, step);
  }

  assert.deepEqual(checkoutStepProps("frete", COOKIE), { origem: "instagram / organic", campanha: "2110_rotina", etapa: "frete" });
  assert.deepEqual(checkoutStepProps("dados", ""), { origem: "direto", campanha: "nenhuma", etapa: "dados" });
  assert.deepEqual(Object.keys(eventProps(COOKIE)).sort(), ["campanha", "origem"], "os outros eventos continuam com duas propriedades");
});

test("checkout: etapa marcada 1x por visita (campo, autofill, frete, pagamento) e sem dado pessoal no evento", () => {
  const page = read("src/app/checkout/page.tsx");

  assert.ok(page.includes("trackCheckoutStep") && page.includes("stepsSent") && page.includes("stepsSent.current.has(step)"));
  assert.ok(page.includes("onFocusCapture") && page.includes("onInput={(event)") && page.includes("markStepForField"));
  assert.ok(page.includes('markStep("frete")') && page.includes('markStep("pagamento")'));
  assert.ok(!/trackCheckoutStep\([^)]*(email|name|cep|document|phone)/i.test(page), "o evento nunca leva dado do formulário");
});

test("checkout no celular: grades sem estouro de largura, frete sob o CEP, máscara do CEP, opcionais recolhidos e barra fixa", () => {
  const page = read("src/app/checkout/page.tsx");

  assert.ok(page.includes("grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"), "a grade principal não deixa o conteúdo alargar a página");
  assert.equal((page.match(/grid gap-5 md:grid-cols-2/g) ?? []).length, 0, "nenhuma grade de formulário sem minmax(0,1fr)");
  assert.ok(page.includes('data-testid="frete-sob-cep"') && page.includes("Calculando o frete..."));
  assert.ok(page.includes("const masked = cep.length > 5") && page.includes("input.value = masked"));
  for (const id of ["campo-opcional-rg", "campo-opcional-observacoes", "cupom-recolhido"]) assert.ok(page.includes(`data-testid="${id}"`), id);
  assert.ok(page.includes("<details") && page.includes("Tem cupom de desconto?") && page.includes("Informar RG ou Inscrição Estadual (opcional)"));
  assert.ok(page.includes('data-testid="barra-checkout-fixa"') && page.includes("lg:hidden") && page.includes('data-testid="continuar-fixo"'));
  assert.ok(page.includes("submitHint") && page.includes("Informe o CEP para ver o frete") && page.includes('data-testid="motivo-botao-apagado"'));
  assert.ok(page.includes("CPF ou CNPJ, só números"), "placeholder curto no celular");
});

test("regras intocadas: preço, cupom e desconto do Pix continuam os mesmos no checkout", () => {
  const page = read("src/app/checkout/page.tsx");

  assert.ok(page.includes("pixDiscountCents") && page.includes("validateCommercialCoupon") && page.includes("handleApplyCommercialCoupon"));
  assert.ok(page.includes("B2C_PIX_DISCOUNT_PERCENT") && page.includes('name="coupon"') && page.includes('name="partnerCoupon"'));
  assert.ok(read("src/lib/checkout/benefits.ts").includes("export const B2C_PIX_DISCOUNT_PERCENT = 4;"));
});

test("sem barras flutuantes no checkout nem na retomada de pagamento (cobriam campos e botão)", () => {
  const hide = read("src/components/layout/HideOnB2B.tsx");

  assert.ok(hide.includes('pathname === "/checkout"') && hide.includes('pathname?.startsWith("/checkout/")') && hide.includes('pathname?.startsWith("/pagar/")'));
});

test("sacola vazia piscando (06/11): /checkout e /carrinho mostram esqueleto enquanto a sacola é lida; nunca 'vazia' antes; checkout_visto só com itens", () => {
  const norm = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const provider = norm("src/components/cart/CartProvider.tsx");
  assert.ok(provider.includes("hydrated: boolean;") && /itemCount,\n\s*hydrated,/.test(provider), "a sacola diz quando terminou de ler");

  const checkout = norm("src/app/checkout/page.tsx");
  const skeletonAt = checkout.indexOf("if (!hydrated) {");
  const emptyAt = checkout.indexOf('if (items.length === 0 && pendingOrderStatus !== "paid") {');
  assert.ok(skeletonAt > 0 && emptyAt > skeletonAt, "checkout: esqueleto ANTES do 'sacola vazia'");
  assert.ok(checkout.includes('<CartLoadingSkeleton variant="checkout" />'));
  assert.ok(checkout.includes('void trackEvent("checkout_visto");') && checkout.includes("if (checkoutSeenSent.current || !hydrated || items.length === 0) return;"));

  const cart = norm("src/app/carrinho/page.tsx");
  assert.ok(/\{!hydrated \? \([\s\S]*?<CartLoadingSkeleton variant="cart" \/>[\s\S]*?\) : items\.length === 0 \? \(/.test(cart), "carrinho: esqueleto antes do 'vazia'");

  const skeleton = norm("src/components/cart/CartLoadingSkeleton.tsx");
  assert.ok(!skeleton.slice(skeleton.indexOf("export default")).includes("vazia") && skeleton.includes('data-testid="sacola-carregando"'));
  assert.ok(ANALYTICS_EVENTS.includes("checkout_visto"));
});

test("aviso de cookies (Luis 14/11): compacto e NO FLUXO do topo no celular/tablet (nunca cobre a barra fixa de compra nem botões); no computador, cartão no canto; Aceitar e Recusar iguais; Configurar link", () => {
  const norm = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const banner = norm("src/components/consent/CookieBanner.tsx");
  assert.ok(banner.includes('data-position="topo-no-fluxo"'));
  assert.ok(banner.includes('className="relative z-[60] border-b') && banner.includes("lg:fixed lg:bottom-4 lg:left-4"), "relativo (no fluxo) até o lg; fixo só no computador");
  assert.ok(!/\bfixed inset-x-2\b/.test(banner), "nada fixo por cima no celular");
  for (const label of ["Aceitar", "Recusar", "Configurar"]) assert.ok(banner.includes(label), label);
  const layout = norm("src/app/layout.tsx");
  assert.ok(layout.indexOf("<CookieBanner />") < layout.indexOf("<CampaignStrip />"), "o aviso vem antes da faixa, no topo do body");

  const checkout = norm("src/app/checkout/page.tsx");
  assert.ok(checkout.includes('className="fixed inset-x-0 bottom-0 z-[65]') && checkout.includes("lg:hidden"), "a barra fixa só existe abaixo do lg");
  assert.ok(!checkout.includes("usado na nota fiscal"), "CPF sem mudança");
});

test("14/11: calcular frete na sacola (mesma cotação e regra do checkout; CEP vai para o rascunho do checkout) e campo Número com teclado numérico + Sem número", async () => {
  const norm = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const { saveCepToCheckoutDraft, readCepFromCheckoutDraft } = await import("../src/lib/checkout-draft-cep.ts");
  const store = new Map([["bio-checkout-draft", JSON.stringify({ fields: { name: "Maria" }, paymentMethod: "pix" })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveCepToCheckoutDraft(storage, "01310100");
  assert.deepEqual(JSON.parse(store.get("bio-checkout-draft")), { fields: { name: "Maria", postalCode: "01310-100" }, paymentMethod: "pix" }, "não apaga o rascunho");
  assert.equal(readCepFromCheckoutDraft(storage), "01310100");

  const estimate = norm("src/components/cart/CartShippingEstimate.tsx");
  assert.ok(estimate.includes('fetch("/api/shipping/quote"') && estimate.includes("computeB2CShipping({"), "mesma cotação e mesma regra");
  const cart = norm("src/app/carrinho/page.tsx");
  assert.ok(cart.includes("<CartShippingEstimate") && cart.includes("quote.totalCents + (shippingEstimate?.customerCents ?? 0)") && cart.includes('"Total com frete"'));

  const checkout = norm("src/app/checkout/page.tsx");
  assert.ok(/name="number"\s*\n\s*inputMode="numeric"/.test(checkout), "teclado numérico");
  assert.ok(checkout.includes('data-testid="sem-numero"') && checkout.includes('input.value = "S/N";'), "S/N continua possível");
  assert.ok(checkout.indexOf('name="name"') < checkout.indexOf('name="postalCode"'), "ordem dos campos do checkout igual");
});

test("aviso aberto no celular: a sacola flutuante desce para baixo do cabeçalho (não cobre a faixa nem o Voltar para…) (Luis, 14/11)", () => {
  const norm = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const banner = norm("src/components/consent/CookieBanner.tsx");
  assert.ok(banner.includes('root.dataset.cookieBanner = "aberto"') && banner.includes('new Event("bio:cookie-banner")'));
  assert.ok(banner.indexOf("useEffect(() => {\n    const root") < banner.indexOf("if (!visible) return null;"), "hook antes do retorno");
  const cart = norm("src/components/cart/GlobalCartButton.tsx");
  assert.ok(cart.includes('document.documentElement.dataset.cookieBanner === "aberto"') && cart.includes("window.innerWidth >= 1024"));
  assert.ok(cart.includes("header.getBoundingClientRect().bottom + 8") && cart.includes("style={belowHeaderTop !== null ? { top: belowHeaderTop } : undefined}"));
  assert.ok(cart.indexOf("useEffect(") < cart.indexOf("if (itemCount <= 0"), "hook antes do retorno");
});
