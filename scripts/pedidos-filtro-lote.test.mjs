/*
 * Item 40 (13/11): /admin/pedidos com filtro Todos / Só pagos / Só não pagos, etapa nos pagos, e "Mover para etapa X" em lote pela MESMA
 * rota da tela de cada pedido (PATCH /api/admin/orders/<id>/fulfillment), com confirmação e relatório de falhas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lib = await import("../src/lib/admin/order-filters.ts");
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const rows = [
  { id: "pago-preparar", status: "paid", fulfillmentStatus: "paid_to_prepare" },
  { id: "pago-separando", status: "approved", fulfillmentStatus: "separating" },
  { id: "pago-enviado", status: "paid", fulfillmentStatus: "shipped" },
  { id: "boleto-liberado", status: "pending", fulfillmentStatus: "paid_to_prepare" },
  { id: "pendente", status: "pending", fulfillmentStatus: "awaiting_payment" },
  { id: "orcamento", status: "quote", fulfillmentStatus: null },
  { id: "cancelado", status: "cancelled", fulfillmentStatus: "cancelled" },
];
const ids = (list) => list.map((row) => row.id);

test("filtros: Todos / Só pagos (com boleto a prazo liberado) / Só não pagos; cancelado só em Todos", () => {
  assert.deepEqual(ids(lib.filterOrders(rows, "todos", null)), ids(rows));
  assert.deepEqual(ids(lib.filterOrders(rows, "pagos", null)), ["pago-preparar", "pago-separando", "pago-enviado", "boleto-liberado"]);
  assert.deepEqual(ids(lib.filterOrders(rows, "nao-pagos", null)), ["pendente", "orcamento"]);
  assert.deepEqual(ids(lib.filterOrders(rows, "pagos", "paid_to_prepare")), ["pago-preparar", "boleto-liberado"]);
  assert.deepEqual(ids(lib.filterOrders(rows, "pagos", "shipped")), ["pago-enviado"]);
  assert.deepEqual(ids(lib.filterOrders(rows, "nao-pagos", "shipped")), ["pendente", "orcamento"], "etapa só vale nos pagos");
});

test("parâmetros da URL: valores estranhos voltam ao padrão; o link mantém o cliente e só leva a etapa nos pagos", () => {
  assert.equal(lib.parsePaymentFilter("pagos"), "pagos");
  assert.equal(lib.parsePaymentFilter(["nao-pagos"]), "nao-pagos");
  assert.equal(lib.parsePaymentFilter("x"), "todos");
  assert.equal(lib.parseStageFilter("separating"), "separating");
  assert.equal(lib.parseStageFilter("drop table"), null);
  assert.equal(lib.ordersFilterHref({ payment: "todos" }), "/admin/pedidos");
  assert.equal(lib.ordersFilterHref({ payment: "pagos", stage: "separating", cliente: "a@b.com" }), "/admin/pedidos?cliente=a%40b.com&pagamento=pagos&etapa=separating");
  assert.equal(lib.ordersFilterHref({ payment: "nao-pagos", stage: "separating" }), "/admin/pedidos?pagamento=nao-pagos");
});

test("lote: só as etapas que a rota individual muda (sem Enviado, que pede rastreio, e sem Cancelado); relatório com as falhas", () => {
  assert.deepEqual(lib.BATCH_STAGES.map((stage) => stage.key), ["paid_to_prepare", "separating", "ready_to_ship"]);
  assert.equal(lib.batchReport("Em separação", 5, []), "5 de 5 pedidos movidos para Em separação.");
  assert.equal(
    lib.batchReport("Em separação", 3, [{ number: "AB12CD34", error: "Pedido ainda não está pago." }]),
    "2 de 3 pedidos movidos para Em separação. Não foram: #AB12CD34 (Pedido ainda não está pago.)."
  );

  // as etapas do lote são aceitas pela rota individual (mesmas travas: pago/liberado, não volta de enviado)
  const route = read("src/app/api/admin/orders/[id]/fulfillment/route.ts");
  for (const stage of lib.BATCH_STAGES) assert.ok(route.includes(`"${stage.key}"`), stage.key);
  assert.ok(route.includes("scheduleOrderEmail(id)") && route.includes("canFulfillOrder(order)"));
});

test("tela: filtros na /admin/pedidos; lote chama a rota individual um por vez, com confirmação; selecionar todos da página", () => {
  const page = read("src/app/admin/(protected)/pedidos/page.tsx");
  assert.ok(page.includes("filterOrders(allOrderRows, paymentFilter, stageFilter)") && page.includes('data-testid="filtros-pedidos"'));
  const batch = read("src/components/admin/OrderBatchSelection.tsx");
  assert.ok(batch.includes("/api/admin/orders/${encodeURIComponent(id)}/fulfillment") && batch.includes('method: "PATCH"'));
  assert.ok(batch.includes("window.confirm(`Mover ${noun} para ${stage.label}?`)"), "confirmação");
  assert.ok(batch.includes("for (const id of ids)"), "um por vez");
  assert.ok(batch.includes("Selecionar todos da página"));
  assert.ok(read("src/app/admin/(protected)/layout.tsx").includes('href="/admin/recuperacao"'), "menu do admin com Recuperação");
});
