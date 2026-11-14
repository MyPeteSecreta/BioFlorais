/*
 * Origem da venda (14/11, aprovado pelo Luis): (B) sem UTM, os identificadores de clique viram a origem (sem guardar o valor);
 * (C) o bio_origem também é gravado pelo servidor na chegada, com a mesma regra de primeiro toque e sem aceite de marketing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

const at = await import("../src/lib/attribution.ts");
const { middleware } = await import("../src/middleware.ts");

const SITE = "https://www.bioflorais.com.br";
const page = (path, { referer, cookie, accept = "text/html,application/xhtml+xml", method = "GET" } = {}) => {
  const headers = new Headers({ accept });
  if (referer) headers.set("referer", referer);
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`${SITE}${path}`, { method, headers });
};
const setCookie = (response) => response.headers.get("set-cookie");

test("B: sem UTM, gclid/gbraid/wbraid/gad_source = google / cpc; fbclid = facebook / social; msclkid = bing / cpc; ttclid = tiktok / cpc", () => {
  const parse = (search) => at.parseAttribution(search, "", "www.bioflorais.com.br");
  for (const p of ["gclid", "gbraid", "wbraid", "gad_source"]) assert.deepEqual([parse(`?${p}=abc`).utm_source, parse(`?${p}=abc`).utm_medium], ["google", "cpc"], p);
  assert.deepEqual(parse("?fbclid=IwAR0x"), { utm_source: "facebook", utm_medium: "social", utm_campaign: null, referrer_domain: null });
  assert.deepEqual([parse("?msclkid=1").utm_source, parse("?msclkid=1").utm_medium], ["bing", "cpc"]);
  assert.deepEqual([parse("?ttclid=1").utm_source, parse("?ttclid=1").utm_medium], ["tiktok", "cpc"]);
  assert.equal(parse("?gclid=").utm_source, null, "vazio não conta");

  // UTM vence (o link curto /v/ manda UTM e o fbclid junto)
  assert.deepEqual(parse("?utm_source=facebook&utm_medium=organic&utm_campaign=org_fogos&fbclid=x"), {
    utm_source: "facebook", utm_medium: "organic", utm_campaign: "org_fogos", referrer_domain: null,
  });
  assert.equal(parse("?utm_campaign=so_campanha&gclid=x").utm_source, null, "qualquer UTM: não completa com o clique");

  // o valor do identificador nunca é guardado
  const cookie = at.buildAttributionCookie(parse("?gclid=SEGREDO123&fbclid=OUTRO"), true);
  assert.ok(!/SEGREDO123|OUTRO/.test(decodeURIComponent(cookie)));
});

test("C: o servidor grava o bio_origem na chegada com informação, igual ao navegador (primeiro toque, 30 dias, Lax, Secure)", () => {
  const res = middleware(page("/produto/adulto-floral-em-gotas-sono?utm_source=instagram&utm_medium=organic&utm_campaign=x"));
  const cookie = setCookie(res);
  assert.match(cookie, /^bio_origem=/);
  assert.match(cookie, /Max-Age=2592000; Path=\/; SameSite=Lax; Secure/);
  assert.deepEqual(at.readAttributionCookie(cookie.split(";")[0]), { utm_source: "instagram", utm_medium: "organic", utm_campaign: "x", referrer_domain: null });

  // referrer externo e clique
  assert.equal(at.readAttributionCookie(setCookie(middleware(page("/", { referer: "https://l.instagram.com/" }))).split(";")[0]).referrer_domain, "l.instagram.com");
  assert.equal(at.readAttributionCookie(setCookie(middleware(page("/linha/pet?gclid=abc"))).split(";")[0]).utm_source, "google");
  assert.equal(at.readAttributionCookie(setCookie(middleware(page("/", { referer: "android-app://com.openai.chatgpt" }))).split(";")[0]).referrer_domain, "com.openai.chatgpt");
});

test("C: não grava quando não deve (já tem origem, visita direta, navegação interna, /v/, admin, área do vendedor, não-página, POST)", () => {
  const existing = at.buildAttributionCookie({ utm_source: "google", utm_medium: "cpc", utm_campaign: null, referrer_domain: null }, true).split(";")[0];
  assert.equal(setCookie(middleware(page("/?utm_source=outro", { cookie: existing }))), null, "primeiro toque");
  assert.equal(setCookie(middleware(page("/"))), null, "direto");
  assert.equal(setCookie(middleware(page("/checkout", { referer: `${SITE}/carrinho` }))), null, "navegação interna");
  assert.equal(setCookie(middleware(page("/v/fogos", { referer: "https://l.facebook.com/" }))), null, "o link curto deixa para a página de destino (com UTM)");
  assert.equal(setCookie(middleware(page("/admin/pedidos?utm_source=x"))), null, "admin");
  assert.equal(setCookie(middleware(page("/b2b/painel?utm_source=x"))), null, "área do vendedor");
  assert.equal(setCookie(middleware(page("/produto/adulto-floral-em-gotas-sono?utm_source=x", { accept: "*/*" }))), null, "só documento");
  assert.equal(setCookie(middleware(page("/?utm_source=x", { method: "POST" }))), null, "só GET");
});

test("C: os redirects antigos continuam iguais (301, query preservada) e não gravam cookie no redirect", () => {
  const res = middleware(page("/floral-sono?utm_source=x"));
  if (res.status === 301) {
    assert.ok(res.headers.get("location").includes("utm_source=x"));
    assert.equal(setCookie(res), null);
  }
});
