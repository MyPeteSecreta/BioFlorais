// Segurança das rotas de admin.
// Rodar: node --test scripts/admin-session.test.mjs   (Node >= 23.6)
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

process.env.ADMIN_SESSION_SECRET = "segredo-de-teste";

const session = await import("../src/lib/admin/session.ts");

const validCookie = createHmac("sha256", "segredo-de-teste").update("mypeteme-admin").digest("hex");

function requestWithCookie(cookie) {
  return new Request("https://exemplo.test/api/admin/x", {
    headers: cookie === undefined ? {} : { cookie },
  });
}

test("aceita só o cookie de sessão do admin correto", () => {
  assert.equal(session.isAdminRequest(requestWithCookie(`mypeteme_admin_session=${validCookie}`)), true);
  assert.equal(
    session.isAdminRequest(requestWithCookie(`outro=1; mypeteme_admin_session=${validCookie}; x=2`)),
    true
  );
});

test("recusa sem cookie, cookie errado, truncado ou de outro nome", () => {
  assert.equal(session.isAdminRequest(requestWithCookie(undefined)), false);
  assert.equal(session.isAdminRequest(requestWithCookie("mypeteme_admin_session=")), false);
  assert.equal(session.isAdminRequest(requestWithCookie("mypeteme_admin_session=abc")), false);
  assert.equal(session.isAdminRequest(requestWithCookie(`mypeteme_admin_session=${validCookie.slice(1)}`)), false);
  assert.equal(session.isAdminRequest(requestWithCookie(`bioflorais_b2b_session=${validCookie}`)), false);
});

test("sem ADMIN_SESSION_SECRET ninguém passa", () => {
  const saved = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    assert.equal(session.isAdminRequest(requestWithCookie(`mypeteme_admin_session=${validCookie}`)), false);
  } finally {
    process.env.ADMIN_SESSION_SECRET = saved;
  }
});

// ---------------------------------------------------------------------------
// Toda rota em src/app/api/admin (exceto o login) precisa conferir a sessão
// em CADA handler exportado, antes de qualquer outra coisa.
// ---------------------------------------------------------------------------

const ADMIN_API_DIR = new URL("../src/app/api/admin", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PUBLIC_ADMIN_ROUTES = new Set(["login/route.ts"]);

function listRoutes(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listRoutes(full);
    return name === "route.ts" ? [full] : [];
  });
}

test("todas as rotas /api/admin/* (exceto login) exigem a sessão do admin", () => {
  const routes = listRoutes(ADMIN_API_DIR);
  assert.ok(routes.length >= 6, "esperava encontrar as rotas de admin");

  for (const file of routes) {
    const rel = relative(ADMIN_API_DIR, file).replace(/\\/g, "/");
    if (PUBLIC_ADMIN_ROUTES.has(rel)) continue;

    const source = readFileSync(file, "utf8");
    const handlers = [...source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\s*\(/g)];
    assert.ok(handlers.length > 0, `${rel}: nenhum handler encontrado`);

    for (const handler of handlers) {
      const bodyStart = source.indexOf("{", source.indexOf(")", source.indexOf("(", handler.index) + 1));
      // O primeiro comando do handler deve ser a checagem de sessão.
      const firstStatements = source.slice(bodyStart, bodyStart + 400);
      assert.match(
        firstStatements,
        /^\{\s*(\/\/[^\n]*\n\s*)*if \(!isAdminRequest\(request\)\)/,
        `${rel} ${handler[1]}: precisa começar com if (!isAdminRequest(request))`
      );
    }
  }
});
