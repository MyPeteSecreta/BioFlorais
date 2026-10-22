/*
 * Rodada 19e — sacola B2B: editar a QUANTIDADE (− / digitar / +), revalidando na hora promoções, kit com display, mínimo e frete.
 * Digitar nunca remove o item (apagar o número para digitar outro não esvazia a linha).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const q = await import("../src/lib/b2b/qty-input.ts");
const displays = await import("../src/lib/b2b/cart-displays.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("quantidade digitada: só valores válidos (≥1) viram quantidade; vazio/0/letras ficam como rascunho", () => {
  assert.equal(q.parseQtyDraft("12"), 12);
  assert.equal(q.parseQtyDraft("007"), 7);
  assert.equal(q.parseQtyDraft(""), null, "apagar para digitar outro número NÃO remove o item");
  assert.equal(q.parseQtyDraft("0"), null);
  assert.equal(q.parseQtyDraft("abc"), null);
  assert.equal(q.parseQtyDraft("1a2"), 12);
  assert.equal(q.parseQtyDraft("99999"), 9999, "teto");
  assert.equal(q.parseQtyDraft("123456789"), 9999);
});

test("+ e −: sobem e descem de 1 em 1, respeitando 1 e o teto (− em 1 não remove: use Remover)", () => {
  assert.equal(q.stepQty(5, 1), 6);
  assert.equal(q.stepQty(5, -1), 4);
  assert.equal(q.stepQty(1, -1), 1);
  assert.equal(q.stepQty(9999, 1), 9999);
  assert.equal(q.clampQty(0), 1);
  assert.equal(q.clampQty(Number.NaN), 1);
  assert.equal(q.clampQty(3.9), 3);
});

test("kit com display: a composição é revalidada quando a quantidade muda (display sai se o kit ficar incompleto)", () => {
  const display = { key: "adulto-compacto", name: "Display Adulto", composition: [{ productId: "p1", qty: 6 }, { productId: "p2", qty: 6 }] };
  const complete = displays.reconcileDisplayList([display], [{ productId: "p1", qty: 6 }, { productId: "p2", qty: 6 }]);
  assert.equal(complete.removed.length, 0);
  assert.equal(complete.displays.length, 1);
  const reduced = displays.reconcileDisplayList([display], [{ productId: "p1", qty: 5 }, { productId: "p2", qty: 6 }]);
  assert.equal(reduced.removed.length, 1, "qtd menor que o kit: o display grátis sai");
  const bigger = displays.reconcileDisplayList([display], [{ productId: "p1", qty: 12 }, { productId: "p2", qty: 6 }]);
  assert.equal(bigger.removed.length, 0, "qtd maior mantém o kit");
});

test("ligações: sacola e checkout usam o QtyStepper; o carrinho reconcilia o kit a cada mudança; o checkout recalcula a cotação", () => {
  const cart = read("src/app/b2b/carrinho/B2BCartContent.tsx");
  assert.ok(cart.includes("<QtyStepper qty={line.qty}") && cart.includes("cart.setQty(line.productId, qty)"));
  assert.ok(!cart.includes("Number(event.target.value.replace"), "o campo antigo (que removia ao apagar) saiu");

  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.ok(checkout.includes("<QtyStepper qty={line.qty}") && checkout.includes("cart.removeItem(line.productId)"));
  assert.ok(checkout.includes("const requestKey = JSON.stringify([token, itemsPayload,"), "a quantidade faz parte da chave da cotação (promoções, frete e total revalidam)");
  assert.ok(checkout.includes("B2B_MIN_ORDER_CENTS") && checkout.includes("aviso-minimo"));
  assert.ok(checkout.includes("cart.subtotalCents < B2B_MIN_ORDER_CENTS}"), "não confirma abaixo do mínimo");
  assert.ok(checkout.includes("cart.notice"), "aviso quando o display sai do kit");

  const context = read("src/lib/b2b/cart-context.tsx");
  assert.ok(context.includes("return reconcileDisplays(reduce(state, action))"), "toda mudança de quantidade reconcilia o kit");

  const stepper = read("src/components/b2b/QtyStepper.tsx");
  assert.ok(stepper.includes("Diminuir") && stepper.includes("Aumentar") && stepper.includes("onBlur"));
  assert.ok(!/onChange\(0\)|onChange\(Number\(/.test(stepper), "nunca envia 0 (que removeria a linha)");
});
