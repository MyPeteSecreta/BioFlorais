/*
 * Link curto /v/<codigo> (06/11, aprovado pelo Luis): 302 para o destino com a UTM, tabela em src/lib/links-curtos.ts,
 * código desconhecido → home com utm_campaign=link_desconhecido, nunca para fora do site, atribuição igual a um link normal.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { CODIGO_VALIDO, LINKS_CURTOS, isCaminhoInterno, resolveLinkCurto } from "../src/lib/links-curtos.ts";
import { GET } from "../src/app/v/[codigo]/route.ts";
import { bioLines, bioProducts } from "../src/lib/catalog/bio-products.ts";
import { parseAttribution } from "../src/lib/attribution.ts";
import { isPixelPath } from "../src/lib/ads-tag.ts";
import { resolveLegacyRedirect } from "../src/lib/seo/legacy-redirects.ts";

const ESPERADOS = {
  fogos: "/produto/pet-floral-em-gotas-medo-de-fogos",
  sono: "/produto/adulto-floral-em-gotas-sono",
  ansiedade: "/produto/adulto-floral-em-gotas-sensacao-de-ansiedade",
  baby: "/produto/baby-floral-em-gotas-sono",
  pet: "/linha/pet",
  adulto: "/linha/adulto",
  infantil: "/linha/infantil",
  esquenta: "/",
};

const call = async (codigo, search = "") => {
  const url = `https://www.bioflorais.com.br/v/${codigo}${search}`;
  return GET(new NextRequest(url), { params: Promise.resolve({ codigo }) });
};

test("tabela: os 8 códigos pedidos, com facebook / organic / org_<codigo>; destinos existem no site", () => {
  for (const [codigo, destino] of Object.entries(ESPERADOS)) {
    assert.deepEqual(LINKS_CURTOS[codigo], { destino, utm_source: "facebook", utm_medium: "organic", utm_campaign: `org_${codigo}` }, codigo);
  }

  const slugs = new Set(bioProducts.map((product) => product.slug));
  const linhas = new Set(bioLines.map((line) => line.slug));

  for (const [codigo, link] of Object.entries(LINKS_CURTOS)) {
    assert.ok(CODIGO_VALIDO.test(codigo), `código: ${codigo}`);
    assert.ok(isCaminhoInterno(link.destino), `destino interno: ${codigo}`);
    const caminho = link.destino.split("?")[0];
    if (caminho.startsWith("/produto/")) assert.ok(slugs.has(caminho.slice("/produto/".length)), `produto existe: ${codigo}`);
    else if (caminho.startsWith("/linha/")) assert.ok(linhas.has(caminho.slice("/linha/".length)), `linha existe: ${codigo}`);
    else assert.equal(caminho, "/", `destino conhecido: ${codigo}`);
    assert.ok(isPixelPath(caminho), "a página de destino grava a origem");
  }
});

test("rota: 302 para o destino com a UTM, no próprio domínio; sem cache", async () => {
  const res = await call("fogos");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://www.bioflorais.com.br/produto/pet-floral-em-gotas-medo-de-fogos?utm_source=facebook&utm_medium=organic&utm_campaign=org_fogos");
  assert.equal(res.headers.get("cache-control"), "no-store");

  assert.equal((await call("esquenta")).headers.get("location"), "https://www.bioflorais.com.br/?utm_source=facebook&utm_medium=organic&utm_campaign=org_esquenta");
  assert.equal((await call("FOGOS")).headers.get("location"), "https://www.bioflorais.com.br/produto/pet-floral-em-gotas-medo-de-fogos?utm_source=facebook&utm_medium=organic&utm_campaign=org_fogos", "maiúsculas valem");

  // fbclid (e outros) seguem; utm_* que chegam no link curto não sobrescrevem a tabela
  const comFbclid = new URL((await call("sono", "?fbclid=AbC123&utm_source=outro")).headers.get("location"));
  assert.equal(comFbclid.searchParams.get("fbclid"), "AbC123");
  assert.equal(comFbclid.searchParams.get("utm_source"), "facebook");
  assert.equal(comFbclid.searchParams.getAll("utm_source").length, 1);
});

test("código desconhecido ou estranho → home com utm_campaign=link_desconhecido; nunca para fora do site", async () => {
  for (const codigo of ["nao-existe", "..", "%2F%2Fevil.com", "evil.com", "a".repeat(80), "", "constructor", "__proto__", "toString"]) {
    const location = new URL((await call(encodeURIComponent(codigo))).headers.get("location"));
    assert.equal(location.origin, "https://www.bioflorais.com.br", codigo);
    assert.equal(location.pathname, "/", codigo);
    assert.equal(location.searchParams.get("utm_campaign"), "link_desconhecido", codigo);
  }

  for (const destino of ["//evil.com", "https://evil.com", "/\\evil.com", "\\\\evil.com", "evil.com", "/ x", "/javascript:alert(1)"]) {
    assert.equal(isCaminhoInterno(destino), false, destino);
  }
  for (const destino of ["/", "/linha/pet", "/produto/x?y=1", "/para/pet-sozinho"]) assert.equal(isCaminhoInterno(destino), true, destino);

  assert.equal(resolveLinkCurto("nao-existe", "?fbclid=1"), "/?fbclid=1&utm_campaign=link_desconhecido");
});

test("atribuição igual a um link normal: a URL de destino traz a UTM que o bio_origem grava; o /v não é redirect antigo", async () => {
  const location = new URL((await call("pet")).headers.get("location"));
  assert.deepEqual(parseAttribution(location.search, "https://l.facebook.com/", "www.bioflorais.com.br"), {
    utm_source: "facebook",
    utm_medium: "organic",
    utm_campaign: "org_pet",
    referrer_domain: "l.facebook.com",
  });

  assert.equal(resolveLegacyRedirect("/v/fogos"), null, "o middleware de URLs antigas não mexe no /v");
});
