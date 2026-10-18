/*
 * Rodada 12 — Pixel do ChatGPT Ads (pedido técnico, testes 1 a 6): só com aceite de marketing, sem dado pessoal,
 * order_created uma vez por pedido pago (centavos), fora do admin/área do vendedor, query string preservada,
 * políticas atualizadas. Fase 2 (API de Conversões) não entra.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const pixel = await import("../src/lib/pixel.ts");
const consent = await import("../src/lib/consent.ts");
const { forwardQuery } = await import("../src/lib/forward-query.ts");
const { loadPurchaseEvent } = await import("../src/lib/pixel-event.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => void map.set(key, String(value)), map };
}

/** Ambiente falso: registra chamadas de oaiq, scripts injetados e cookies. */
function fakeEnv(storage = memoryStorage()) {
  const scripts = [];
  const cookies = [];
  const doc = {
    createElement: () => ({}),
    head: { appendChild: (node) => scripts.push(node) },
    set cookie(value) {
      cookies.push(value);
    },
    get cookie() {
      return "";
    },
  };
  const win = {};
  return { env: { win, doc, storage, hostname: "www.bioflorais.com.br" }, scripts, cookies, calls: () => (win.oaiq?.q ?? []).map((args) => args), win };
}

const EVENT = {
  eventId: "b2c_11111111-1111-4111-8111-111111111111",
  amountCents: 25870,
  contents: [
    { id: "adulto-floral-em-gotas-rescue", name: "Floral Rescue · Adulto · 31 ml", quantity: 2 },
    { id: "adulto-floral-em-gotas-sono", name: "Floral Sono · Adulto · 31 ml", quantity: 1 },
  ],
};

test("1) sem aceite de marketing: nenhum script, nenhuma chamada oaiq, nenhum cookie; padrão é RECUSADO", () => {
  const { env, scripts, calls, win } = fakeEnv();
  assert.equal(consent.readConsent(env.storage), null, "sem escolha = banner, nada de marketing");
  assert.equal(pixel.enablePixel(env), false);
  assert.equal(scripts.length, 0);
  assert.equal(win.oaiq, undefined);
  assert.deepEqual(calls(), []);

  // escolheu RECUSAR
  consent.writeConsent(env.storage, false);
  assert.equal(pixel.enablePixel(env), false);
  assert.equal(scripts.length, 0);
  // valor corrompido no storage = sem consentimento
  env.storage.setItem(consent.CONSENT_STORAGE_KEY, "{lixo");
  assert.equal(consent.hasMarketingConsent(env.storage), false);
  assert.equal(pixel.trackPurchaseOnce(env, EVENT), "no-consent");
});

test("2) com aceite: consent false -> init -> consent true; script carrega UMA vez; init sem objeto user", () => {
  const { env, scripts, calls } = fakeEnv();
  consent.writeConsent(env.storage, true);
  assert.equal(pixel.enablePixel(env), true);
  assert.equal(pixel.enablePixel(env), true, "idempotente");

  assert.equal(scripts.length, 1, "um único script");
  assert.equal(scripts[0].src, "https://bzrcdn.openai.com/sdk/oaiq.min.js");
  assert.equal(scripts[0].async, true);

  const [first, second, third, fourth] = calls();
  assert.deepEqual(first, ["consent", false], "consent false ANTES do init");
  assert.deepEqual(second, ["init", { pixelId: "C43h1qwNBKW7o7E9hgXwh9" }]);
  assert.deepEqual(third, ["consent", true]);
  assert.deepEqual(fourth, ["consent", true]);
  assert.equal(calls().filter((args) => args[0] === "init").length, 1, "init uma vez só");
  assert.ok(!("user" in second[1]));
  assert.ok(!JSON.stringify(calls()).includes("sha256"));
});

test("5) retirar o consentimento: oaiq('consent', false) e cookies __oppref/__obref apagados; não saem mais eventos", () => {
  const { env, calls, cookies } = fakeEnv();
  consent.writeConsent(env.storage, true);
  pixel.enablePixel(env);
  assert.equal(pixel.trackPurchaseOnce(env, EVENT), "sent");

  consent.writeConsent(env.storage, false);
  pixel.disablePixel(env);
  const last = calls().at(-1);
  assert.deepEqual(last, ["consent", false]);
  assert.ok(cookies.some((cookie) => cookie.startsWith("__oppref=;") && cookie.includes("1970")));
  assert.ok(cookies.some((cookie) => cookie.startsWith("__obref=;") && cookie.includes("1970")));
  assert.ok(cookies.some((cookie) => cookie.includes("domain=bioflorais.com.br")), "também no domínio pai");

  const other = { ...EVENT, eventId: "b2c_22222222-2222-4222-8222-222222222222" };
  assert.equal(pixel.trackPurchaseOnce(env, other), "no-consent", "sem consentimento não sai evento");
  assert.equal(env.storage.getItem("oaiq:sent:" + other.eventId), null, "e não marca como enviado");

  // nunca carregado: desligar não chama oaiq
  const clean = fakeEnv();
  pixel.disablePixel(clean.env);
  assert.equal(clean.win.oaiq, undefined);
});

test("4) order_created: centavos inteiros, BRL, contents só com campos documentados, event_id, opt_out; sem user/sha256; UMA vez", () => {
  const { env, calls } = fakeEnv();
  consent.writeConsent(env.storage, true);
  pixel.enablePixel(env);

  assert.equal(pixel.trackPurchaseOnce(env, EVENT), "sent");
  assert.equal(pixel.trackPurchaseOnce(env, EVENT), "duplicate", "recarregar não envia de novo");
  const again = fakeEnv(env.storage); // outra aba/recarga com o mesmo localStorage
  pixel.enablePixel(again.env);
  assert.equal(pixel.trackPurchaseOnce(again.env, EVENT), "duplicate");

  const measures = calls().filter((args) => args[0] === "measure");
  assert.equal(measures.length, 1);
  const [, name, data, options] = measures[0];
  assert.equal(name, "order_created");
  assert.deepEqual(data, {
    type: "contents",
    amount: 25870,
    currency: "BRL",
    contents: [
      { id: "adulto-floral-em-gotas-rescue", name: "Floral Rescue · Adulto · 31 ml", content_type: "product", quantity: 2 },
      { id: "adulto-floral-em-gotas-sono", name: "Floral Sono · Adulto · 31 ml", content_type: "product", quantity: 1 },
    ],
  });
  assert.ok(Number.isInteger(data.amount));
  assert.deepEqual(options, { event_id: EVENT.eventId, opt_out: true });
  for (const item of data.contents) assert.deepEqual(Object.keys(item).sort(), ["content_type", "id", "name", "quantity"]);
  const serialized = JSON.stringify(measures[0]);
  assert.ok(!/sha256|"user"|email|phone|cpf|cnpj|external_id/i.test(serialized));

  // valores inválidos
  assert.equal(pixel.trackPurchaseOnce(env, { ...EVENT, eventId: "b2c_x", amountCents: 0 }), "invalid");
  assert.equal(pixel.trackPurchaseOnce(env, { ...EVENT, eventId: "", amountCents: 100 }), "invalid");
  assert.equal(pixel.buildOrderCreatedArgs({ ...EVENT, amountCents: 258.7 })[2].amount, 259, "sempre inteiro");
  assert.equal(pixel.purchaseEventId("abc", false), "b2c_abc");
  assert.equal(pixel.purchaseEventId("abc", true), "b2b_abc");
});

test("evento de compra no servidor: só pedido PAGO (Pix/cartão), total em centavos, prefixo b2c_/b2b_, sem boleto/arquivado/brinde", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, total_cents int, b2b_offer_id uuid, archived_at timestamp);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, product_id uuid, qty int, unit_price_cents int, product_name_snapshot text);
    INSERT INTO products VALUES ('00000000-0000-4000-8000-0000000000a1', 'adulto-floral-em-gotas-rescue', 'Rescue', 'Floral em gotas', 'adulto');
    INSERT INTO orders VALUES
      ('10000000-0000-4000-8000-000000000001', 'paid', 'pix', 25870, NULL, NULL),
      ('10000000-0000-4000-8000-000000000002', 'paid', 'card', 12345, '20000000-0000-4000-8000-000000000001', NULL),
      ('10000000-0000-4000-8000-000000000003', 'pending', 'pix', 9990, NULL, NULL),
      ('10000000-0000-4000-8000-000000000004', 'paid', 'boleto', 9990, '20000000-0000-4000-8000-000000000001', NULL),
      ('10000000-0000-4000-8000-000000000005', 'paid', 'pix', 9990, NULL, now());
    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) SELECT id, '00000000-0000-4000-8000-0000000000a1', 3, 1990 FROM orders;
    INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 1, 0);`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  const paid = await loadPurchaseEvent(run, "10000000-0000-4000-8000-000000000001");
  assert.equal(paid.eventId, "b2c_10000000-0000-4000-8000-000000000001");
  assert.equal(paid.amountCents, 25870);
  assert.equal(paid.contents.length, 1, "brinde de R$ 0,00 fica de fora");
  assert.deepEqual(paid.contents[0], { id: "adulto-floral-em-gotas-rescue", name: "Floral Rescue · Adulto · 31 ml", quantity: 3 });

  const b2b = await loadPurchaseEvent(run, "10000000-0000-4000-8000-000000000002");
  assert.equal(b2b.eventId, "b2b_10000000-0000-4000-8000-000000000002");
  assert.equal(b2b.amountCents, 12345);

  assert.equal(await loadPurchaseEvent(run, "10000000-0000-4000-8000-000000000003"), null, "pendente: não mede");
  assert.equal(await loadPurchaseEvent(run, "10000000-0000-4000-8000-000000000004"), null, "boleto fica para a fase 2");
  assert.equal(await loadPurchaseEvent(run, "10000000-0000-4000-8000-000000000005"), null, "arquivado (teste): não mede");
  assert.equal(await loadPurchaseEvent(run, "nao-e-uuid"), null);
  assert.equal(await loadPurchaseEvent(run, "10000000-0000-4000-8000-0000000000ff"), null);
  assert.ok(!JSON.stringify(paid).match(/email|phone|cpf|cnpj|nome|customer/i), "sem dado pessoal");
});

test("4/6) onde carrega: B2C e páginas do lojista sim; /admin, área do vendedor e páginas internas não", () => {
  for (const path of ["/", "/linha/adulto", "/produto/adulto-floral-em-gotas-rescue", "/checkout", "/checkout/pagamento", "/acompanhe/abc", "/parceiros", "/b2b/oferta/tok", "/b2b/oferta/tok/linha/adulto", "/b2b/carrinho", "/b2b/checkout", "/b2b/pagar", "/cookies", "/privacidade"]) {
    assert.equal(pixel.isPixelPath(path), true, path);
  }
  for (const path of ["/admin", "/admin/login", "/admin/pedidos", "/admin/b2b", "/b2b/painel", "/b2b/painel/mostruario", "/b2b/painel/cliente/1/oferta", "/b2b/login", "/b2b/convite/tok", "/b2b/demo/tok", "/b2b", "/api/orders/pixel-event"]) {
    assert.equal(pixel.isPixelPath(path), false, path);
  }
  const banner = read("src/components/consent/CookieBanner.tsx");
  assert.ok(banner.includes("isPixelPath(pathname)"), "o banner também não aparece no admin/painel");
  assert.ok(read("src/components/consent/ChatGptAdsPixel.tsx").includes("disablePixel(env)"), "página interna: consent false");
});

test("3/7) query string (oppref, utm_*) nunca é descartada nos redirecionamentos", () => {
  assert.equal(forwardQuery("/b2b/oferta/t", { oppref: "abc", utm_source: "chatgpt" }), "/b2b/oferta/t?oppref=abc&utm_source=chatgpt");
  assert.equal(forwardQuery("/b2b/oferta/t", { v: "X", oppref: "abc" }, ["v"]), "/b2b/oferta/t?oppref=abc");
  assert.equal(forwardQuery("/produto/x", {}), "/produto/x");
  // /parceiros -> loja, produto (slugs antigos) e middleware (301 clona nextUrl: mantém a query)
  assert.ok(read("src/app/parceiros/page.tsx").includes("withForwardedParams(storePath, query)"));
  const product = read("src/app/produto/[slug]/page.tsx");
  assert.equal((product.match(/forwardQuery\(/g) ?? []).length, 2);
  assert.ok(!/redirect\(\s*`\/produto\/\$\{slug\.slice/.test(product), "nenhum redirect do produto sem a query");
  const middleware = read("src/middleware.ts");
  assert.ok(middleware.includes("request.nextUrl.clone()") && !middleware.includes("url.search = \"\""), "middleware mantém ?query");
  assert.ok(read("next.config.ts").includes("skipTrailingSlashRedirect"), "sem redirecionamento de barra final");
});

test("fiação: banner e pixel no layout; Compra na confirmação/acompanhamento/checkouts; sem CSP, sem unsafe-inline, sem sha256/user", () => {
  const layout = read("src/app/layout.tsx");
  assert.ok(layout.includes("<CookieBanner />") && layout.includes("<ChatGptAdsPixel />"));
  assert.ok(read("src/app/acompanhe/[token]/page.tsx").includes("<PurchasePixel orderId={view.orderId} />"));
  assert.ok(read("src/app/checkout/page.tsx").includes('active={pendingOrderStatus === "paid"}'));
  assert.ok(read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("<PurchasePixel orderId={order.id} />"));
  assert.ok(read("src/components/layout/SiteFooter.tsx").includes("<CookieSettingsLink"));

  // CSP: o site não define Content-Security-Policy (nada a liberar); se vier, só com nonce/hash
  for (const file of ["next.config.ts", "src/middleware.ts", "vercel.json"]) {
    assert.ok(!/Content-Security-Policy/i.test(read(file)), file);
    assert.ok(!/unsafe-inline/.test(read(file)), file);
  }
  for (const file of ["src/lib/pixel.ts", "src/lib/pixel-event.ts", "src/components/consent/PurchasePixel.tsx", "src/components/consent/ChatGptAdsPixel.tsx"]) {
    const source = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/sha256|email_|phone_number|external_id/i.test(source), file);
  }
  const lib = read("src/lib/pixel.ts");
  assert.ok(lib.includes('"consent", false') && lib.includes('"consent", true') && lib.includes("opt_out: true"));
  assert.ok(lib.indexOf('oaiq("consent", false); // por segurança') < lib.indexOf('oaiq("init"'), "consent false antes do init");
});

test("banner: Aceitar / Recusar / Configurar com o MESMO destaque; categorias; padrão recusado", () => {
  const banner = read("src/components/consent/CookieBanner.tsx");
  const buttons = banner.match(/<button type="button" className=\{button\}/g) ?? [];
  assert.ok(buttons.length >= 6, "todos os botões de escolha usam a mesma classe");
  for (const label of ["Aceitar", "Recusar", "Configurar", "Salvar"]) assert.ok(banner.includes(label), label);
  const aceitar = banner.indexOf("cookie-aceitar");
  const recusar = banner.indexOf("cookie-recusar");
  const configurar = banner.indexOf("cookie-configurar");
  assert.ok(aceitar > 0 && recusar > aceitar && configurar > recusar);
  for (const category of ["Necessários", "Análise", "Marketing"]) assert.ok(banner.includes(category), category);
  assert.ok(banner.includes("useState(false)"), "marketing começa desligado");
});

test("políticas: parágrafo do pixel em Privacidade e Cookies + 'Configurar cookies'", () => {
  for (const file of ["src/app/privacidade/page.tsx", "src/app/cookies/page.tsx"]) {
    const page = read(file).replace(/\s+/g, " ");
    for (const part of [
      "Com o seu consentimento para cookies de marketing, usamos o pixel de medição da Plataforma de Anúncios da OpenAI",
      "(ChatGPT) para saber se nossos anúncios geram visitas e compras",
      "sem nome, e-mail, telefone ou documentos",
      "<code>__oppref</code> (identificador do clique no anúncio, até 30 dias)",
      "<code>__obref</code> (identificador aleatório do navegador, até 365 dias)",
      "retirar o consentimento a qualquer momento em &quot;Configurar cookies&quot;",
      "esses cookies são apagados",
    ]) {
      assert.ok(page.includes(part), `${file}: ${part}`);
    }
    assert.ok(page.includes("<CookieSettingsLink"), file);
    assert.ok(page.includes("18 de outubro de 2026"), file);
  }
});
