/*
 * Painel do vendedor como app instalável: manifesto ("Bio Florais Vendas", tela cheia, cor da marca), service worker sem cache,
 * sessão de 30 dias com "Manter conectado" e a página "Instale no seu celular". A instalabilidade foi conferida no Chrome (CDP).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "segredo-de-teste";

const { B2B_SESSION_MAX_AGE, B2B_SESSION_REMEMBER_MAX_AGE, createB2BResponsibleSession, readB2BResponsibleSession } = await import("../src/lib/b2b/responsible-session.ts");
const { GET: manifestGet } = await import("../src/app/b2b/painel/manifest.webmanifest/route.ts");
const { GET: swGet } = await import("../src/app/b2b/sw.js/route.ts");

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

test("sessão: 12 horas por padrão; com 'Manter conectado' 30 dias; assinatura e leitura continuam valendo", () => {
  assert.equal(B2B_SESSION_MAX_AGE, 12 * 3600);
  assert.equal(B2B_SESSION_REMEMBER_MAX_AGE, 30 * 24 * 3600);

  const normal = readB2BResponsibleSession(createB2BResponsibleSession("abc"));
  const lembrada = readB2BResponsibleSession(createB2BResponsibleSession("abc", B2B_SESSION_REMEMBER_MAX_AGE));

  assert.equal(normal.responsibleId, "abc");
  assert.ok(Math.abs(normal.expiresAt - Date.now() - 12 * 3600 * 1000) < 5000);
  assert.ok(Math.abs(lembrada.expiresAt - Date.now() - 30 * 24 * 3600 * 1000) < 5000);
  assert.equal(readB2BResponsibleSession(createB2BResponsibleSession("abc", -10)), null, "sessão vencida não é aceita");
  assert.equal(readB2BResponsibleSession(createB2BResponsibleSession("abc") + "x"), null, "assinatura adulterada não é aceita");
});

test("login e logout: 30 dias só se marcar; Sair apaga o cookie", () => {
  const login = read("src/app/api/b2b/auth/login/route.ts");
  assert.ok(login.includes("body.remember === true ? B2B_SESSION_REMEMBER_MAX_AGE : B2B_SESSION_MAX_AGE"));
  assert.ok(login.includes("createB2BResponsibleSession(responsible.id, maxAge)") && login.includes("      maxAge,\n"));
  assert.ok(read("src/app/api/b2b/auth/logout/route.ts").includes("maxAge: 0"));
  assert.ok(read("src/app/b2b/login/page.tsx").includes("Manter conectado") && read("src/app/b2b/login/page.tsx").includes("remember"));
});

test("manifesto: nome, tela cheia, cor da marca, escopo /b2b/ e ícones que existem em /public", async () => {
  const response = manifestGet();
  assert.match(response.headers.get("content-type"), /manifest\+json/);

  const manifest = await response.json();
  assert.equal(manifest.name, "Bio Florais Vendas");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#55245f");
  assert.equal(manifest.start_url, "/b2b/painel");
  assert.equal(manifest.scope, "/b2b/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192") && manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));

  for (const icon of manifest.icons) assert.ok(existsSync(new URL(`public${icon.src}`, root)), icon.src);
  assert.ok(existsSync(new URL("public/b2b/app/apple-touch-icon.png", root)));
});

test("service worker: escopo /b2b/, só tela de 'sem conexão', e NUNCA guarda dados em cache", async () => {
  const response = swGet();
  const script = await response.text();

  assert.equal(response.headers.get("service-worker-allowed"), "/b2b/");
  assert.ok(script.includes("fetch(event.request)") && script.includes("Sem conexão"));
  assert.ok(!/caches\.|cache\.put|addAll/.test(script));
});

test("painel e página de instalação: manifesto no layout, registro do SW, passo a passo Android e iPhone, menu", () => {
  const layout = read("src/app/b2b/painel/layout.tsx");
  assert.ok(layout.includes('manifest: "/b2b/painel/manifest.webmanifest"') && layout.includes("appleWebApp") && layout.includes("themeColor") && layout.includes("<PwaRegister />"));
  assert.ok(layout.includes('href="/b2b/painel/instalar"') && layout.includes("Instale no celular"));
  assert.ok(read("src/components/b2b/PwaRegister.tsx").includes('"/b2b/sw.js"'));

  const install = read("src/components/b2b/InstallApp.tsx");
  assert.ok(install.includes("Android (Chrome)") && install.includes("iPhone (Safari)") && install.includes("Adicionar à Tela de Início") && install.includes("beforeinstallprompt"));
  assert.ok(read("src/app/b2b/painel/instalar/page.tsx").includes("Instale no seu celular"));
});
