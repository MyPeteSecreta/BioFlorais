/*
 * Admin → B2B → Vendedores, igual à Secreta: um cartão por pessoa, situação em destaque,
 * "Copiar acesso" com o texto combinado, WhatsApp, busca e as ações visíveis.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { B2B_LOGIN_URL, accessText, accessWhatsAppUrl, matchesSearch, sellerBadge } = await import("../src/lib/b2b/seller-card.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const person = (over = {}) => ({ kind: "responsible", name: "Maria Souza", email: "maria@exemplo.com", status: "active", phone: "(11) 91234-5678", inviteExpiresAt: null, situation: "Cadastro completo", emailOriginal: null, ...over });

test("texto de 'Copiar acesso' e WhatsApp com o endereço da Bio", () => {
  assert.equal(B2B_LOGIN_URL, "https://www.bioflorais.com.br/b2b/login");
  assert.equal(accessText("maria@exemplo.com"), "Entre em https://www.bioflorais.com.br/b2b/login com o seu e-mail maria@exemplo.com e a sua senha");
  const url = accessWhatsAppUrl(person());
  assert.match(url, /^https:\/\/wa\.me\/5511912345678\?text=/);
  assert.equal(decodeURIComponent(url.split("text=")[1]), accessText("maria@exemplo.com"));
  assert.match(accessWhatsAppUrl(person({ phone: null })), /^https:\/\/wa\.me\/\?text=/, "sem número abre o WhatsApp para escolher o contato");
});

test("selo de situação para cada caso", () => {
  const badge = (over) => sellerBadge(person(over));
  assert.deepEqual(badge({ kind: "invite", status: "invite_pending", inviteExpiresAt: "2026-10-15T15:00:00Z", situation: null }), { text: "Convite pendente (expira 15/10)", tone: "pending" });
  assert.equal(badge({ kind: "invite", status: "invite_expired", situation: null }).text, "Convite expirado");
  assert.equal(badge({ kind: "invite", status: "invite_revoked", situation: null }).text, "Convite revogado");
  assert.equal(badge({ situation: "Em teste até 12/10" }).text, "Cadastrado – em teste até 12/10");
  assert.equal(badge({}).text, "Cadastro completo");
  assert.equal(badge({ situation: "Teste vencido" }).text, "Cadastrado – teste vencido");
  assert.equal(badge({ status: "inactive" }).text, "Inativo");
  assert.equal(badge({ status: "inactive", email: "liberado+abc@invalid" }).text, "Inativo – e-mail liberado");
});

test("busca por nome ou e-mail, sem maiúsculas nem acentos; acha pelo e-mail anterior", () => {
  const row = person({ name: "José Álvares", emailOriginal: "antigo@exemplo.com" });
  assert.ok(matchesSearch(row, ""));
  assert.ok(matchesSearch(row, "jose alvares"));
  assert.ok(matchesSearch(row, "MARIA@EXEMPLO"));
  assert.ok(matchesSearch(row, "antigo@"));
  assert.ok(!matchesSearch(row, "fulano"));
});

test("tela: cartão por pessoa, busca, selo e ações visíveis por situação (sem tabela larga)", () => {
  const tab = read("src/components/admin/b2b/ResponsiblesTab.tsx");
  assert.ok(!tab.includes("<table") && !tab.includes("overflow-x-auto"));
  for (const id of ["cartao-pessoa", "situacao-pessoa", "busca-vendedor", "copiar-acesso", "whatsapp-acesso", "redefinir-senha", "copiar-convite", "whatsapp-convite", "novo-link", "revogar-convite"]) {
    assert.ok(tab.includes(`data-testid="${id}"`), id);
  }
  for (const label of ["Copiar acesso", "Redefinir senha", "Copiar link do convite", "Gerar novo link", "Revogar", "Desativar", "Reativar", "Estender teste +7 dias", "Editar e-mail/login", "Desativar e liberar e-mail", "Vendedor no Omie"]) {
    assert.ok(tab.includes(label), label);
  }
  // convite pendente: copiar/WhatsApp/revogar só quando pendente; expirado só gera novo link
  assert.ok(tab.includes('row.status === "invite_pending" && ('));
  // as ações antigas continuam ligadas às mesmas rotas
  for (const action of ["reset_access", "show_link", "regenerate", "revoke", "deactivate", "reactivate", "extend_trial", "release_email", "edit_identity", "set_omie_vendor"]) {
    assert.ok(tab.includes(`"${action}"`), action);
  }
});
