/*
 * Rodada 14 — SEO Fase 2: redirects 301 do site antigo (URL-01, query preservada, sem loop, URLs atuais intactas),
 * dados estruturados (SCHEMA-01/02/03), alt descritivo (IMG-01), lazy (IMG-02) e CONT-01 (Rescue).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resolveLegacyRedirect, withLegacyQuery } = await import("../src/lib/seo/legacy-redirects.ts");
const data = await import("../src/lib/seo/legacy-redirects.data.ts");
const sd = await import("../src/lib/seo/structured-data.ts");
const { bioLines, bioProducts, getProduct } = await import("../src/lib/catalog/bio-products.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const pathOf = (destination) => destination.split("#")[0];

test("URL-01: casos conhecidos e regras genéricas", () => {
  assert.equal(resolveLegacyRedirect("/produto/sono"), "/produto/adulto-floral-em-gotas-sono");
  assert.equal(resolveLegacyRedirect("/categoria-produto/floral"), "/#linhas");
  assert.equal(resolveLegacyRedirect("/categoria/9068226.html"), "/linha/cosmeticos-pet");
  assert.equal(resolveLegacyRedirect("/None-qualquer"), "/");
  assert.equal(resolveLegacyRedirect("/categoria/None-x"), "/");
  assert.equal(resolveLegacyRedirect("/produto-tag/qualquer"), "/");
  assert.equal(resolveLegacyRedirect("/produto-etiqueta/pet"), "/linha/pet");
  assert.equal(resolveLegacyRedirect("/categoria-produto/kids"), "/linha/kids");
  assert.equal(
    resolveLegacyRedirect("/aceitando-um-novo-animal-31ml"),
    "/produto/pet-floral-em-gotas-aceitando-um-novo-animal"
  );
});

test("URL-01: URLs atuais nunca são tocadas", () => {
  for (const path of ["/", "/parceiros", "/b2b/login", "/acompanhe/abc", "/checkout", "/api/x", "/linha/adulto", "/linha/infantil", "/linha/pet", "/frete-e-entrega", "/trocas-e-devolucoes", "/cookies"]) {
    assert.equal(resolveLegacyRedirect(path), null, path);
  }
  for (const product of bioProducts) {
    assert.equal(resolveLegacyRedirect(`/produto/${product.slug}`), null, product.slug);
  }
  for (const line of bioLines) {
    assert.equal(resolveLegacyRedirect(`/linha/${line.slug}`), null, line.slug);
  }
});

test("URL-01: nunca loop — todo destino é uma URL atual (resolver(destino) === null)", () => {
  for (const [from, to] of data.LEGACY_EXACT_ENTRIES) {
    assert.equal(resolveLegacyRedirect(pathOf(to)), null, `${from} -> ${to}`);
  }
  const samples = [
    "/fa-sensacao-de-ansiedade", "/fa-sensacao-de-medo", "/fk-sono", "/fb-colica", "/produto/produto-que-nao-existe",
    "/produto/adulto-algo-inexistente-31ml", "/ansiedade-floral-pet-31ml", "/None-x", "/categoria-produto/shampoo",
    "/produto-tag/x", "/produto/cosmeticos-pet-xyz", "/aceitando-um-novo-animal", "/aceitando-um-novo-animal-31ml-2",
  ];
  for (const sample of samples) {
    const destination = resolveLegacyRedirect(sample);
    if (destination) assert.equal(resolveLegacyRedirect(pathOf(destination)), null, `${sample} -> ${destination}`);
  }
  for (const [pattern, destination] of data.LEGACY_CATEGORY_KEYWORDS) {
    assert.ok(pattern instanceof RegExp);
    assert.equal(resolveLegacyRedirect(pathOf(destination)), null, destination);
  }
});

test("URL-01: /fa-sensacao-de-* casa pelo nome do produto (ou cai na linha)", () => {
  const destination = resolveLegacyRedirect("/fa-sensacao-de-ansiedade");
  assert.ok(destination && (destination.startsWith("/produto/") || destination === "/linha/adulto"), destination);
  if (destination.startsWith("/produto/")) assert.ok(getProduct(destination.replace("/produto/", "")));
  assert.equal(resolveLegacyRedirect("/fa-qualquer-coisa-inexistente"), "/linha/adulto");
});

test("URL-01: query string inteira (utm_*, oppref) é preservada", () => {
  assert.equal(withLegacyQuery("/produto/x", "?utm_source=x"), "/produto/x?utm_source=x");
  assert.equal(withLegacyQuery("/produto/x", "?utm_source=x&utm_campaign=y&oppref=abc"), "/produto/x?utm_source=x&utm_campaign=y&oppref=abc");
  assert.equal(withLegacyQuery("/#linhas", "?utm_source=x"), "/?utm_source=x#linhas");
  assert.equal(withLegacyQuery("/", ""), "/");
});

test("URL-01: middleware é 301, usa o resolver e ignora api/_next", () => {
  const source = read("src/middleware.ts");
  assert.match(source, /NextResponse\.redirect\(target, 301\)/);
  assert.match(source, /resolveLegacyRedirect/);
  assert.match(source, /withLegacyQuery\(destination, search\)/);
  assert.match(source, /\(\?!api\|_next\/static/);
  assert.ok(!/no-referrer/i.test(source));
});

test("SCHEMA-01: shippingDetails e hasMerchantReturnPolicy usam os textos das políticas, sem prazo inventado", () => {
  const shipping = sd.shippingDetailsJsonLd(5000);
  assert.equal(shipping["@type"], "OfferShippingDetails");
  assert.equal(shipping.deliveryTime, undefined);
  assert.equal(shipping.shippingRate, undefined, "abaixo de R$ 100 não afirma frete zero");
  assert.equal(sd.shippingDetailsJsonLd(12000).shippingRate.value, "0.00");
  const freight = read("src/app/frete-e-entrega/page.tsx");
  assert.match(freight, /R\$ 100,00/);
  const returns = sd.merchantReturnPolicyJsonLd("https://www.bioflorais.com.br");
  assert.equal(returns.merchantReturnDays, 7);
  assert.equal(returns.merchantReturnLink, "https://www.bioflorais.com.br/trocas-e-devolucoes");
  assert.match(read("src/app/trocas-e-devolucoes/page.tsx"), /7 \(sete\) dias/);
  const page = read("src/app/produto/[slug]/page.tsx");
  assert.match(page, /shippingDetails: shippingDetailsJsonLd/);
  assert.match(page, /hasMerchantReturnPolicy: merchantReturnPolicyJsonLd/);
});

test("SCHEMA-02: BreadcrumbList em linha e produto", () => {
  const ld = sd.breadcrumbJsonLd("https://www.bioflorais.com.br", [
    { name: "Início", path: "/" },
    { name: "Adulto", path: "/linha/adulto" },
  ]);
  assert.equal(ld["@type"], "BreadcrumbList");
  assert.equal(ld.itemListElement[0].item, "https://www.bioflorais.com.br");
  assert.equal(ld.itemListElement[1].item, "https://www.bioflorais.com.br/linha/adulto");
  assert.equal(ld.itemListElement[1].position, 2);
  assert.match(read("src/app/produto/[slug]/page.tsx"), /breadcrumbJsonLd\(siteUrl/);
  assert.match(read("src/app/linha/[slug]/page.tsx"), /breadcrumbJsonLd\(getSiteUrl\(\)/);
});

test("SCHEMA-03: Organization/WebSite no layout (site-wide), não mais só na Home", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /organizationJsonLd\(getSiteUrl\(\)\)/);
  assert.match(layout, /websiteJsonLd\(getSiteUrl\(\)\)/);
  assert.ok(!/organizationJsonLd/.test(read("src/app/page.tsx")));
  const org = sd.organizationJsonLd("https://www.bioflorais.com.br");
  assert.equal(org["@type"], "Organization");
  assert.ok(org.sameAs.every((url) => url.includes("instagram.com")));
  assert.ok(!sd.jsonLdString({ a: "</script>" }).includes("</script>"));
});

test("IMG-01/IMG-02: alt descritivo sem promessa de saúde; só o herói tem priority", () => {
  assert.equal(sd.imageAlt({ name: "Sono", lineName: "Adulto", category: "floral" }), "Floral Bio Florais – Sono – Adulto");
  assert.equal(sd.imageAlt({ name: "Shampoo Pet", lineName: "Cosméticos Pet", category: "cosmeticos" }), "Bio Florais – Shampoo Pet – Cosméticos Pet");
  assert.ok(!/cura|trata|elimina/i.test(sd.imageAlt({ name: "Ansiedade", lineName: "Adulto" })));
  const line = read("src/app/linha/[slug]/page.tsx");
  assert.equal((line.match(/\bpriority\b/g) ?? []).length, 1, "linha: priority só no herói");
  assert.match(read("src/components/product/ProductGallery.tsx"), /alt=\{`\$\{productName\} – foto/);
});

test("CONT-01: Rescue sem o texto estrangeiro e com 'tranquilidade'", () => {
  const content = read("src/lib/content/product-content.ts");
  assert.ok(!/Retten Sauvetage/.test(content));
  const rescue = content.split("\n").find((line) => line.includes("Composto floral de emergência"));
  assert.ok(rescue && /tranquilidade interior/.test(rescue) && !/tranqüilidade interior/.test(rescue));
});

test("NÃO QUEBRAR: sem no-referrer, sem tag de terceiros nova, banner e Image Tag intactos", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /<CookieBanner \/>/);
  assert.match(layout, /<OppRefCapture \/>/);
  assert.ok(!/no-referrer/i.test(layout));
  assert.ok(!/googletagmanager|connect\.facebook|fbevents/i.test(layout));
});

// ---- Rodada 14b ----

test("14b-a) floral de ambiente Pet (bio-pet / eco-beauty) vai para Cosméticos Pet; its-blossom continua em Home Care", () => {
  const expected = {
    "sos-bio-pet-250ml": "rescue-sos",
    "ansiedade-bio-pet-250ml": "ansiedade",
    "ansiedade-eco-beauty-250ml": "ansiedade",
    "tristeza-e-depressao-bio-pet-250ml": "tristeza-e-depressao",
    "agressividade-bio-pet-250ml": "agressividade",
    "adestramento-bio-pet-250ml": "adestramento",
    "filhotes-bio-pet-250ml": "filhotes",
  };
  for (const [suffix, theme] of Object.entries(expected)) {
    const destination = resolveLegacyRedirect(`/produto/floral-de-ambiente-${suffix}`);
    assert.equal(destination, `/produto/cosmeticos-pet-floral-de-ambiente-${theme}`, suffix);
    assert.ok(getProduct(destination.replace("/produto/", "")), `${destination} existe`);
    assert.equal(resolveLegacyRedirect(destination), null);
  }
  assert.equal(resolveLegacyRedirect("/produto/floral-de-ambiente-medo-bio-pet-250ml"), "/linha/cosmeticos-pet", "sem correspondência");
  assert.equal(resolveLegacyRedirect("/produto/floral-de-ambiente-limpeza-e-protecao-its-blossom-240ml"), "/produto/home-care-aromatizador-spray-limpeza-e-protecao");
  assert.equal(resolveLegacyRedirect("/floral-de-ambiente-bem-estar-240ml"), "/produto/home-care-aromatizador-spray-bem-estar");
});

test("14b-b) /linha-humana, /shop, /shop/page/*, categorias de cosmético", () => {
  assert.equal(resolveLegacyRedirect("/linha-humana"), "/linha/cosmeticos");
  assert.equal(resolveLegacyRedirect("/linha-humana/"), "/linha/cosmeticos");
  assert.equal(resolveLegacyRedirect("/shop"), "/");
  assert.equal(resolveLegacyRedirect("/shop/page/2"), "/");
  assert.equal(resolveLegacyRedirect("/categoria-produto/cosmetico/linha-humana/"), "/linha/cosmeticos");
  assert.equal(resolveLegacyRedirect("/categoria-produto/cosmetico/linha-humana/shampoo"), "/linha/cosmeticos");
  assert.equal(resolveLegacyRedirect("/categoria-produto/cosmetico/linha-pet/"), "/linha/cosmeticos-pet");
  assert.equal(resolveLegacyRedirect("/categoria-produto/cosmetico/linha-pet/perfume"), "/linha/cosmeticos-pet");
});

test("14b-c) redirect remove só add-to-cart e srsltid; utm_*, oppref e o resto ficam", () => {
  assert.equal(
    withLegacyQuery("/linha/pet", "?add-to-cart=12&utm_source=x&srsltid=AfmB&oppref=abc&foo=bar"),
    "/linha/pet?utm_source=x&oppref=abc&foo=bar"
  );
  assert.equal(withLegacyQuery("/linha/pet", "?add-to-cart=12"), "/linha/pet");
  assert.equal(withLegacyQuery("/linha/pet", "?SRSLTID=z&utm_campaign=c"), "/linha/pet?utm_campaign=c");
  assert.equal(withLegacyQuery("/#linhas", "?srsltid=z&utm_medium=m"), "/?utm_medium=m#linhas");
  assert.equal(withLegacyQuery("/x", "?utm_source=x&utm_campaign=y"), "/x?utm_source=x&utm_campaign=y");
});

test("14b-d) Grandes Animais -> /linha/pet; produtos atuais continuam intactos", () => {
  assert.equal(resolveLegacyRedirect("/categoria-produto/floral/linha-grandes-animais/"), "/linha/pet");
  assert.equal(resolveLegacyRedirect("/categoria-produto/floral/linha-grandes-animais/ansiedade"), "/linha/pet");
  assert.equal(resolveLegacyRedirect("/produto/floral-grandes-animais-ansiedade-31ml"), "/linha/pet");
  assert.equal(resolveLegacyRedirect("/floral-grandes-animais-cavalos"), "/linha/pet");
  assert.equal(resolveLegacyRedirect("/linha/pet"), null);
});

test("14b) URLs de anúncio intactas (com query) e linhas geradas estaticamente (PERF-01)", () => {
  for (const path of ["/", "/linha/adulto", "/linha/infantil", "/linha/pet", "/parceiros"]) {
    assert.equal(resolveLegacyRedirect(path), null, path);
  }
  const line = read("src/app/linha/[slug]/page.tsx");
  assert.match(line, /export function generateStaticParams\(\)/);
  assert.match(line, /bioLines\.map\(\(line\) => \(\{ slug: line\.slug \}\)\)/);
  for (const file of ["src/app/page.tsx", "src/app/linha/[slug]/page.tsx"]) {
    assert.match(read(file), /fetchPriority="high"/, file);
  }
  assert.equal((read("src/app/linha/[slug]/page.tsx").match(/\bpriority\b/g) ?? []).length, 1, "só o herói tem priority");
});

// ---- Rodada 16: banner de cookies discreto ----

test("R16) banner: texto curto sem citar anúncios, Saiba mais -> /cookies, 3 botões iguais, detalhes só em Configurar", () => {
  const banner = read("src/components/consent/CookieBanner.tsx");
  const text = banner.replace(/\s+/g, " ");
  assert.ok(text.includes("Usamos cookies para o site funcionar e melhorar sua experiência."));
  assert.match(banner, /href="\/cookies"[^>]*>\s*Saiba mais/);
  // 1ª camada (fora de "settings") não cita anúncios, métricas nem rastreamento
  const firstLayer = banner.slice(banner.indexOf("{!settings && ("), banner.indexOf("{settings && ("));
  assert.ok(!/an[úu]ncio|m[ée]trica|rastre|marketing|campanha/i.test(firstLayer));
  for (const phrase of ["Para o site funcionar.", "Para entender como o site é usado.", "Para medir nossas campanhas."]) assert.ok(banner.includes(phrase), phrase);
  assert.ok(banner.includes('href="/privacidade"') && banner.includes('href="/cookies"'));
  // mesmo destaque: uma única classe para todos os botões de escolha; padrão recusado (marketing falso até o aceite)
  assert.ok((banner.match(/<button type="button" className=\{button\}/g) ?? []).length >= 6);
  assert.match(banner, /useState\(false\);\s*\n\s*\n?\s*useEffect|const \[marketing, setMarketing\] = useState\(false\)/);
});
