/*
 * B2C P1 — menu do topo: Adulto, Pet e Infantil têm destino PRÓPRIO (antes os três apontavam para o mesmo
 * "#linhas" e, depois de usar um e voltar, os outros pareciam não responder).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const header = home.slice(home.indexOf("{/* HEADER */}"), home.indexOf("{/* HERO MOBILE */}"));

test("cabeçalho: cada linha do menu leva à sua própria página", () => {
  const nav = header.slice(header.indexOf("<nav"), header.indexOf("</nav>"));
  for (const [label, href] of [["Adulto", "/linha/adulto"], ["Pet", "/linha/pet"], ["Infantil", "/linha/infantil"]]) {
    const re = new RegExp(`<Link href="${href}"[^>]*>\\s*${label}\\s*</Link>`);
    assert.ok(re.test(nav), label);
  }
  // nenhum item do menu de linhas repete o mesmo âncora
  const anchors = nav.match(/href="#linhas"/g) ?? [];
  assert.equal(anchors.length, 1, "só 'Nossas linhas' usa a âncora da própria home");
});
