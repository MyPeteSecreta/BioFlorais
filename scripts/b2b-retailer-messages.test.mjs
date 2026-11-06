/*
 * C11: mensagens ao lojista. Validação ("frete grátis" proibido), SQL 22b
 * (idempotente, seed inicial), pop-up só uma vez por cliente, ordem das ativas.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import { hasSeenPopup, loadActiveMessages, markPopupSeen, parseMessageInput } from "../src/lib/b2b/retailer-messages.ts";

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const CLIENT_A = "00000000-0000-4000-8000-0000000000a1";
const CLIENT_B = "00000000-0000-4000-8000-0000000000b1";

before(async () => {
  pg = new PGlite();
});
after(async () => {
  await pg?.close();
});

test("nunca 'frete grátis' (título ou texto); campos obrigatórios", () => {
  assert.equal(parseMessageInput({ title: "Oi", body: "Aproveite o frete grátis" }).ok, false);
  assert.equal(parseMessageInput({ title: "Frete Grátis!", body: "texto" }).ok, false);
  assert.equal(parseMessageInput({ title: "Oi", body: "Aproveite o frete gratis" }).ok, false);
  assert.equal(parseMessageInput({ title: "", body: "texto" }).ok, false);
  assert.equal(parseMessageInput({ title: "Oi", body: "Frete especial B2B a partir de R$ 450" }).ok, true);
});

test("22b: cria as tabelas, semeia a mensagem inicial uma vez e é idempotente", async () => {
  const sql = readFileSync(new URL("../sql/b2b/22b_mensagens_lojista.sql", import.meta.url), "utf8");
  await pg.exec(sql);
  await pg.exec(sql);

  const rows = await run(`SELECT title, body, active FROM b2b_retailer_messages`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Cliente gosta de novidade!");
  assert.match(rows[0].body, /Queremos você como parceiro: frete especial, pedido mínimo baixo, entrega rápida e facilidade de pagamento\./);
  assert.equal(/frete\s+gr[aá]tis/i.test(rows[0].body), false);
});

test("só as ativas, na ordem; mensagem inativa some", async () => {
  await run(`INSERT INTO b2b_retailer_messages (title, body, sort_order) VALUES ('Segunda', 'texto 2', 20), ('Antes', 'texto 0', 5)`);
  await run(`INSERT INTO b2b_retailer_messages (title, body, active, sort_order) VALUES ('Desligada', 'x', false, 1)`);

  const messages = await loadActiveMessages(run);
  assert.deepEqual(messages.map((m) => m.title), ["Antes", "Cliente gosta de novidade!", "Segunda"]);
});

test("pop-up do 1º acesso: aparece até o cliente fechar; depois nunca mais; é por cliente", async () => {
  assert.equal(await hasSeenPopup(run, CLIENT_A), false);

  await markPopupSeen(run, CLIENT_A, null);
  await markPopupSeen(run, CLIENT_A, null); // fechar duas vezes não duplica nem falha

  assert.equal(await hasSeenPopup(run, CLIENT_A), true);
  assert.equal(await hasSeenPopup(run, CLIENT_B), false); // outro cliente ainda vê
  const [{ total }] = await run(`SELECT count(*)::int AS total FROM b2b_retailer_popup_views`);
  assert.equal(total, 1);
});

test("sem as tabelas (22b não aplicado): o link funciona sem marketing e sem pop-up", async () => {
  const empty = new PGlite();
  const emptyRun = async (text, params = []) => (await empty.query(text, params)).rows;
  assert.deepEqual(await loadActiveMessages(emptyRun), []);
  assert.equal(await hasSeenPopup(emptyRun, CLIENT_A), true);
  await empty.close();
});

test("frete grátis (regra do Luis 05/11): só junto de 'na opção econômica a partir de R$ 450'", () => {
  assert.equal(parseMessageInput({ title: "Oi", body: "Frete grátis na opção econômica a partir de R$ 450!" }).ok, true);
  assert.equal(parseMessageInput({ title: "Oi", body: "Frete GRÁTIS na opcao economica a partir de R$450 em pedidos elegíveis." }).ok, true);
  assert.equal(parseMessageInput({ title: "Frete grátis", body: "na opção econômica a partir de R$ 450" }).ok, false, "a condição vale no mesmo campo");
  assert.equal(parseMessageInput({ title: "Oi", body: "Frete grátis a partir de R$ 450" }).ok, false, "sem 'na opção econômica'");
  const error = parseMessageInput({ title: "Oi", body: "Aproveite o frete grátis" });
  assert.ok(!error.ok && error.error.includes("na opção econômica a partir de R$ 450"));
  assert.equal(parseMessageInput({ title: "Oi", body: "Frete especial na opção econômica" }).ok, true);
});

test("checkout B2B: depois do CEP, abaixo de R$ 450, a nota com o valor da região (UF verificada pelo servidor)", () => {
  const src = readFileSync(new URL("../src/app/b2b/checkout/B2BCheckoutContent.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("b2bEconomyFreightNote(quote.subtotalAfterCouponCents, quote.state)") && src.includes('data-testid="b2b-frete-especial-regiao"'));
  const cart = readFileSync(new URL("../src/app/b2b/carrinho/B2BCartContent.tsx", import.meta.url), "utf8");
  assert.ok(cart.includes("b2bFreeFreightProgressText(cart.subtotalCents)") && cart.includes("{B2B_SPECIAL_FREIGHT_LABEL}"));
  const terms = readFileSync(new URL("../src/lib/b2b/rca-terms.ts", import.meta.url), "utf8");
  assert.ok(terms.includes("frete especial na opção econômica e grátis a partir de R$ 450 em pedidos elegíveis"));
});
