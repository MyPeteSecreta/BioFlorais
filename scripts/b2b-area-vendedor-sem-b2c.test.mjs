/*
 * Área do VENDEDOR sem B2C: o logo leva ao painel, o cabeçalho é o do vendedor (Meus clientes, Lançar pedido,
 * Mostruário, Minhas comissões, Sair) e nenhuma página/componente da área leva ao site B2C.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel) => readFileSync(join(root, rel), "utf8");

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

test("cabeçalho do vendedor: logo -> painel e menu completo com Sair", () => {
  const layout = read("src/app/b2b/painel/layout.tsx");
  const header = layout.slice(layout.indexOf("<header"), layout.indexOf("</header>"));
  assert.ok(header.includes('<Link href="/b2b/painel" className="leading-tight">'), "logo leva ao painel");
  for (const label of ["Meus clientes", "Lançar pedido", "Mostruário", "Minhas comissões", "<LogoutButton"]) assert.ok(header.includes(label), label);
  for (const href of ["/b2b/painel/lancar-pedido", "/b2b/painel/mostruario", "/b2b/painel/comissoes"]) assert.ok(header.includes(`href="${href}"`), href);
  assert.ok(!/href="\/(?!b2b)/.test(header), "nenhum link do cabeçalho fora do B2B");
  assert.ok(read("src/components/b2b/LogoutButton.tsx").includes('"/b2b/login"'));
});

test("rodapé e elementos do B2C ficam fora do B2B (oculto no layout /b2b + HideOnB2B)", () => {
  assert.ok(read("src/app/b2b/layout.tsx").includes("body > footer { display: none !important; }"));
  const hide = read("src/components/layout/HideOnB2B.tsx");
  assert.ok(hide.includes('pathname?.startsWith("/b2b/")') && hide.includes('pathname === "/b2b"'));
});

test("nenhuma página/componente da área do vendedor tem link para o site B2C", () => {
  const files = [
    ...walk("src/app/b2b/painel"),
    ...walk("src/components/b2b"),
    "src/app/b2b/login/page.tsx",
    "src/app/b2b/demo-expirada/page.tsx",
    "src/app/b2b/demo-invalido/page.tsx",
  ].filter((file) => /\.(tsx|ts)$/.test(file));
  assert.ok(files.length > 20);

  const offenders = [];
  for (const file of files) {
    const source = read(file);
    // href="/..." ou href={`/...`} / router.push("/...") que não comece por /b2b
    for (const match of source.matchAll(/(?:href=|router\.(?:push|replace)\()\s*\{?\s*["'`](\/[^"'`]*)/g)) {
      const target = match[1];
      if (!target.startsWith("/b2b") && !target.startsWith("/api/")) offenders.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(offenders, []);
});
