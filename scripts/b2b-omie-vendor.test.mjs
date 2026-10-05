/*
 * Vendedor no Omie (30a/30b + campo no admin) e atalhos "Acompanhe seu pedido"
 * (cabeçalho do B2C e topo do link B2B).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { parseOmieVendorInput, OMIE_VENDOR_MAX_LENGTH } = await import("../src/lib/b2b/omie-vendor.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("Vendedor no Omie: espaços sobrando saem, vazio limpa, máximo 70 caracteres", () => {
  assert.equal(OMIE_VENDOR_MAX_LENGTH, 70);
  assert.deepEqual(parseOmieVendorInput("  Maria   da  Silva "), { ok: true, value: "Maria da Silva" });
  assert.deepEqual(parseOmieVendorInput("   "), { ok: true, value: null });
  assert.deepEqual(parseOmieVendorInput(null), { ok: true, value: null });
  assert.equal(parseOmieVendorInput("A".repeat(70)).ok, true);
  assert.equal(parseOmieVendorInput("A".repeat(71)).ok, false);
});

test("30a/30b: preflight em uma linha JSON; 30b é aditivo e idempotente, não mexe nos dados", async () => {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, status text);
    INSERT INTO b2b_responsibles VALUES ('00000001-0000-4000-8000-000000000000', 'Ana', 'active');`);

  const pre = async () => (await pg.query(read("sql/b2b/30a_vendedor_omie_preflight_one_shot.sql"))).rows;
  const before = await pre();
  assert.equal(before.length, 1);
  assert.equal(before[0].preflight_vendedor_omie.coluna_omie_vendor_code_existe, false);
  assert.equal(before[0].preflight_vendedor_omie.vendedores_ativos, 1);
  assert.equal(before[0].preflight_vendedor_omie.pode_prosseguir, true);

  const sql = read("sql/b2b/30b_vendedor_omie.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && /IF NOT EXISTS/.test(sql));
  assert.ok(!/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  await pg.exec(sql);
  await pg.exec(sql);

  assert.equal((await pre())[0].preflight_vendedor_omie.coluna_omie_vendor_code_existe, true);
  const rows = (await pg.query("SELECT name, omie_vendor_code FROM b2b_responsibles")).rows;
  assert.deepEqual(rows, [{ name: "Ana", omie_vendor_code: null }]);
});

test("admin: campo 'Vendedor no Omie' editável por vendedor, validado no servidor e lido sem quebrar sem a coluna", () => {
  const route = read("src/app/api/admin/b2b/responsibles/[id]/route.ts");
  assert.ok(route.includes('case "set_omie_vendor"') && route.includes("parseOmieVendorInput") && route.includes("omie_vendor_code"));
  assert.ok(route.indexOf("isAdminRequest") < route.indexOf('case "set_omie_vendor"'));
  const list = read("src/app/api/admin/b2b/responsibles/route.ts");
  assert.ok(list.includes("omie_vendor_code") && list.includes("SQL 30b ainda não aplicado"));
  const tab = read("src/components/admin/b2b/ResponsiblesTab.tsx");
  assert.ok(tab.includes("Vendedor no Omie") && tab.includes("exatamente como no cadastro de Vendedores do Omie") && tab.includes("máx. 70"));
  assert.ok(read("src/lib/db/schema.ts").includes('omieVendorCode: text("omie_vendor_code")'));
});

test("atalhos: 'Acompanhe seu pedido' no cabeçalho do B2C (desktop e celular) e botão no topo do link B2B", () => {
  const home = read("src/app/page.tsx");
  const header = home.slice(home.indexOf("<header"), home.indexOf("</header>"));
  assert.equal((header.match(/href="\/acompanhe-seu-pedido"/g) ?? []).length, 2);
  assert.ok(header.includes("Acompanhe seu pedido") && header.includes("Acompanhar pedido"));
  // os outros itens do cabeçalho seguem
  for (const item of ["Adulto", "Pet", "Infantil", "Descubra seu Bio", "Nossas linhas", "Ver produtos"]) assert.ok(header.includes(item), item);
  assert.ok(read("src/components/layout/SiteFooter.tsx").includes("/acompanhe-seu-pedido"));

  const b2b = read("src/app/b2b/oferta/[token]/page.tsx");
  const topo = b2b.slice(b2b.indexOf("<header"), b2b.indexOf("</header>"));
  assert.ok(topo.includes("Meus pedidos") && topo.includes('href="/acompanhe-seu-pedido"') && topo.includes("Acompanhar pedido"));
});
