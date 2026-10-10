/*
 * B2C P1 — páginas que estavam "em preparação": Conheça a marca, Terapia floral, Trocas e Devoluções,
 * Frete e Entrega. Texto padrão (CDC nas legais); revisão do Luis marcada no ENTREGA.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("nenhuma das 4 páginas é mais texto provisório", () => {
  for (const f of ["src/app/sobre/page.tsx", "src/app/terapia-floral/page.tsx", "src/app/trocas-e-devolucoes/page.tsx", "src/app/frete-e-entrega/page.tsx"]) {
    const src = read(f);
    assert.ok(src.includes("<InfoPage"), f);
    assert.ok(!/será publicada|em preparação|será ampliada/.test(src), f);
    assert.ok(src.includes("export const metadata"), f);
  }
});

test("trocas e devoluções traz os prazos do CDC; frete traz cálculo, prazo e rastreio; marca traz 1997/frescas/sem álcool", () => {
  const trocas = read("src/app/trocas-e-devolucoes/page.tsx");
  assert.ok(trocas.includes("7 (sete) dias") && trocas.includes("art. 49") && trocas.includes("30 dias") && trocas.includes("90 dias") && trocas.includes("art. 26"));
  const frete = read("src/app/frete-e-entrega/page.tsx");
  assert.ok(frete.includes("CEP") && frete.includes("Frete grátis") && frete.includes("Acompanhe seu pedido") && frete.includes("R$ 100"));
  const sobre = read("src/app/sobre/page.tsx");
  assert.ok(sobre.includes("1997") && sobre.includes("flores frescas brasileiras") && sobre.includes("sem álcool"));
  assert.ok(read("src/app/terapia-floral/page.tsx").includes("não substituem o acompanhamento"));
  // contato: caixa que existe (a sac@bioflorais ainda não existe, P2)
  assert.ok(read("src/components/layout/InfoPage.tsx").includes("sac@angelblanc.com"));
});
