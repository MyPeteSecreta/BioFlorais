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
