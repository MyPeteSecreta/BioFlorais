/*
 * Contato do vendedor (nome e WhatsApp): validação, quem pode trocar o quê e auditoria (SQL 53b). O fluxo completo (admin edita,
 * vendedor troca o próprio WhatsApp, registro de quem/quando) foi exercitado no harness com banco PGlite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { changeContact, normalizeWhatsApp, parseContactPatch } from "../src/lib/b2b/vendor-contact.ts";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

test("WhatsApp: só com DDD, 10 ou 11 dígitos, aceita +55 e máscara, recusa lixo", () => {
  assert.equal(normalizeWhatsApp("(11) 99999-8888"), "11999998888");
  assert.equal(normalizeWhatsApp("+55 21 99876-5432"), "21998765432");
  assert.equal(normalizeWhatsApp("1133334444"), "1133334444");
  assert.equal(normalizeWhatsApp("(11) 88888-7777"), null, "celular de 11 dígitos começa com 9");
  assert.equal(normalizeWhatsApp("123"), null);
  assert.equal(normalizeWhatsApp("00999998888"), null, "DDD inválido");
  assert.equal(normalizeWhatsApp("11111111111"), null);
  assert.equal(normalizeWhatsApp(null), null);
});

test("patch: nome de 3 a 120 letras, WhatsApp válido, e precisa mudar alguma coisa", () => {
  assert.deepEqual(parseContactPatch({ name: "  Ana   Paula ", whatsapp: "(11) 99999-8888" }), { ok: true, value: { name: "Ana Paula", whatsapp: "11999998888" } });
  assert.equal(parseContactPatch({ name: "A" }).ok, false);
  assert.equal(parseContactPatch({ whatsapp: "abc" }).ok, false);
  assert.equal(parseContactPatch({}).ok, false);
});

test("troca: grava só o que mudou, registra quem e quando (antigo e novo) e não registra quando nada mudou", async () => {
  const calls = [];
  const run = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT name, phone")) return [{ name: "Ana", phone: "11999990000" }];
    return [];
  };

  const same = await changeContact(run, "id1", { whatsapp: "11999990000" }, { kind: "vendedor", label: "Ana" });
  assert.ok(same.ok && same.changed.length === 0);
  assert.equal(calls.filter((c) => c.sql.includes("b2b_responsible_audit")).length, 0);

  calls.length = 0;
  const done = await changeContact(run, "id1", { name: "Ana Paula", whatsapp: "21998765432" }, { kind: "admin", label: "Admin" });
  assert.ok(done.ok && done.changed.join() === "name,phone");
  const audits = calls.filter((c) => c.sql.includes("INSERT INTO b2b_responsible_audit"));
  assert.equal(audits.length, 2);
  assert.deepEqual(audits[1].params.slice(1), ["phone", "11999990000", "21998765432", "admin", "Admin"]);
});

test("contratos: admin edita nome e WhatsApp; vendedor só o próprio WhatsApp, pela sessão", () => {
  const admin = read("src/app/api/admin/b2b/responsibles/[id]/route.ts");
  assert.ok(admin.includes('case "edit_contact"') && admin.includes('kind: "admin"') && admin.includes("parseContactPatch"));

  const seller = read("src/app/api/b2b/profile/contact/route.ts");
  assert.ok(seller.includes("readB2BResponsibleSession(request.cookies.get(B2B_SESSION_COOKIE)?.value)") && seller.includes("status: 401"));
  assert.ok(seller.includes("parseContactPatch({ whatsapp: body?.whatsapp })") && seller.includes("{ whatsapp: parsed.value.whatsapp }"), "o nome nunca vem do vendedor");
  assert.ok(seller.includes("session.responsibleId"));

  assert.ok(read("src/app/b2b/painel/cadastro/page.tsx").includes("ContactWhatsAppForm"));
  assert.ok(read("src/components/admin/b2b/ResponsiblesTab.tsx").includes("Editar nome e WhatsApp") && read("src/components/admin/b2b/ResponsiblesTab.tsx").includes("contato-ultima-alteracao"));

  const sql = read("sql/b2b/53b_contato_vendedor_auditoria.sql");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS b2b_responsible_audit") && !/DELETE FROM|DROP TABLE|TRUNCATE/i.test(sql));
});
