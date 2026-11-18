/*
 * Cupom de criadora (UGC) → Academia, item 20 (18/11). O fluxo completo roda com banco e Academia de teste em
 * scripts/dev-harness/ugc-fluxo.mjs; aqui ficam as travas de código que impedem a volta dos 3 problemas achados:
 *  1) no cartão o "order_created" nunca era mandado (a criadora ficava sem a venda);
 *  2) pedido cancelado no admin não avisava a Academia (a comissão ficava);
 *  3) evento que falhava só era reenviado quando outro pedido de criadora era pago.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("cartão: o order_created é gravado estacionado e liberado antes do paid", () => {
  const create = read("src/app/api/orders/create/route.ts");
  assert.ok(create.includes("    if (partnerCoupon) {\n      const partnerEventId ="), "grava também no cartão");
  assert.ok(create.includes("isCardCheckout ? PARTNER_EVENT_PARKED_UNTIL : null"), "estacionado no cartão");

  const confirm = read("src/lib/partners/confirm-paid.ts");
  const release = confirm.indexOf(":order_created`");
  const paid = confirm.indexOf("`${BRAND}:${orderId}:paid`");
  assert.ok(release > 0 && paid > release, "libera o order_created antes de gravar o paid");
  assert.ok(confirm.includes('export const PARTNER_EVENT_PARKED_UNTIL = new Date("2999-01-01T00:00:00.000Z")'));
});

test("cancelado no admin manda 'cancelled' (uma vez, só com cupom de criadora, nunca lança)", () => {
  const confirm = read("src/lib/partners/confirm-paid.ts");
  assert.ok(confirm.includes("export async function enqueuePartnerCancelled(") && confirm.includes(":cancelled`") && confirm.includes("onConflictDoNothing"));
  assert.ok(read("src/app/api/admin/orders/[id]/fulfillment/route.ts").includes('if (status === "cancelled") await enqueuePartnerCancelled(id);'));
});

test("o cron de 15 minutos reenvia a fila (independe do e-mail)", () => {
  const cron = read("src/app/api/cron/remind-unpaid-orders/route.ts");
  const dispatch = cron.indexOf("dispatchPartnerOutbox(20)");
  assert.ok(dispatch > 0 && dispatch < cron.indexOf("if (!mailConfigured())"), "antes da checagem do e-mail");
});
