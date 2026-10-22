/*
 * Rodada 18 — topo das páginas de linha (eyebrow, h1 = nome da linha, 1 frase e logo os cards) e eventos do
 * Vercel Analytics (chegada, ver_produto, sacola, checkout) com origem e campanha.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ev = await import("../src/lib/analytics-events.ts");
const at = await import("../src/lib/attribution.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("linha: sem a seção superior antiga (título grande, chips, banner); topo = eyebrow + h1 (nome) + frase + cards", () => {
  const page = read("src/app/linha/[slug]/page.tsx").replace(/\r\n/g, "\n");
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1, "um único h1");
  assert.ok(!page.includes("HERO DA LINHA"));
  assert.ok(!/\} opções/.test(page), "sem o chip '10 opções'");
  assert.ok(!page.includes("Bio Florais · Desde 1997\n              </div>"), "sem o chip 'Bio Florais · Desde 1997'");
  assert.ok(!page.includes("Explore a linha") && !page.includes("{visual.headline}"), "sem o bloco 'Explore a linha / headline'");
  assert.ok(!page.includes("Linha Bio Florais ${line.name}"), "sem a imagem de banner da linha");
  const h1 = page.indexOf("<h1");
  const eyebrow = page.indexOf("visual?.eyebrow");
  const description = page.indexOf("visual?.description");
  const grid = page.indexOf("lg:grid-cols-6");
  assert.ok(eyebrow > 0 && eyebrow < h1 && h1 < description && description < grid, "ordem: eyebrow, h1, frase, cards");
  assert.match(page.slice(h1, h1 + 700), /\{line\.name\}/);
  // só o primeiro card (o que aparece sem rolar) tem prioridade
  assert.match(page, /priority=\{index === 0\}/);
  assert.equal((page.match(/\bpriority\b/g) ?? []).length, 1);
});

test("linha: metadata/SEO/JSON-LD/breadcrumb/og intactos e frases curtas", () => {
  const page = read("src/app/linha/[slug]/page.tsx");
  for (const part of ["generateMetadata", "LINE_SEO", "OG_IMAGES", "breadcrumbJsonLd(getSiteUrl()", "generateStaticParams"]) assert.ok(page.includes(part), part);
  const lines = [...page.matchAll(/description:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(lines.length >= 10);
  for (const text of lines) assert.ok(text.length <= 120, `${text.length}: ${text}`);
  // B2B e Home não foram tocadas pela rodada
  assert.ok(read("src/app/page.tsx").includes('id="topo"'));
});

test("eventos: origem = utm_source / utm_medium (ou referrer; 'direto' se vazio), campanha = utm_campaign; máx. 2 propriedades", () => {
  const cookie = (attr) => at.buildAttributionCookie({ utm_source: null, utm_medium: null, utm_campaign: null, referrer_domain: null, ...attr }, true).split(";")[0];
  assert.deepEqual(ev.eventProps(""), { origem: "direto", campanha: "nenhuma" });
  assert.deepEqual(ev.eventProps(cookie({ utm_source: "instagram", utm_medium: "organic", utm_campaign: "2110_rotina" })), { origem: "instagram / organic", campanha: "2110_rotina" });
  assert.deepEqual(ev.eventProps(cookie({ referrer_domain: "google.com" })), { origem: "google.com", campanha: "nenhuma" });
  assert.deepEqual(ev.eventProps(cookie({ utm_source: "chatgpt.com", utm_campaign: "ads" })), { origem: "chatgpt.com", campanha: "ads" });
  for (const props of [ev.eventProps(""), ev.eventProps(cookie({ utm_source: "a", utm_medium: "b", utm_campaign: "c", referrer_domain: "d.com" }))]) {
    assert.deepEqual(Object.keys(props), ["origem", "campanha"]);
  }
  assert.deepEqual([...ev.ANALYTICS_EVENTS], ["chegada", "ver_produto", "sacola", "checkout"]);
});

test("eventos: rotas e ligações (layout, carrinho), sem admin/vendedor e sem dado pessoal", () => {
  assert.equal(ev.pageEventFor("/produto/adulto-floral-em-gotas-sono"), "ver_produto");
  assert.equal(ev.pageEventFor("/produto/x/"), "ver_produto");
  assert.equal(ev.pageEventFor("/checkout"), "checkout");
  assert.equal(ev.pageEventFor("/b2b/checkout"), "checkout");
  for (const path of ["/", "/linha/adulto", "/checkout/pagamento", "/produto", "/admin/pedidos", "/b2b/painel"]) assert.equal(ev.pageEventFor(path), null, path);

  const layout = read("src/app/layout.tsx");
  assert.ok(layout.indexOf("<AttributionCapture />") < layout.indexOf("<AnalyticsEvents />"), "origem gravada antes do evento de chegada");
  assert.ok(layout.includes("<CookieBanner />") && layout.includes("<OppRefCapture />"));
  const component = read("src/components/analytics/AnalyticsEvents.tsx");
  assert.ok(component.includes("isPixelPath(pathname)") && component.includes("sessionStorage"));
  const cart = read("src/components/cart/CartProvider.tsx");
  assert.equal((cart.match(/trackEvent\("sacola"\)/g) ?? []).length, 2, "sacola em addProduct e addCombo");
  const lib = read("src/lib/analytics-events.ts");
  assert.ok(!/email|phone|cpf|cnpj|customer/i.test(lib.replace(/\/\*[\s\S]*?\*\//g, "")), "sem dado pessoal");
});
