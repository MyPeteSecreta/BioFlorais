// Testes do fluxo de convite/senha do B2B (partes puras, sem banco).
// Rodar: node --test scripts/   (Node >= 23.6)
import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { test } from "node:test";

import * as links from "../src/lib/b2b/invite-links.ts";
import * as password from "../src/lib/b2b/password.ts";
import * as token from "../src/lib/b2b/token.ts";

test("tipos de responsável: só rca e clt", () => {
  assert.equal(links.isB2BResponsibleType("rca"), true);
  assert.equal(links.isB2BResponsibleType("clt"), true);
  assert.equal(links.isB2BResponsibleType("admin"), false);
  assert.equal(links.isB2BResponsibleType("toString"), false);
  assert.equal(links.isB2BResponsibleType(undefined), false);
});

test("e-mail normalizado e validado", () => {
  assert.equal(links.normalizeEmail("  Maria@Exemplo.COM "), "maria@exemplo.com");
  assert.equal(links.isValidEmail("maria@exemplo.com"), true);
  assert.equal(links.isValidEmail("maria@exemplo"), false);
});

test("WhatsApp: DDI 55 automático, texto codificado e fallback sem telefone", () => {
  const url = links.buildWhatsAppUrl("(11) 99999-8888", "Olá & link");
  assert.equal(url, "https://wa.me/5511999998888?text=Ol%C3%A1%20%26%20link");
  assert.equal(links.buildWhatsAppUrl("", "x"), "https://wa.me/?text=x");
  assert.equal(links.buildWhatsAppUrl("5511999998888", "x"), "https://wa.me/5511999998888?text=x");
});

test("mensagem do convite leva o link e o primeiro nome", () => {
  const onboarding = links.buildInviteMessage({ name: "Maria Silva", url: "https://x/b2b/convite/T", purpose: "onboarding" });
  assert.match(onboarding, /^Olá, Maria!/);
  assert.match(onboarding, /https:\/\/x\/b2b\/convite\/T/);
  const reset = links.buildInviteMessage({ name: "Maria", url: "U", purpose: "password_reset" });
  assert.match(reset, /nova senha/);
});

test("senha: formato scrypt$<salt b64url>$<hash b64url> e verificação", () => {
  const stored = password.hashPassword("senha-forte-123");
  assert.match(stored, /^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(password.verifyPassword("senha-forte-123", stored), true);
  assert.equal(password.verifyPassword("senha-errada", stored), false);
  assert.equal(password.verifyPassword("x", "bcrypt$abc$def"), false);
});

test("senha: compatível com hashes gravados pelo login B2B antigo da Bio", () => {
  // Mesmo algoritmo do login anterior: salt e hash em base64url, keylen = tamanho do hash.
  const salt = randomBytes(16);
  const legacyHash = scryptSync("senha-antiga", salt, 32);
  const legacyStored = `scrypt$${salt.toString("base64url")}$${legacyHash.toString("base64url")}`;
  assert.equal(password.verifyPassword("senha-antiga", legacyStored), true);
  assert.equal(password.verifyPassword("outra", legacyStored), false);
});

test("token do convite: opaco, 256 bits, só o hash vai ao banco", () => {
  const raw = token.generateOpaqueToken();
  assert.equal(Buffer.from(raw, "base64url").length, 32);
  assert.match(token.hashToken(raw), /^[0-9a-f]{64}$/);
  assert.notEqual(token.hashToken(raw), raw);
  assert.notEqual(token.generateOpaqueToken(), raw);
});
