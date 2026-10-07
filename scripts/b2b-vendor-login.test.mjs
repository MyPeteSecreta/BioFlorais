/*
 * Rodada 5 / V1: login por e-mail OU login; tela de acesso; tela final do cadastro rápido;
 * sessão expirada com mensagem clara (admin e vendedor B2B).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const { isSessionApiCall, SESSION_EXPIRED_MESSAGE } = await import("../src/lib/session-expired.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("login: aceita e-mail OU login; se os dois baterem em registros diferentes, vence o login igual ao digitado", async () => {
  const route = read("src/app/api/b2b/auth/login/route.ts");
  assert.ok(route.includes("lower(${b2bResponsibles.email}) = ${login} OR lower(${b2bResponsibles.login}) = ${login}"));
  assert.ok(route.includes("(lower(${b2bResponsibles.login}) = ${login}) DESC"));

  // mesma regra, no banco de teste
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE r (id int, email text, login text);
    INSERT INTO r VALUES (1, 'ana@x.com', 'ana.vendas'), (2, 'ana.vendas', 'outro'), (3, 'beto@x.com', 'beto@x.com');`);
  const find = async (x) =>
    (await pg.query(`SELECT id FROM r WHERE lower(email) = $1 OR lower(login) = $1 ORDER BY (lower(login) = $1) DESC LIMIT 1`, [x])).rows[0]?.id;
  assert.equal(await find("ana@x.com"), 1, "por e-mail");
  assert.equal(await find("ana.vendas"), 1, "por login (ganha do e-mail igual de outro registro)");
  assert.equal(await find("beto@x.com"), 3, "login = e-mail (cadastro rápido)");
  assert.equal(await find("ninguem@x.com"), undefined);
});

test("tela de acesso: 'E-mail ou login', 'Esqueci minha senha' e mensagem de senha errada clara; /b2b/login existe", () => {
  const page = read("src/app/b2b/login/page.tsx");
  assert.ok(page.includes("E-mail ou login") && page.includes("Esqueci minha senha"));
  assert.ok(read("src/app/api/b2b/auth/login/route.ts").includes("E-mail/login ou senha incorretos"));
  assert.ok(statSync(new URL("../src/app/b2b/login/page.tsx", import.meta.url)).isFile());
});

test("cadastro rápido: tela final mostra o endereço de acesso, 'use seu e-mail e a senha que você criou' e botão copiar", () => {
  const form = read("src/app/b2b/convite/[token]/InviteForm.tsx");
  assert.ok(form.includes("Seu acesso:") && form.includes("use seu e-mail e a senha que você criou"));
  assert.ok(form.includes("clipboard") && form.includes('href="/b2b/painel"'));
});

test("sessão expirada: mensagem clara em todas as rotas 401 do admin e do vendedor; guarda nos layouts", () => {
  assert.equal(SESSION_EXPIRED_MESSAGE, "Sua sessão expirou. Entre de novo.");
  assert.equal(isSessionApiCall("admin", "/api/admin/orders/1/fulfillment"), true);
  assert.equal(isSessionApiCall("admin", "/api/admin/login"), false);
  assert.equal(isSessionApiCall("b2b", "/api/b2b/clients"), true);
  assert.equal(isSessionApiCall("b2b", "/api/b2b/auth/login"), false);
  assert.equal(isSessionApiCall("b2b", "/api/orders/track"), false);

  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  for (const f of walk("src/app/api/admin")) assert.ok(!readFileSync(f, "utf8").includes('"Não autorizado."'), f);
  for (const f of ["clients/route.ts", "offers/link/route.ts", "offers/draft/route.ts", "profile/complete/route.ts"]) {
    const c = read(`src/app/api/b2b/${f}`);
    assert.ok(!c.includes('"Não autorizado."') && !c.includes('"Sessão B2B inválida."'), f);
  }
  assert.ok(read("src/app/admin/(protected)/layout.tsx").includes('<SessionExpiredGuard scope="admin" loginHref="/admin/login"'));
  assert.ok(read("src/app/b2b/layout.tsx").includes('<SessionExpiredGuard scope="b2b" loginHref="/b2b/login"'));
  const guard = read("src/components/SessionExpiredGuard.tsx");
  assert.ok(guard.includes("window.location.href = loginHref") && guard.includes("Entrar de novo"));
});
