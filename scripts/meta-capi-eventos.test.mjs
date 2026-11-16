/*
 * API de Conversões da Meta, fase 2 (mestre, 16/11): ViewContent, AddToCart e InitiateCheckout também pelo servidor, com o
 * mesmo event_id do pixel; só com aceite; só códigos neutros e não sensíveis; sem dado pessoal; sem token = desligado e
 * "não configurado"; e o checkout/sacola NÃO dependem do envio (dispara e esquece).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildMetaCapiBrowserEventBody,
  fbcFromPageUrl,
  isAllowedMetaContentId,
  safeSourceUrl,
  sanitizeMetaCustomData,
} from "../src/lib/meta-capi-events.ts";
import { META_CONTENT_IDS } from "../src/lib/feeds/meta-content-ids.ts";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const SITE = "https://www.bioflorais.com.br";
const SONO = META_CONTENT_IDS["adulto-floral-em-gotas-sono"];
const PESO = META_CONTENT_IDS["adulto-floral-em-gotas-reducao-de-peso"];
const ctx = { fbp: "fb.1.1700000000000.123", fbc: null, ip: "203.0.113.9", ua: "Mozilla/5.0" };
const base = { event: "ViewContent", eventId: "3f1c2a9e-1111-4c2b-9d7e-abcdefabcdef", params: { content_type: "product", content_ids: [SONO], value: 35.9, currency: "BRL" }, pageUrl: `${SITE}/produto/adulto-floral-em-gotas-sono?utm_source=x&fbclid=AbCdEfGhIjKlMnOp`, consent: true };
const opts = { siteUrl: SITE, nowMs: 1763300000000 };

test("ViewContent: mesmo event_id do pixel, códigos neutros, página sem query, user_data só cookies/IP/navegador (fbc do fbclid)", () => {
  const built = buildMetaCapiBrowserEventBody(base, ctx, opts);
  assert.equal(built.ok, true);
  const [event] = built.body.data;
  assert.equal(event.event_name, "ViewContent");
  assert.equal(event.event_id, base.eventId, "deduplica com o pixel");
  assert.equal(event.action_source, "website");
  assert.equal(event.event_time, 1763300000);
  assert.equal(event.event_source_url, `${SITE}/produto/adulto-floral-em-gotas-sono`, "sem utm, sem fbclid");
  assert.deepEqual(event.custom_data, { content_type: "product", content_ids: [SONO], currency: "BRL", value: 35.9 });
  assert.deepEqual(Object.keys(event.user_data).sort(), ["client_ip_address", "client_user_agent", "fbc", "fbp"]);
  assert.equal(event.user_data.fbc, "fb.1.1763300000000.AbCdEfGhIjKlMnOp");
  assert.ok(!("em" in event.user_data) && !("ph" in event.user_data) && !("zp" in event.user_data), "nenhum dado pessoal nestes eventos");
  assert.ok(!("test_event_code" in built.body));

  // cookie _fbc vence o fbclid; sem nada, sem fbc
  assert.equal(buildMetaCapiBrowserEventBody(base, { ...ctx, fbc: "fb.1.1.COOKIE" }, opts).body.data[0].user_data.fbc, "fb.1.1.COOKIE");
  assert.ok(!("fbc" in buildMetaCapiBrowserEventBody({ ...base, pageUrl: `${SITE}/produto/adulto-floral-em-gotas-sono` }, ctx, opts).body.data[0].user_data));
  assert.equal(buildMetaCapiBrowserEventBody(base, ctx, { ...opts, testEventCode: "TEST123" }).body.test_event_code, "TEST123");
});

test("sem aceite, evento desconhecido, id inválido, outro site, admin ou produto sensível: nada é enviado", () => {
  assert.deepEqual(buildMetaCapiBrowserEventBody({ ...base, consent: false }, ctx, opts), { ok: false, reason: "no_consent" });
  assert.deepEqual(buildMetaCapiBrowserEventBody({ ...base, consent: "true" }, ctx, opts), { ok: false, reason: "no_consent" });
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, event: "Purchase" }, ctx, opts).reason, "bad_event", "Purchase só pelo pedido pago");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, event: "Lead" }, ctx, opts).reason, "bad_event");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, eventId: "x" }, ctx, opts).reason, "bad_event");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, pageUrl: "https://outro.com/produto/adulto-floral-em-gotas-sono" }, ctx, opts).reason, "bad_page");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, pageUrl: `${SITE}/admin/pedidos` }, ctx, opts).reason, "bad_page");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, pageUrl: `${SITE}/produto/adulto-floral-em-gotas-reducao-de-peso` }, ctx, opts).reason, "bad_page");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, params: { content_ids: [PESO] } }, ctx, opts).reason, "nothing_to_send", "código de produto sensível cai fora");
  assert.equal(buildMetaCapiBrowserEventBody({ ...base, params: { content_ids: ["adulto-floral-em-gotas-sono"] } }, ctx, opts).reason, "nothing_to_send", "slug nunca vai");
});

test("custom_data por lista branca: nada de nome/categoria/e-mail; InitiateCheckout mantém valor e quantidade e tira os sensíveis", () => {
  const dirty = { content_ids: [SONO, PESO, "BF9999"], content_name: "Sono", content_category: "Floral", em: "a@b.com", value: 107.7, currency: "USD", num_items: 3, contents: [{ id: SONO, quantity: 1 }] };
  assert.deepEqual(sanitizeMetaCustomData("InitiateCheckout", dirty), { value: 107.7, currency: "BRL", content_type: "product", content_ids: [SONO], num_items: 3 });
  assert.deepEqual(sanitizeMetaCustomData("InitiateCheckout", { content_ids: [PESO], value: 35.9, num_items: 1 }), { value: 35.9, currency: "BRL", num_items: 1 }, "só sensível: sem itens");
  assert.equal(sanitizeMetaCustomData("InitiateCheckout", { value: -1 }), null);
  assert.equal(sanitizeMetaCustomData("InitiateCheckout", { value: 1e9 }), null);
  assert.deepEqual(sanitizeMetaCustomData("AddToCart", { content_ids: [SONO], value: 35.9 }), { content_type: "product", content_ids: [SONO], currency: "BRL" }, "igual ao pixel");
  assert.equal(sanitizeMetaCustomData("AddToCart", { content_ids: [SONO, META_CONTENT_IDS["adulto-floral-em-gotas-stress"]] }), null, "um produto por vez");
  assert.equal(isAllowedMetaContentId(SONO), true);
  assert.equal(isAllowedMetaContentId(PESO), false);
  assert.equal(safeSourceUrl("/checkout?cupom=X#a", SITE).url, `${SITE}/checkout`);
  assert.equal(fbcFromPageUrl(`${SITE}/?fbclid=curto`, 1), null);
  assert.equal(fbcFromPageUrl("não é url", 1), null);
});

test("rota /api/meta/events: sem META_CAPI_TOKEN responde 204, não chama a Meta e registra 'não configurado' (uma vez)", async () => {
  const saved = { token: process.env.META_CAPI_TOKEN, fetch: globalThis.fetch, info: console.info };
  delete process.env.META_CAPI_TOKEN;
  let calls = 0;
  const logs = [];
  globalThis.fetch = async () => { calls += 1; return new Response(null, { status: 200 }); };
  console.info = (...args) => logs.push(args.join(" "));

  try {
    const { POST } = await import("../src/app/api/meta/events/route.ts");
    for (let i = 0; i < 2; i += 1) {
      const response = await POST(new Request(`${SITE}/api/meta/events`, { method: "POST", body: JSON.stringify(base) }));
      assert.equal(response.status, 204);
    }
    const garbage = await POST(new Request(`${SITE}/api/meta/events`, { method: "POST", body: "{não é json" }));
    assert.equal(garbage.status, 204, "lixo também é 204, sem erro");
    assert.equal(calls, 0, "sem token, nada sai");
    assert.equal(logs.filter((line) => /não configurado/.test(line)).length, 1);
  } finally {
    if (saved.token === undefined) delete process.env.META_CAPI_TOKEN;
    else process.env.META_CAPI_TOKEN = saved.token;
    globalThis.fetch = saved.fetch;
    console.info = saved.info;
  }
});

test("checkout e sacola não dependem do envio: sem aceite nada sai; com aceite o pixel recebe o eventID e o servidor o MESMO id; erro de rede não propaga", async () => {
  const { trackMetaWithServer } = await import("../src/lib/measurement-client.ts");
  const fbq = [];
  const posts = [];
  const store = new Map();
  const saved = { window: globalThis.window, fetch: globalThis.fetch };
  globalThis.window = {
    fbq: (...args) => fbq.push(args),
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    location: { pathname: "/checkout", href: `${SITE}/checkout` },
    crypto: { randomUUID: () => "11111111-2222-4333-8444-555555555555" },
  };
  globalThis.fetch = (url, init) => { posts.push({ url, init }); return Promise.reject(new Error("rede caiu")); };

  try {
    assert.equal(trackMetaWithServer("InitiateCheckout", { value: 10, currency: "BRL" }), false, "sem aceite: nada");
    assert.equal(fbq.length + posts.length, 0);

    store.set("bio_cookie_consent_v1", JSON.stringify({ v: 1, marketing: true, at: "2026-11-16" }));
    assert.equal(trackMetaWithServer("InitiateCheckout", { value: 10, currency: "BRL" }), true);
    await new Promise((resolve) => setTimeout(resolve, 0)); // a rejeição do fetch é engolida (sem unhandledRejection)
    assert.deepEqual(fbq[0], ["track", "InitiateCheckout", { value: 10, currency: "BRL" }, { eventID: "11111111-2222-4333-8444-555555555555" }]);
    assert.equal(posts[0].url, "/api/meta/events");
    assert.equal(posts[0].init.keepalive, true);
    const sent = JSON.parse(posts[0].init.body);
    assert.equal(sent.eventId, "11111111-2222-4333-8444-555555555555", "mesmo id do pixel");
    assert.equal(sent.consent, true);

    globalThis.fetch = () => { throw new Error("sem fetch"); };
    assert.equal(trackMetaWithServer("InitiateCheckout", { value: 10, currency: "BRL" }), true, "fetch quebrado não quebra o checkout");

    globalThis.window.location = { pathname: "/produto/adulto-floral-em-gotas-reducao-de-peso", href: `${SITE}/produto/adulto-floral-em-gotas-reducao-de-peso` };
    const before = posts.length;
    assert.equal(trackMetaWithServer("ViewContent", { content_ids: ["BF0005"] }), false, "página sensível: nem pixel nem servidor");
    assert.equal(posts.length, before);
  } finally {
    globalThis.window = saved.window;
    globalThis.fetch = saved.fetch;
  }
});

test("ligações: ViewContent, AddToCart e InitiateCheckout usam o envio duplo; Purchase segue pelo pedido pago; checkout não espera a Meta", () => {
  assert.ok(read("src/components/measurement/ViewContentEvent.tsx").includes("trackMetaWithServer(event.name, event.params)"));
  assert.ok(read("src/components/cart/CartProvider.tsx").includes("trackMetaWithServer(event.name, event.params)"));
  const checkout = read("src/app/checkout/page.tsx");
  assert.ok(checkout.includes("if (trackMetaWithServer(event.name, event.params)) initiateCheckoutSent.current = true;"));
  assert.ok(!/await\s+trackMetaWithServer|fetch\("\/api\/meta\/events"/.test(checkout), "o checkout não espera nem chama a rota");
  const client = read("src/lib/measurement-client.ts");
  assert.ok(/if \(!trackMeta\(name, params, eventId\)\) return false;/.test(client), "servidor só depois do pixel (aceite + página)");
  assert.ok(/void fetch\("\/api\/meta\/events"/.test(client) && /\.catch\(\(\) => undefined\)/.test(client));
  const route = read("src/app/api/meta/events/route.ts");
  assert.ok(/after\(async/.test(route) && /return done\(\);\s*\}\s*catch \{\s*return done\(\);/.test(route), "responde 204 antes do envio e em qualquer erro");
  assert.ok(read("src/lib/meta-capi.ts").includes("logMetaCapiNotConfigured()"), "Purchase sem token também registra 'não configurado'");
});
