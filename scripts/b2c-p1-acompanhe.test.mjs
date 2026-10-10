/*
 * B2C P1 — "Acompanhe seu pedido": logo clicável + "Voltar à loja" na busca e no acompanhamento do pedido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("busca e página do pedido têm logo clicável e botão para voltar à loja", () => {
  for (const f of ["src/app/acompanhe-seu-pedido/page.tsx", "src/app/acompanhe/[token]/page.tsx"]) {
    const src = read(f);
    assert.ok(src.includes('<Link href="/" aria-label="Bio Florais, voltar à loja"'), f);
    assert.ok(src.includes("← Voltar à loja"), f);
  }
});
