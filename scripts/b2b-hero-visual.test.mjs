/*
 * Regra visual do B2B (Luis, 11/10): em toda página B2B do lojista (link da oferta, loja /parceiros, página de
 * linha) fica o MESMO hero do B2C da Bio com texto de lojista e os cards de linha; sem trio, quiz, convite
 * UGC, depoimentos nem blocos institucionais.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("hero do B2B usa a mesma imagem e identidade do hero do B2C, com texto de lojista", () => {
  const hero = read("src/components/b2b/B2BHero.tsx");
  const home = read("src/app/page.tsx");
  assert.ok(home.includes("/assets/home/hero/Hero.png") && hero.includes("/assets/home/hero/Hero.png"), "mesma imagem");
  for (const token of ["Bio Florais · Desde 1997", "bg-gradient-to-r from-[#fffdf9]/96", "font-serif", "text-[#422347]", "text-[#9b6c24]"]) {
    assert.ok(hero.includes(token), token);
  }
  assert.ok(/Pedido mínimo R\$ 250/.test(hero) && hero.includes("frete especial B2B a partir de R$ 450") && hero.includes("Pix, cartão em até 3x e boleto PJ"));
});

test("primeira tela, loja /parceiros e página de linha usam o hero; nada de trio, quiz, UGC ou depoimentos", () => {
  for (const f of ["src/app/b2b/oferta/[token]/page.tsx", "src/app/b2b/oferta/[token]/linha/[slug]/page.tsx", "src/app/parceiros/page.tsx"]) {
    const src = read(f);
    assert.ok(src.includes("<B2BHero"), f);
    assert.ok(!/trio|quiz|Ugc|UGC|criadora|depoiment|testimonial/i.test(src), `${f}: sem blocos do B2C`);
  }
  const hero = read("src/components/b2b/B2BHero.tsx");
  assert.ok(!/trio|quiz|Ugc|criadora|depoiment/i.test(hero.slice(hero.indexOf("export default function"))));
  // a primeira tela mantém os cards de linha
  assert.ok(read("src/app/b2b/oferta/[token]/page.tsx").includes("<B2BLineCard"));
});

test("elementos flutuantes do B2C (criadora, sacola do B2C, barra de linhas) ficam fora do B2B e de /parceiros", () => {
  const hide = read("src/components/layout/HideOnB2B.tsx");
  assert.ok(hide.includes('"/b2b"') && hide.includes('"/parceiros"'));
});
