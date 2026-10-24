/*
 * Rodada 20 (b–g) — páginas de campanha do ChatGPT Ads (/para/*) e GPT10 automático: um modelo, 8 páginas, dados em arquivo,
 * noindex, fora do sitemap e do menu, mesmo conteúdo para todos (sem cloaking), GPT10 aplicado e removível, sem promessa de saúde,
 * nunca "Rescue".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const data = await import("../src/lib/campaign/gpt-pages.ts");
const gpt10 = await import("../src/lib/campaign/gpt10.ts");
const { getProduct } = await import("../src/lib/catalog/bio-products.ts");
const ads = await import("../src/lib/ads-tag.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const exists = (rel) => existsSync(new URL(`../public${rel}`, import.meta.url));

const EXPECTED = {
  "pet-sozinho": ["pet-floral-em-gotas-ansiedade", "pet-floral-em-gotas-stress", "pet-floral-em-gotas-carencia-e-sindrome-do-abandono", "pet-floral-em-gotas-latido-excessivo"],
  "pet-habitos": ["pet-floral-em-gotas-lambedura-e-automutilacao", "pet-floral-em-gotas-hiperatividade", "pet-floral-em-gotas-coprofagia", "pet-floral-em-gotas-latido-excessivo"],
  "pet-medroso": ["pet-floral-em-gotas-ansiedade", "pet-floral-em-gotas-s-o-s", "pet-floral-em-gotas-medo-de-fogos", "pet-floral-em-gotas-medo"],
  pausa: ["adulto-floral-em-gotas-sensacao-de-ansiedade", "adulto-floral-em-gotas-stress", "adulto-floral-em-gotas-reequilibrio-dos-chakras", "adulto-floral-em-gotas-medo"],
  // saiu "Tristeza e Depressão" (rótulo do frasco traz "Depressão")
  "fim-do-dia": ["adulto-floral-em-gotas-sono", "adulto-floral-em-gotas-stress", "adulto-floral-em-gotas-sensacao-de-ansiedade", "adulto-floral-em-gotas-falta-de-tolerancia"],
  // saiu "Rescue" (rótulo do frasco traz RESCUE)
  rotina: ["adulto-floral-em-gotas-stress", "adulto-floral-em-gotas-sensacao-de-ansiedade", "adulto-floral-em-gotas-mudancas-na-vida", "adulto-floral-em-gotas-falta-de-tolerancia"],
  "bebe-soninho": ["baby-floral-em-gotas-sono", "baby-floral-em-gotas-choro-excessivo", "baby-floral-em-gotas-bebe-nervoso"],
  "crianca-desacelerar": ["infantil-floral-em-gotas-hiperatividade", "infantil-floral-em-gotas-ansiedade", "infantil-floral-em-gotas-sono", "infantil-floral-em-gotas-medos-infantis-e-pesadelos"],
};

test("dados: 8 páginas exatamente, com os produtos aprovados; todos existem no catálogo com preço", () => {
  assert.deepEqual([...data.CAMPAIGN_SLUGS].sort(), Object.keys(EXPECTED).sort());
  for (const page of data.campaignPages) {
    assert.deepEqual(page.products.map((entry) => entry.slug), EXPECTED[page.slug], page.slug);
    for (const entry of page.products) {
      const product = getProduct(entry.slug);
      assert.ok(product, entry.slug);
      assert.ok(product.priceCents > 0, `${entry.slug}: preço`);
      assert.equal(product.lineSlug, page.lineSlug, `${entry.slug}: linha`);
    }
    assert.ok(page.products.length >= 3 && page.products.length <= 4);
    assert.equal(page.faq.length, 5, `${page.slug}: um bloco só de perguntas (uso, álcool, medicamento, frete, pagamento)`);
    assert.ok(page.faq.some((item) => /frete/i.test(item.question)) && page.faq.some((item) => /pagar/i.test(item.question)));
    assert.ok(page.lead.length <= 120, `${page.slug}: frase curta (${page.lead.length})`);
  }
  assert.equal(data.getCampaignPage("nao-existe"), undefined);
});

test("conteúdo: sem 'Rescue', sem 'única'/'nº 1', sem promessa de saúde; S.O.S. no nome do produto", () => {
  const text = JSON.stringify(data.campaignPages) + read("src/app/para/[slug]/page.tsx");
  assert.ok(!/rescue/i.test(text), "nunca 'Rescue'");
  assert.ok(!/\b(única|unico|único|nº ?1|número 1|número um|melhor do mercado|líder)\b/i.test(text));
  assert.ok(!/\b(cura|curar|curam|trata|tratar|tratamento de|elimina|eliminar|combate|previne|garante|comprovad)/i.test(text.replace(/não substituem avaliação ou acompanhamento profissional/gi, "")), "sem promessa de saúde");
  const sos = data.getCampaignPage("pet-medroso").products.find((entry) => entry.slug.endsWith("s-o-s"));
  assert.equal(sos.label, "S.O.S.");
  // todo "Como usar" vem do conteúdo oficial; sem álcool só afirmado como as fórmulas já afirmam
  for (const page of data.campaignPages) assert.ok(page.faq.some((item) => /álcool/i.test(item.question)) && page.faq.some((item) => /medicamento/i.test(item.question)));
});

test("imagens: a mesma arte do anúncio onde existe; sem arte = foto da Home / banner da linha recortado; troca por campo de dados", () => {
  for (const page of data.campaignPages) {
    assert.ok(exists(page.hero.src), `${page.slug}: ${page.hero.src}`);
    assert.ok(page.hero.alt.length > 10);
  }
  const bySlug = (slug) => data.getCampaignPage(slug).hero;
  assert.equal(bySlug("bebe-soninho").src, "/para/O1_Sono_Baby.jpg");
  assert.equal(bySlug("crianca-desacelerar").src, "/para/O1_Sono_Infantil.jpg");
  assert.equal(bySlug("pet-sozinho").src, "/para/Ad4_Pet.jpg");
  assert.equal(bySlug("pet-medroso").src, "/para/B_pet_ansiedade_sem_rotulo.jpg");
  assert.equal(bySlug("rotina").src, "/para/Ad2_Adulto.jpg");
  assert.equal(bySlug("pausa").src, "/para/B2_adulto_sensacao_ansiedade_sem_rotulo.jpg");
  assert.equal(bySlug("fim-do-dia").src, "/assets/home/hero/Hero.png");
  assert.equal(bySlug("pet-habitos").src, "/assets/home/linhas/Pet.png");
  assert.ok(bySlug("pet-habitos").scale > 1, "banner da linha recortado para esconder o texto");
});

test("fotos do Adulto: só o frasco (recorte por CSS); as demais linhas usam a foto limpa sem recorte", () => {
  for (const page of data.campaignPages) {
    for (const entry of page.products) {
      if (entry.slug.startsWith("adulto-")) {
        assert.ok(entry.crop, `${entry.slug}: recorte`);
        assert.ok(entry.crop.width <= 0.45 && entry.crop.height <= 0.7, "recorte estreito (sem molduras e frases)");
      } else {
        assert.equal(entry.crop, undefined, `${entry.slug}: foto limpa`);
      }
    }
  }
  const geometry = data.cropGeometry({ width: 0.4, height: 0.66, centerX: 0.48, top: 0.13 });
  assert.equal(Math.round(geometry.widthPercent), 250);
  assert.equal(Math.round(geometry.leftPercent), -70);
  assert.ok(geometry.topPercent < 0);
});

test("sem cloaking: página estática, igual para todos (nada lê cabeçalho, cookie, user-agent, referrer ou utm); noindex; fora do sitemap e do robots", () => {
  const page = read("src/app/para/[slug]/page.tsx");
  assert.ok(page.includes("export const dynamicParams = false") && page.includes("generateStaticParams"));
  assert.ok(!/headers\(|cookies\(|searchParams|userAgent|user-agent|referer|referrer|utm_|useSearchParams|navigator\./i.test(page.replace(/\/\*[\s\S]*?\*\//g, "")), "nada que varie por visitante");
  assert.ok(page.includes("index: false") && page.includes("follow: false"));
  for (const file of ["src/components/campaign/Gpt10Banner.tsx", "src/components/campaign/CampaignMarker.tsx"]) {
    const source = read(file);
    assert.ok(!/userAgent|document\.referrer|location\.search|utm_/i.test(source), `${file}: nada por origem`);
  }
  assert.ok(!read("src/app/sitemap.ts").includes("/para"), "fora do sitemap");
  assert.ok(!/\/para/.test(read("src/app/robots.ts")), "o robots.txt não bloqueia (o revisor precisa acessar)");
  const menus = ["src/components/layout/SiteFooter.tsx", "src/components/layout/MobileLineBar.tsx"].map((file) => (existsSync(new URL(`../${file}`, import.meta.url)) ? read(file) : ""));
  assert.ok(menus.every((source) => !source.includes("/para/")), "fora do menu e do rodapé");
});

test("estrutura da página: título, faixa GPT10, produtos com preço e Comprar, confiança, 3 perguntas, ver a linha completa", () => {
  const page = read("src/app/para/[slug]/page.tsx");
  const order = ["{page.title}", "<Gpt10Banner />", 'aria-label="Produtos"', "formatBRL(product.priceCents)", "<CampaignBuyButton", "<LineMiniCards />", 'data-testid="campanha-faq"', 'data-testid="campanha-ver-linha"'].map((part) => page.indexOf(part));
  assert.ok(order.every((index) => index > 0) && [...order].sort((a, b) => a - b).join() === order.join(), "ordem das seções");
  assert.ok(!page.includes("campanha-confianca") && !page.includes("Compre com tranquilidade"), "o bloco de confiança saiu: minicards das linhas no lugar");
  assert.equal(page.split('aria-label="Perguntas frequentes"').length - 1, 1, "um bloco só de perguntas");
  assert.ok(page.includes("products.length < 4") && page.includes("campanha-card-linha") && page.includes("Conheça a linha"), "sempre 4 cards: o 4º pode ser o card da linha");
  assert.equal(data.getCampaignPage("bebe-soninho").products.length, 3);
  const faqTexts = data.campaignPages.map((p) => p.faq.map((f) => f.answer).join(" ")).join(" ");
  assert.ok(faqTexts.includes("Frete grátis a partir de R$ 100,00") && faqTexts.includes("subsidia 25% do frete") && faqTexts.includes("Pix ou cartão"));
  assert.ok(page.includes("`/linha/${page.lineSlug}`"));
  const banner = read("src/components/campaign/Gpt10Banner.tsx");
  assert.ok(banner.includes("CAMPAIGN_GPT10.bannerText") && data.CAMPAIGN_GPT10.bannerText === "GPT10 aplicado: 10% na sua 1ª compra");
  const buy = read("src/components/campaign/CampaignBuyButton.tsx");
  assert.ok(buy.includes("addProduct({ productSlug, name, image })") && buy.includes('router.push("/checkout")'));
});

test("GPT10: marca a passagem por /para/*, aplica sozinho (uma vez, com sacola, sem outro cupom comercial, no prazo) e respeita a remoção", () => {
  const map = new Map();
  const storage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => void map.set(k, String(v)), removeItem: (k) => void map.delete(k) };
  const before = new Date("2026-10-23T12:00:00Z");

  assert.equal(gpt10.readGpt10(storage), null);
  assert.equal(gpt10.shouldAutoApplyGpt10({ state: null, hasCommercialCoupon: false, cartHasItems: true, now: before }), false);
  assert.equal(gpt10.markGpt10(storage, before), true);
  const state = gpt10.readGpt10(storage);
  assert.deepEqual({ code: state.code, removed: state.removed }, { code: "GPT10", removed: false });
  assert.equal(gpt10.shouldAutoApplyGpt10({ state, hasCommercialCoupon: false, cartHasItems: true, now: before }), true);
  assert.equal(gpt10.shouldAutoApplyGpt10({ state, hasCommercialCoupon: true, cartHasItems: true, now: before }), false, "já há cupom comercial (sem acumular)");
  assert.equal(gpt10.shouldAutoApplyGpt10({ state, hasCommercialCoupon: false, cartHasItems: false, now: before }), false, "sem sacola");

  gpt10.removeGpt10(storage);
  const removed = gpt10.readGpt10(storage);
  assert.equal(removed.removed, true);
  assert.equal(gpt10.shouldAutoApplyGpt10({ state: removed, hasCommercialCoupon: false, cartHasItems: true, now: before }), false, "o cliente removeu");
  assert.equal(gpt10.markGpt10(storage, before), true, "nova passagem por /para/* volta a aplicar");
  assert.equal(gpt10.readGpt10(storage).removed, false);

  // depois de 30/11/2026 23:59:59 BRT
  const after = new Date("2026-12-01T03:00:00Z");
  assert.equal(gpt10.isGpt10Open(new Date("2026-12-01T02:59:59Z")), true);
  assert.equal(gpt10.isGpt10Open(after), false);
  assert.equal(gpt10.markGpt10(storage, after), false);
  assert.equal(gpt10.shouldAutoApplyGpt10({ state: gpt10.readGpt10(storage), hasCommercialCoupon: false, cartHasItems: true, now: after }), false);

  gpt10.clearGpt10(storage);
  assert.equal(gpt10.readGpt10(storage), null);
  map.set(gpt10.GPT10_STORAGE_KEY, "{lixo");
  assert.equal(gpt10.readGpt10(storage), null);
  assert.equal(gpt10.markGpt10(null, before), false);
});

test("checkout e sacola: aplica o GPT10 pelo servidor, remover não reaplica, erro limpa o flag; a sacola avisa", () => {
  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("shouldAutoApplyGpt10({ state, hasCommercialCoupon: false, cartHasItems: items.length > 0 })"));
  assert.ok(checkout.includes('validateCommercialCoupon("GPT10", quote.totalCents)'), "valida no servidor (/api/coupons/validate)");
  assert.ok(checkout.includes('appliedCoupon?.code === "GPT10"') && checkout.includes("removeGpt10(window.localStorage)"));
  assert.ok(checkout.includes("clearGpt10(window.localStorage)") && checkout.includes("gpt10Tried"));
  const cart = read("src/app/carrinho/page.tsx");
  assert.ok(cart.includes("<Gpt10CartNote />"));
  assert.ok(read("src/components/campaign/Gpt10CartNote.tsx").includes("O desconto aparece no checkout e você pode removê-lo lá"));
});

test("eventos: a chegada em /para/* entra (origem e campanha como nas demais páginas) e o banner de cookies/captura de origem valem aqui", () => {
  assert.equal(ads.isPixelPath("/para/pausa"), true);
  const events = read("src/components/analytics/AnalyticsEvents.tsx");
  assert.ok(events.includes('if (first) void trackEvent("chegada")') && events.includes("isPixelPath(pathname)"));
  assert.ok(read("src/app/layout.tsx").includes("<AttributionCapture />") && read("src/app/layout.tsx").includes("<CookieBanner />"));
});

test("títulos reais confirmados e 2º uso do GPT10 com o mesmo e-mail mostra mensagem direta (400)", () => {
  const titles = {
    "pet-sozinho": "Pet fica sozinho em casa?", "pet-habitos": "Reparou nos hábitos do seu pet?", "pet-medroso": "Florais para cães e gatos",
    pausa: "Quando a mente quer pausa", "fim-do-dia": "Seu ritual para encerrar o dia", rotina: "Rotina estressante?",
    "bebe-soninho": "Hora do soninho", "crianca-desacelerar": "É hora de desacelerar",
  };
  for (const [slug, title] of Object.entries(titles)) {
    const p = data.getCampaignPage(slug);
    assert.equal(p.title, title);
    assert.equal(p.titleConfirmed, true);
  }
  const route = read("src/app/api/orders/create/route.ts");
  assert.ok(route.includes("class CouponAlreadyUsedError") && route.includes("Este cupom já foi usado neste e-mail."));
  assert.ok(route.includes("throw new CouponAlreadyUsedError()") && route.includes("error instanceof CouponAlreadyUsedError"));
});
