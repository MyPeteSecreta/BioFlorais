/*
 * LANÇAR PEDIDO (vendedor lança o pedido pelo cliente): cliente novo e existente, CPF/CNPJ validado,
 * CNPJ de outro vendedor bloqueado, modo lançamento autorizado só pela sessão do dono, demo bloqueada,
 * vendedor em teste pode, comissão estimada, Pix/boleto/link de cartão, origem 'vendedor', aviso LGPD.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "teste-lancar";

const launch = await import("../src/lib/b2b/vendor-launch.ts");
const constants = await import("../src/lib/b2b/launch-constants.ts");
const { createB2BResponsibleSession } = await import("../src/lib/b2b/responsible-session.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const D = "00000000-0000-4000-8000-0000000000dd";
const CNPJ = "11222333000181";
const CPF = "52998224725";

async function db({ withDocument = true } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, email text, phone text,
      ${withDocument ? "document text," : ""} active boolean NOT NULL DEFAULT true);
    CREATE TABLE b2b_client_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid,
      active boolean NOT NULL DEFAULT true, unlinked_at timestamp);
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, status text, is_demo boolean DEFAULT false, demo_expires_at timestamp);
    INSERT INTO b2b_responsibles (id, name, status, is_demo, demo_expires_at) VALUES
      ('${A}', 'Ana', 'active', false, NULL), ('${B}', 'Bia', 'active', false, NULL),
      ('${D}', 'Demo', 'active', true, now() + interval '1 day');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  // dono do documento (mesma ideia do findDocumentOwner: vínculo ativo com vendedor ativo)
  const findOwner = async (r, digits) => {
    if (!withDocument) return null;
    const [row] = await r(
      `SELECT c.id AS client_id, c.display_name, rel.responsible_id, r.name AS responsible_name
         FROM b2b_clients c JOIN b2b_client_relationships rel ON rel.client_id = c.id AND rel.active = true AND rel.unlinked_at IS NULL
         JOIN b2b_responsibles r ON r.id = rel.responsible_id AND r.status = 'active'
        WHERE c.document = $1 LIMIT 1`,
      [digits]
    );
    return row ? { clientId: String(row.client_id), clientName: String(row.display_name), responsibleId: String(row.responsible_id), responsibleName: String(row.responsible_name) } : null;
  };
  return { pg, run, findOwner };
}

test("CPF e CNPJ: dígitos verificadores validados; documento inválido recusado", () => {
  assert.equal(launch.isValidCpf(CPF), true);
  assert.equal(launch.isValidCpf("52998224724"), false);
  assert.equal(launch.isValidCpf("11111111111"), false);
  assert.equal(launch.isValidCnpj(CNPJ), true);
  assert.equal(launch.isValidCnpj("11222333000182"), false);
  assert.equal(launch.isValidCnpj("00000000000000"), false);
  assert.deepEqual(launch.parseDocument("529.982.247-25"), { ok: true, digits: CPF, kind: "cpf" });
  assert.deepEqual(launch.parseDocument("11.222.333/0001-81"), { ok: true, digits: CNPJ, kind: "cnpj" });
  assert.equal(launch.parseDocument("123").ok, false);

  const base = { name: "Loja Flor", document: CNPJ, email: "loja@flor.com", phone: "(11) 91234-5678" };
  assert.equal(launch.parseLaunchClient(base).ok, true);
  assert.equal(launch.parseLaunchClient({ ...base, name: "" }).ok, false);
  assert.equal(launch.parseLaunchClient({ ...base, document: "11222333000182" }).ok, false);
  assert.equal(launch.parseLaunchClient({ ...base, email: "sem-arroba" }).ok, false);
  assert.equal(launch.parseLaunchClient({ ...base, phone: "123" }).ok, false);
  assert.equal(launch.parseLaunchClient(base).value.phone, "11912345678");
});

test("cliente novo e existente; CNPJ de outro vendedor bloqueado; sem a coluna document cadastra mesmo assim", async () => {
  const { run, findOwner, pg } = await db();
  const input = launch.parseLaunchClient({ name: "Loja Flor", document: CNPJ, email: "loja@flor.com", phone: "11912345678" }).value;

  const created = await launch.registerLaunchClient(run, A, input, findOwner);
  assert.equal(created.ok, true);
  assert.equal(created.reused, false);
  const rows = (await pg.query("SELECT c.display_name, c.document, rel.responsible_id FROM b2b_clients c JOIN b2b_client_relationships rel ON rel.client_id = c.id")).rows;
  assert.deepEqual(rows, [{ display_name: "Loja Flor", document: CNPJ, responsible_id: A }]);

  // mesmo vendedor, mesmo documento: reaproveita (sem duplicar)
  const again = await launch.registerLaunchClient(run, A, input, findOwner);
  assert.equal(again.ok, true);
  assert.equal(again.reused, true);
  assert.equal(again.clientId, created.clientId);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM b2b_clients")).rows[0].n, 1);

  // outro vendedor: bloqueado com a mensagem pedida
  const blocked = await launch.registerLaunchClient(run, B, input, findOwner);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.error, "Cliente atendido por outro representante.");
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM b2b_clients")).rows[0].n, 1);

  // CPF de pessoa física também entra
  const pf = await launch.registerLaunchClient(run, B, { ...input, name: "Maria", document: CPF, kind: "cpf" }, findOwner);
  assert.equal(pf.ok, true);

  // SQL 35b ausente (sem a coluna): cadastra sem o documento
  const old = await db({ withDocument: false });
  const legacy = await launch.registerLaunchClient(old.run, A, input, old.findOwner);
  assert.equal(legacy.ok, true);
  assert.equal((await old.pg.query("SELECT count(*)::int AS n FROM b2b_client_relationships")).rows[0].n, 1);
});

test("modo lançamento: só o vendedor dono (sessão), ativo e fora da demonstração; vendedor em teste pode", async () => {
  const { run, pg } = await db();
  const ok = await launch.verifyLaunchAccess(run, createB2BResponsibleSession(A), A);
  assert.deepEqual(ok, { ok: true });

  assert.equal((await launch.verifyLaunchAccess(run, undefined, A)).status, 401);
  assert.equal((await launch.verifyLaunchAccess(run, "lixo", A)).status, 401);
  // cliente com ?lancar=1 mas sem sessão, ou sessão de outro vendedor: recusado
  assert.equal((await launch.verifyLaunchAccess(run, createB2BResponsibleSession(B), A)).status, 403);
  // demonstração nunca cria pedido real
  const demo = await launch.verifyLaunchAccess(run, createB2BResponsibleSession(D), D);
  assert.equal(demo.ok, false);
  assert.equal(demo.status, 403);
  // vendedor desativado
  await pg.exec(`UPDATE b2b_responsibles SET status = 'inactive' WHERE id = '${B}'`);
  assert.equal((await launch.verifyLaunchAccess(run, createB2BResponsibleSession(B), B)).status, 403);
  // a verificação não olha período de teste/cadastro completo: vendedor em teste PODE lançar
  assert.ok(!read("src/lib/b2b/vendor-launch.ts").includes("trial"));
});

test("comissão estimada: base + extra total por item, só onde há regra; sem regra não inventa", () => {
  assert.deepEqual(
    launch.estimateCommissionCents([
      { unitPriceCents: 10000, paidQty: 2, commissionTotalPercent: "10" },
      { unitPriceCents: 5000, paidQty: 1, commissionTotalPercent: "12.5" },
      { unitPriceCents: 0, paidQty: 0, commissionTotalPercent: "10" },
    ]),
    { cents: 2000 + 625, configured: true }
  );
  assert.deepEqual(launch.estimateCommissionCents([{ unitPriceCents: 10000, paidQty: 1, commissionTotalPercent: null }]), { cents: 0, configured: false });
  assert.equal(constants.buildCardPayLinkPath("abc", "t k"), "/b2b/pagar?pedido=abc&b2b=t%20k");
});

test("servidor: pedido lançado revalida sessão e dono, grava origin 'vendedor', mínimo/comissão/promoção seguem a mesma cotação", () => {
  const create = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(create.includes("body.launched === true") && create.includes("verifyLaunchAccess") && create.includes("B2B_SESSION_COOKIE"));
  assert.ok(create.includes("LAUNCH_ORIGIN") && create.includes("findDocumentOwner") && create.includes("LAUNCH_OTHER_REP_MESSAGE"));
  assert.ok(create.includes("computeB2BQuote") && create.includes("buildQuoteItemSnapshots"), "mesma cotação e mesma comissão congelada");
  // a recusa do lançamento vem ANTES de gravar qualquer coisa
  assert.ok(create.indexOf("verifyLaunchAccess(") < create.indexOf(".insert(customers)"));
  assert.ok(create.indexOf("findDocumentOwner(") < create.indexOf(".insert(customers)"));
  // snapshot extraído: mesma função na criação e na prévia
  assert.ok(read("src/lib/b2b/order-snapshots.ts").includes("buildOrderItemSnapshots") && read("src/lib/b2b/order-snapshots.ts").includes("loadCommissionMatrix"));
  const quote = read("src/app/api/b2b/shipping/quote/route.ts");
  assert.ok(quote.includes("estimateCommissionCents") && quote.includes("verifyLaunchAccess"));
  // comissão só sai depois da verificação de sessão
  assert.ok(quote.indexOf("verifyLaunchAccess(") < quote.indexOf("estimateCommissionCents("));
});

test("pagamento: Pix com envio por WhatsApp, boleto PJ igual, cartão NUNCA digitado pelo vendedor (link de pagamento)", () => {
  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.ok(checkout.includes('order.paymentMethod === "card" && launched && payLink') && checkout.includes('order.paymentMethod === "card" && !launched'));
  assert.ok(checkout.includes("link-pagamento-cartao") && checkout.includes("Enviar Pix por WhatsApp") && checkout.includes("buildCardPayLinkPath"));
  assert.ok(checkout.includes("comissao-estimada") && checkout.includes("launched,"));
  // boleto só PJ segue no servidor
  assert.ok(read("src/app/api/b2b/orders/create/route.ts").includes("Boleto disponível apenas para pessoa jurídica"));
  // link de pagamento: pay-info exige o token da oferta; a rota do cartão continua exigindo token/sessão
  assert.ok(read("src/app/api/b2b/orders/pay-info/route.ts").includes("verifyB2BOrderOfferToken"));
  const pay = read("src/app/b2b/pagar/PayLinkContent.tsx");
  assert.ok(pay.includes("B2BMercadoPagoCardPayment") && pay.includes("pay-info"));
  assert.ok(read("src/app/api/b2b/payments/mercadopago/card/route.ts").includes("verifyB2BOrderPaymentAccess"));
});

test("painel, loja do link, relatório e LGPD", () => {
  const painel = read("src/app/b2b/painel/page.tsx");
  assert.ok(painel.includes("Lançar pedido") && painel.includes("/b2b/painel/lancar-pedido"));
  assert.ok(read("src/app/b2b/painel/lancar-pedido/page.tsx").includes("loadDemoState"));
  const ui = read("src/components/b2b/LaunchOrder.tsx");
  assert.ok(ui.includes("LAUNCH_LGPD_NOTICE") && ui.includes("/api/b2b/launch/clients") && ui.includes("Sem promoção") && ui.includes("Offer Builder"));
  assert.equal(constants.LAUNCH_LGPD_NOTICE, "Dados informados pelo representante com autorização do cliente.");
  assert.equal(constants.LAUNCH_ORIGIN, "vendedor");
  // a loja do link é a mesma: só ganha a faixa de modo lançamento
  const layout = read("src/app/b2b/oferta/[token]/layout.tsx");
  assert.ok(layout.includes("LaunchModeMarker"));
  assert.ok(read("src/components/b2b/LaunchModeMarker.tsx").includes("sessionStorage"));
  // relatório do admin mostra a origem
  assert.ok(read("src/app/api/admin/b2b/tracking/route.ts").includes("'origin'") && read("src/components/admin/b2b/TrackingTab.tsx").includes("Lançado pelo vendedor"));
  // rotas novas exigem o vendedor logado
  for (const route of ["src/app/api/b2b/launch/clients/route.ts", "src/app/api/b2b/launch/offers/route.ts"]) assert.ok(read(route).includes("requireResponsible"), route);
  assert.ok(read("src/app/api/b2b/launch/buyer/route.ts").includes("verifyLaunchAccess"));
});
