/*
 * Rodada 13 — SEO do B2C (só metadata): canonical www sem query, títulos/descrições/og por linha e produto, sitemap único,
 * robots em www, Product JSON-LD (InStock) e um único H1 na Home. Regras "não quebrar" (query string, referrer, tags de
 * terceiros, URLs de destino, noindex do B2B, banner de cookies e Image Tag).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const seo = await import("../src/lib/seo/metadata.ts");
const { getSiteUrl } = await import("../src/lib/seo/site-url.ts");
const { bioLines, bioProducts, getProduct } = await import("../src/lib/catalog/bio-products.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

test("SEO-03: URL pública sempre www (mesmo com a variável da Vercel sem www); sem barra final", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    assert.equal(getSiteUrl(), "https://www.bioflorais.com.br");
    process.env.NEXT_PUBLIC_SITE_URL = "https://bioflorais.com.br";
    assert.equal(getSiteUrl(), "https://www.bioflorais.com.br", "apex -> www");
    process.env.NEXT_PUBLIC_SITE_URL = "https://bioflorais.com.br/";
    assert.equal(getSiteUrl(), "https://www.bioflorais.com.br");
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.bioflorais.com.br/";
    assert.equal(getSiteUrl(), "https://www.bioflorais.com.br");
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    assert.equal(getSiteUrl(), "http://localhost:3000", "ambientes locais não mudam");
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
});

test("SEO-03: canonical relativo (resolve em www pelo metadataBase), sem query, no próprio path", () => {
  assert.ok(read("src/app/layout.tsx").includes("metadataBase: new URL(getSiteUrl())"));
  assert.ok(read("src/app/page.tsx").includes('canonical: "/"') && !/canonical:\s*"https?:/.test(read("src/app/page.tsx")));
  assert.ok(read("src/app/sobre/page.tsx").includes('canonical: "/sobre"'));
  assert.ok(read("src/app/linha/[slug]/page.tsx").includes("canonical: `/linha/${slug}`"));
  assert.ok(read("src/app/produto/[slug]/page.tsx").includes("canonical: `/produto/${product.slug}`"));
  // nenhum canonical carrega query string
  for (const file of ["src/app/page.tsx", "src/app/sobre/page.tsx", "src/app/linha/[slug]/page.tsx", "src/app/produto/[slug]/page.tsx"]) {
    assert.ok(!/canonical:[^\n]*\?/.test(read(file)), file);
  }
});

test("SEO-02: títulos e descrições aprovados das 3 linhas com anúncio; demais linhas no mesmo padrão; og:image em public/og", () => {
  assert.equal(seo.LINE_SEO.adulto.title, "Florais Adulto sem álcool | Bio Florais");
  assert.equal(seo.LINE_SEO.adulto.description, "Essências florais brasileiras em gotas, sem álcool, para diferentes momentos da rotina. Desde 1997.");
  assert.equal(seo.LINE_SEO.infantil.title, "Florais Infantis sem álcool | Bio Florais");
  assert.equal(seo.LINE_SEO.infantil.description, "Linhas Infantil, Baby, Kids e Teen em gotas sem álcool, para cada fase da infância. Desde 1997.");
  assert.equal(seo.LINE_SEO.pet.title, "Florais para cães e gatos | Bio Florais Pet");
  assert.equal(seo.LINE_SEO.pet.description, "Florais em gotas sem álcool para a rotina do seu pet: viagens, fogos, mudanças e novidades em casa.");

  // toda linha do catálogo tem SEO próprio, título único, sem termo de condição/cura/tratamento
  const titles = new Set();
  for (const line of bioLines) {
    const entry = seo.LINE_SEO[line.slug];
    assert.ok(entry, line.slug);
    titles.add(entry.title);
    assert.ok(entry.title.length <= 70 && entry.description.length <= 170, line.slug);
    assert.ok(!/ansiedade|depress|p[âa]nico|trata|cura|curar|doen[çc]a|sintoma|medo|tristeza|stress|estresse/i.test(`${entry.title} ${entry.description}`), `${line.slug}: sem promessa de saúde`);
  }
  assert.equal(titles.size, bioLines.length);

  // og:image: arquivos copiados para public/og, 1200x630, URLs absolutas pelo metadataBase (www)
  for (const file of ["og-home", "og-adulto", "og-infantil", "og-pet"]) assert.ok(existsSync(new URL(`../public/og/${file}.jpg`, import.meta.url)), file);
  assert.deepEqual(seo.OG_IMAGE_SIZE, { width: 1200, height: 630 });
  for (const entry of Object.values(seo.LINE_SEO)) assert.ok(entry.ogImage.startsWith("/og/og-") && existsSync(new URL(`../public${entry.ogImage}`, import.meta.url)));
  assert.equal(seo.LINE_SEO.adulto.ogImage, "/og/og-adulto.jpg");
  assert.equal(seo.LINE_SEO.infantil.ogImage, "/og/og-infantil.jpg");
  assert.equal(seo.LINE_SEO.pet.ogImage, "/og/og-pet.jpg");
  const line = read("src/app/linha/[slug]/page.tsx");
  assert.ok(line.includes("export async function generateMetadata") && line.includes("params: Promise<{ slug: string }>") && line.includes("if (!line) notFound()"));
  assert.ok(line.includes("summary_large_image") && line.includes("openGraph"));
  assert.ok(read("src/app/layout.tsx").includes("OG_IMAGES.home") && read("src/app/page.tsx").includes("OG_IMAGES.home"));
});

test("SEO-02: produto — generateMetadata com await params, notFound, imagem da galeria real, descrições distintas", () => {
  const page = read("src/app/produto/[slug]/page.tsx");
  assert.ok(page.includes("export async function generateMetadata") && page.includes("const { slug: rawSlug } = await params;"));
  assert.ok(page.includes("normalizeProductSlug(rawSlug)") && page.includes("if (!product) notFound();"));
  assert.ok(page.includes("getProductGallery(product)[0]") && !/images:\s*\[\{\s*url:\s*product\.image/.test(page), "nunca o campo vazio product.image");
  assert.ok(page.includes("getProductEditorialContent(product.slug)?.about") && page.includes("summary_large_image"));

  assert.equal(seo.normalizeProductSlug("cosmeticos-pet-shampoo-agressividade-5l"), "cosmeticos-pet-shampoo-agressividade");
  assert.equal(seo.normalizeProductSlug("cosmeticos-pet-perfume-spray-ansiedade-500ml"), "cosmeticos-pet-perfume-spray-ansiedade");
  assert.equal(seo.normalizeProductSlug("adulto-floral-em-gotas-rescue"), "adulto-floral-em-gotas-rescue");

  const slugs = ["adulto-floral-em-gotas-rescue", "pet-floral-em-gotas-ansiedade", "cosmeticos-shampoo-uso-diario", "baby-floral-em-gotas-sono", "home-care-aromatizador-spray-bem-estar"];
  const descriptions = new Set();
  for (const slug of slugs) {
    const product = getProduct(slug);
    assert.ok(product, slug);
    const text = seo.productDescription({ name: product.name, content: product.content, line: product.line, category: product.category }, null);
    descriptions.add(text);
    assert.ok(text.length <= 160, slug);
  }
  assert.equal(descriptions.size, slugs.length, "descrições distintas");
  // rótulo "Descrição" do texto editorial não vaza; corte em palavra inteira
  assert.ok(!/^descri/i.test(seo.productDescription({ name: "X" }, "Descrição Um texto editorial longo sobre o produto, com várias palavras, que precisa ser cortado em uma palavra inteira para caber na descrição curta da página.")));
  assert.ok(seo.trimDescription("palavra ".repeat(60)).endsWith("…"));
});

test("SEO-01: sitemap único (sem generateSitemaps/id), com produtos, em www; robots aponta para o sitemap em www", () => {
  const sitemap = read("src/app/sitemap.ts");
  assert.ok(!sitemap.includes("generateSitemaps(") && !/\bid\b\s*[:=]=?=?\s*[01]/.test(sitemap.replace(/\/\*[\s\S]*?\*\//g, "")), "sem segmentação nem filtro de id");
  assert.equal((sitemap.match(/export default function sitemap\(\)/g) ?? []).length, 1);
  assert.ok(sitemap.includes("getSiteUrl()") && sitemap.includes("/produto/${product.slug}") && sitemap.includes("/linha/${line.slug}"));
  const robots = read("src/app/robots.ts");
  assert.ok(robots.includes("getSiteUrl()") && robots.includes("${siteUrl}/sitemap.xml") && !/https?:\/\/bioflorais\.com\.br/.test(robots));
  assert.ok(read("src/app/robots.ts").includes('disallow: ["/admin", "/api", "/carrinho", "/checkout"]'));
  // produtos públicos: todos menos as apresentações -5l/-500ml
  const expected = bioProducts.filter((product) => !product.slug.endsWith("-5l") && !product.slug.endsWith("-500ml")).length;
  assert.ok(expected > 200);
});

test("SEO-04: Product JSON-LD com Offer BRL e InStock; sem offers quando não há preço; \"<\" escapado", () => {
  const page = read("src/app/produto/[slug]/page.tsx");
  assert.ok(page.includes('type="application/ld+json"') && page.includes('"@type": "Product"'));
  for (const part of ['"@type": "Offer"', 'priceCurrency: "BRL"', "(product.priceCents / 100).toFixed(2)", 'availability: "https://schema.org/InStock"', 'brand: { "@type": "Brand", name: "Bio Florais" }', "sku: product.slug"]) {
    assert.ok(page.includes(part), part);
  }
  assert.ok(page.includes("product.priceCents && product.priceCents > 0"), "sem preço = sem Offer");
  assert.ok(page.includes("jsonLdString(productJsonLd)") && read("src/lib/seo/structured-data.ts").includes("u003c"), "\"<\" escapado via jsonLdString");
  assert.ok(page.includes("gallery.slice(0, 5).map(absolute)"), "imagem da galeria real, absoluta");
});

test("H1-01: um único <h1> na Home (o mobile virou <p> com as mesmas classes)", () => {
  const page = read("src/app/page.tsx");
  assert.equal((page.match(/<h1[\s>]/g) ?? []).length, 1, "um <h1> no arquivo");
  assert.ok(page.includes('<p className="absolute bottom-4 left-4 max-w-[245px] font-serif text-[27px] font-semibold leading-[0.95] tracking-[-0.04em] text-[#422347]">'));
  assert.ok(page.includes("Equilíbrio para viver melhor cada dia."));
});

test("NÃO QUEBRAR: query string, referrer, tags de terceiros, URLs de destino, B2B noindex, banner e Image Tag", () => {
  const sources = [...walk("src/app"), ...walk("src/components"), ...walk("src/lib")].filter((file) => /\.(tsx|ts)$/.test(file));
  const all = sources.map((file) => read(file));

  // nunca Referrer-Policy no-referrer (a OpenAI recusa o evento de compra sem Referer)
  assert.ok(!all.some((source) => /referrerPolicy\s*[=:]\s*\{?\s*["']no-referrer/i.test(source) || /Referrer-Policy[^\n]*no-referrer/i.test(source)));
  for (const file of ["next.config.ts", "src/middleware.ts", "vercel.json"]) assert.ok(!/Referrer-Policy/i.test(read(file)), file);
  // nenhuma tag de terceiros nova (GTM, gtag, pixel JS)
  assert.ok(!all.some((source) => /googletagmanager|gtag\(|fbq\(|oaiq\(|bzrcdn\.openai/i.test(source)));
  // query string preservada nos redirects
  assert.ok(read("src/app/parceiros/page.tsx").includes("withForwardedParams(storePath, query)"));
  assert.equal((read("src/app/produto/[slug]/page.tsx").match(/forwardQuery\(/g) ?? []).length, 2);
  assert.ok(read("src/middleware.ts").includes("withLegacyQuery(destination, search)"));
  // URLs de destino dos anúncios continuam existindo
  for (const route of ["src/app/page.tsx", "src/app/linha/[slug]/page.tsx", "src/app/parceiros/page.tsx"]) assert.ok(existsSync(new URL(`../${route}`, import.meta.url)), route);
  assert.ok(bioLines.some((line) => line.slug === "adulto") && bioLines.some((line) => line.slug === "infantil") && bioLines.some((line) => line.slug === "pet"));
  // B2B noindex, banner de cookies e Image Tag intactos
  assert.ok(read("src/app/b2b/layout.tsx").includes("index: false"));
  assert.ok(read("src/app/layout.tsx").includes("<CookieBanner />") && read("src/app/layout.tsx").includes("<OppRefCapture />"));
  assert.ok(read("src/components/consent/AdsPurchaseTag.tsx").includes("onLoad={") && read("src/app/api/orders/ads-tag/route.ts").includes("claimAdsTag"));
});
