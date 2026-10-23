/*
 * Rodada 19b — correções dos testes do Luis:
 *  1) imprimir/reabrir pelo link pessoal, pelo link geral (storefront) e pela sessão B2B (inclusive "lançar pedido");
 *  2) "Continuar compra" é o botão principal do orçamento em todo lugar; imprimir/WhatsApp/copiar link são secundários;
 *  3) admin: cliente "teste" (sem apagar, escondido por padrão) e aba "Clientes do site (B2C)" (só leitura);
 *  4) complemento do Omie: máximo de 60, o resto vai para a observação, sem falhar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "teste-segredo-rodada-19b";

const access = await import("../src/lib/b2b/order-access.ts");
const session = await import("../src/lib/b2b/responsible-session.ts");
const links = await import("../src/lib/b2b/quote-links.ts");
const draft = await import("../src/lib/b2b/quote-draft.ts");
const note = await import("../src/lib/order-note.ts");
const clients = await import("../src/lib/b2b/client-admin.ts");
const siteClients = await import("../src/lib/b2b/site-clients.ts");
const sheet = await import("../src/lib/b2b/order-sheet.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const CLIENT = "50000000-0000-4000-8000-000000000001";
const OTHER_CLIENT = "50000000-0000-4000-8000-000000000002";
const SELLER = "40000000-0000-4000-8000-000000000001";
const OTHER_SELLER = "40000000-0000-4000-8000-000000000002";
const ORDER = "70000000-0000-4000-8000-000000000001";

const order = (over = {}) => ({ id: ORDER, status: "pending", clientId: CLIENT, responsibleId: SELLER, origin: null, originCode: null, ...over });
const decide = (over = {}) =>
  access.decideOrderAccess({ order: order(), context: null, storefrontReferral: null, sessionResponsibleId: null, sessionActive: false, ...over });

test("1) acesso: link pessoal do lojista (o pedido é do cliente do token)", () => {
  assert.equal(decide({ context: { clientId: CLIENT, isStorefront: false } }), "client-link");
  assert.equal(decide({ context: { clientId: OTHER_CLIENT, isStorefront: false } }), null, "token de outro cliente");
  assert.equal(decide({ context: null }), null, "sem token e sem sessão");
});

test("1) acesso: link geral (storefront) só para pedido da vitrine daquele vendedor", () => {
  const store = { clientId: "qualquer", isStorefront: true };
  assert.equal(decide({ context: store, order: order({ origin: "parceiros", originCode: "ANA01" }), storefrontReferral: "ANA01" }), "storefront-link");
  assert.equal(decide({ context: store, order: order({ origin: "parceiros", originCode: null }), storefrontReferral: "ANA01" }), "storefront-link", "sem código gravado");
  assert.equal(decide({ context: store, order: order({ origin: "parceiros", originCode: "OUTRO" }), storefrontReferral: "ANA01" }), null, "vitrine de outro vendedor");
  assert.equal(decide({ context: store, order: order({ origin: null }), storefrontReferral: "ANA01" }), null, "pedido que não é da vitrine");
  assert.equal(decide({ context: store, order: order({ origin: "vendedor" }), storefrontReferral: "ANA01" }), null);
});

test("1) acesso: sessão B2B logada (representante, também no modo lançar) só para os pedidos dele", () => {
  assert.equal(decide({ sessionResponsibleId: SELLER, sessionActive: true }), "vendor-session");
  assert.equal(decide({ sessionResponsibleId: OTHER_SELLER, sessionActive: true }), null, "pedido de outro representante");
  assert.equal(decide({ sessionResponsibleId: SELLER, sessionActive: false }), null, "representante inativo");
  // lançar pedido: pedido com origem "vendedor" aberto com token do cliente ou só pela sessão
  assert.equal(decide({ order: order({ origin: "vendedor" }), sessionResponsibleId: SELLER, sessionActive: true }), "vendor-session");
  assert.equal(decide({ order: order({ origin: "vendedor" }), context: { clientId: CLIENT, isStorefront: false } }), "client-link");
});

test("1) acesso pelo banco: sessão assinada do representante resolve sem token; cookie inválido/outro representante não", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, status text, referral_code text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, b2b_client_id uuid, b2b_responsible_id uuid, b2b_offer_id uuid, origin text, origin_code text, archived_at timestamp);
    INSERT INTO b2b_responsibles VALUES ('${SELLER}', 'active', 'ANA01'), ('${OTHER_SELLER}', 'inactive', 'BIA02');
    INSERT INTO orders (id, status, b2b_client_id, b2b_responsible_id, b2b_offer_id, origin) VALUES ('${ORDER}', 'quote', '${CLIENT}', '${SELLER}', '60000000-0000-4000-8000-000000000001', 'vendedor');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  const good = await access.authorizeOrderView(run, { orderId: ORDER, sessionCookie: session.createB2BResponsibleSession(SELLER) });
  assert.equal(good.ok, true);
  assert.equal(good.via, "vendor-session");
  assert.equal(good.order.status, "quote");

  const otherSeller = await access.authorizeOrderView(run, { orderId: ORDER, sessionCookie: session.createB2BResponsibleSession(OTHER_SELLER) });
  assert.equal(otherSeller.ok, false);
  assert.equal(otherSeller.status, 404, "sem permissão = não encontrado (não revela o pedido)");

  assert.equal((await access.authorizeOrderView(run, { orderId: ORDER, sessionCookie: "lixo.assinatura" })).ok, false);
  assert.equal((await access.authorizeOrderView(run, { orderId: ORDER })).ok, false);
  assert.equal((await access.authorizeOrderView(run, { orderId: "nao-uuid", sessionCookie: session.createB2BResponsibleSession(SELLER) })).ok, false);
  assert.equal((await access.authorizeOrderView(run, { orderId: "70000000-0000-4000-8000-0000000000ff", sessionCookie: session.createB2BResponsibleSession(SELLER) })).ok, false);

  // pedido arquivado (teste) não abre
  await pg.exec(`UPDATE orders SET archived_at = now()`);
  assert.equal((await access.authorizeOrderView(run, { orderId: ORDER, sessionCookie: session.createB2BResponsibleSession(SELLER) })).ok, false);
});

test("1) a folha é carregada sem filtro de cliente quando o acesso já foi decidido (e continua filtrando quando se passa o cliente)", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text, phone text, cpf text, cnpj text);
    CREATE TABLE addresses (id uuid PRIMARY KEY, cep text, street text, number text, complement text, district text, city text, state text);
    CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, line_slug text);
    CREATE TABLE orders (id uuid PRIMARY KEY, status text, payment_method text, subtotal_cents int, coupon_code text, coupon_discount_cents int DEFAULT 0,
      payment_method_discount_cents int DEFAULT 0, shipping_service_name text, shipping_cents int, total_cents int, customer_id uuid, shipping_address_id uuid,
      b2b_responsible_name text, b2b_client_id uuid, b2b_offer_id uuid, origin text, commercial_adjustments_json text, created_at timestamptz DEFAULT now());
    CREATE TABLE order_items (id serial PRIMARY KEY, order_id uuid, product_id uuid, qty int, unit_price_cents int);
    INSERT INTO customers VALUES ('80000000-0000-4000-8000-000000000001', 'Loja X', 'x@x.com', '11912345678', NULL, '11222333000181');
    INSERT INTO addresses VALUES ('81000000-0000-4000-8000-000000000001', '01310100', 'Rua A', '1', NULL, 'Centro', 'São Paulo', 'SP');
    INSERT INTO orders (id, status, subtotal_cents, shipping_cents, total_cents, customer_id, shipping_address_id, b2b_client_id, b2b_offer_id)
      VALUES ('${ORDER}', 'pending', 1000, 0, 1000, '80000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '${CLIENT}', '60000000-0000-4000-8000-000000000001');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  assert.equal((await sheet.loadOrderSheet(run, ORDER, null)).buyer.name, "Loja X");
  assert.equal((await sheet.loadOrderSheet(run, ORDER, CLIENT)).buyer.name, "Loja X");
  assert.equal(await sheet.loadOrderSheet(run, ORDER, OTHER_CLIENT), null);
});

test("1) rotas de impressão usam a autorização única (token pessoal, link geral, sessão) e existe rota só com sessão", () => {
  const byToken = read("src/app/b2b/oferta/[token]/pedidos/[orderId]/imprimir/page.tsx");
  assert.ok(byToken.includes("authorizeOrderView(run, { orderId, token, sessionCookie"), "token + sessão");
  assert.ok(!byToken.includes("isStorefront"), "o link geral não é mais recusado de saída");
  const bySession = read("src/app/b2b/pedido/[orderId]/imprimir/page.tsx");
  assert.ok(bySession.includes("authorizeOrderView(run, { orderId, sessionCookie"));
  const reopen = read("src/app/api/b2b/orders/quote/route.ts");
  assert.ok(reopen.includes("authorizeOrderView(run, {") && !reopen.includes("resolution.context.isStorefront"), "reabrir aceita link geral e sessão");
  assert.ok(read("src/app/admin/(protected)/pedidos/[id]/folha/page.tsx").includes("loadOrderSheet(getAppSqlRunner(), id, null)"));
});

test("2) links do orçamento: Continuar compra restaura a sacola NA LOJA; WhatsApp/copiar nunca levam o modo lançar", () => {
  assert.equal(links.continueQuotePath("tok en", "abc"), "/b2b/oferta/tok%20en?orcamento=abc");
  assert.equal(links.continueQuotePath("t", "abc", true), "/b2b/oferta/t?orcamento=abc&lancar=1");
  assert.equal(links.printQuotePath("abc", "t"), "/b2b/oferta/t/pedidos/abc/imprimir");
  assert.equal(links.printQuotePath("abc"), "/b2b/pedido/abc/imprimir");
  assert.equal(links.tokenFromOfferUrl("https://www.bioflorais.com.br/b2b/oferta/AbC_123"), "AbC_123");
  const wa = links.quoteWhatsAppUrl("https://x.com/b2b/oferta/t?orcamento=1", "(11) 91234-5678", "Maria");
  assert.ok(wa.startsWith("https://wa.me/5511912345678?text="));
  assert.ok(decodeURIComponent(wa).includes("Olá, Maria!") && decodeURIComponent(wa).includes("?orcamento=1"));
  assert.ok(links.quoteWhatsAppUrl("u", null).startsWith("https://wa.me/?text="));
  const actions = read("src/components/b2b/QuoteActions.tsx");
  assert.ok(actions.includes('.replace(/([?&])lancar=1&?/, "$1")'), "o link compartilhado é o do lojista");
});

test("2) rascunho do orçamento reaberto: guarda/lê/limpa e tolera armazenamento ausente ou lixo", () => {
  const map = new Map();
  const storage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => void map.set(k, String(v)), removeItem: (k) => void map.delete(k) };
  assert.equal(draft.readQuoteDraft(storage, "t"), null);
  const value = { quoteId: "q1", notice: "Orçamento restaurado", customer: { personType: "pj", name: "Loja", email: "a@x.com", phone: "11", cpf: "", cnpj: "1", stateRegistration: "" }, address: null, orderNote: "Ligar antes", couponCode: "BEM" };
  assert.equal(draft.writeQuoteDraft(storage, "t", value), true);
  assert.deepEqual(draft.readQuoteDraft(storage, "t"), value);
  assert.equal(draft.readQuoteDraft(storage, "outro"), null);
  draft.clearQuoteDraft(storage, "t");
  assert.equal(draft.readQuoteDraft(storage, "t"), null);
  map.set(draft.quoteDraftKey("t"), "{lixo");
  assert.equal(draft.readQuoteDraft(storage, "t"), null);
  assert.equal(draft.writeQuoteDraft(null, "t", value), false);
  assert.equal(draft.readQuoteDraft(null, "t"), null);
});

test("2) Continuar compra é o botão PRINCIPAL em Meus pedidos, tela após salvar, painel do representante e admin; a loja restaura a sacola", () => {
  const actions = read("src/components/b2b/QuoteActions.tsx");
  const order = ['data-testid="continuar-compra"', 'data-testid="orcamento-imprimir"', 'data-testid="orcamento-whatsapp"', 'data-testid="orcamento-copiar"'].map((part) => actions.indexOf(part));
  assert.ok(order.every((index) => index > 0) && [...order].sort((a, b) => a - b).join() === order.join(), "ordem: Continuar compra, depois Imprimir, WhatsApp e Copiar link");
  assert.ok(actions.includes("PRIMARY") && actions.includes("SECONDARY"));

  const mine = read("src/app/b2b/oferta/[token]/pedidos/page.tsx");
  assert.ok(mine.includes("<QuoteActions") && mine.includes("continueQuotePath(token, quote.orderId)") && !mine.includes("Reabrir e escolher o pagamento"));

  const checkout = read("src/app/b2b/checkout/B2BCheckoutContent.tsx");
  assert.ok(checkout.includes("continueQuotePath(linkToken, savedQuote.id, launched)") && checkout.includes("<QuoteActions") && checkout.includes("readQuoteDraft(window.sessionStorage, token)"));
  assert.ok(checkout.includes("clearQuoteDraft(window.sessionStorage, token)"));

  const vendor = read("src/components/b2b/QuoteReopenButton.tsx");
  const vendorOrder = ['data-testid="continuar-compra"', 'data-testid="imprimir-orcamento-vendedor"', 'data-testid="orcamento-whatsapp"', 'data-testid="orcamento-copiar"'].map((part) => vendor.indexOf(part));
  assert.ok(vendorOrder.every((index) => index > 0) && [...vendorOrder].sort((a, b) => a - b).join() === vendorOrder.join() && vendor.includes("continueQuotePath(token, quoteId, true)"));
  assert.ok(read("src/app/b2b/painel/cliente/[clientId]/page.tsx").includes("<QuoteReopenButton"));

  const admin = read("src/app/admin/(protected)/pedidos/[id]/page.tsx");
  assert.ok(admin.includes("<QuoteActions") && admin.includes("readActiveOfferLink") && admin.includes("/folha"));

  const layout = read("src/app/b2b/oferta/[token]/layout.tsx");
  assert.ok(layout.includes("<QuoteRestore token={token} />"));
  const restore = read("src/components/b2b/QuoteRestore.tsx");
  assert.ok(restore.includes("cart.load(data.lines") && restore.includes("writeQuoteDraft(") && restore.includes("Ir para o checkout") && restore.includes('next.delete("orcamento")'));
});

async function seedClients() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY, display_name text NOT NULL, contact_name text, email text, phone text, active boolean DEFAULT true,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), archived_at timestamp, is_test boolean NOT NULL DEFAULT false);
    CREATE TABLE b2b_client_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid, active boolean DEFAULT true, linked_at timestamp DEFAULT now(), unlinked_at timestamp);
    INSERT INTO b2b_clients (id, display_name, is_test) VALUES ('30000000-0000-4000-8000-00000000000a', 'Loja Real', false), ('30000000-0000-4000-8000-00000000000b', 'Loja Teste Ltda', true);`);
  await pg.exec(read("sql/b2b/47b_clientes_edicao.sql"));
  const run = async (text, params = []) => (await pg.query(text, params)).rows;
  return { pg, run };
}

test("3a) clientes de teste: escondidos por padrão, 'mostrar testes' inclui, marcar/desmarcar grava histórico e não apaga", async () => {
  const { run } = await seedClients();
  const A = "30000000-0000-4000-8000-00000000000a";
  const B = "30000000-0000-4000-8000-00000000000b";

  assert.deepEqual((await clients.searchClients(run, "")).map((c) => c.id), [A], "testes escondidos por padrão");
  const all = await clients.searchClients(run, "", 40, { includeTests: true });
  assert.equal(all.length, 2);
  assert.equal(all.find((c) => c.id === B).isTest, true);
  assert.equal(all.find((c) => c.id === A).isTest, false);
  assert.equal((await clients.searchClients(run, "teste")).length, 0, "a busca também respeita o filtro");
  assert.equal((await clients.searchClients(run, "teste", 40, { includeTests: true })).length, 1);

  assert.equal((await clients.setClientTest(run, A, true, "")).ok, false, "quem alterou é obrigatório");
  const marked = await clients.setClientTest(run, A, true, "Luis");
  assert.equal(marked.ok && marked.changed, true);
  assert.equal(marked.client.isTest, true);
  assert.deepEqual((await clients.searchClients(run, "")).map((c) => c.id), [], "marcado some da lista padrão");
  assert.equal((await clients.searchClients(run, "", 40, { includeTests: true })).length, 2, "continua cadastrado");

  const again = await clients.setClientTest(run, A, true, "Luis");
  assert.equal(again.ok && again.changed, false, "repetir não grava histórico");
  const edits = await clients.listClientEdits(run, A);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].changedBy, "Luis");
  assert.deepEqual(edits[0].changes, ["Cliente de teste: não → sim"]);

  const back = await clients.setClientTest(run, A, false, "Maria");
  assert.equal(back.ok && back.changed, true);
  assert.deepEqual((await clients.listClientEdits(run, A))[0].changes, ["Cliente de teste: sim → não"]);
  assert.deepEqual((await clients.searchClients(run, "")).map((c) => c.id), [A]);
  assert.equal((await clients.setClientTest(run, "30000000-0000-4000-8000-0000000000ff", true, "Luis")).status, 404);
});

test("3a) ligações: filtro e marcação na tela, rota PATCH só para admin, sem apagar", () => {
  const tab = read("src/components/admin/b2b/ClientsTab.tsx");
  for (const part of ["Mostrar clientes de teste", "Marcar como cliente de teste", "Voltar a cliente normal", 'method: "PATCH"', 'data-testid="selo-teste"']) assert.ok(tab.includes(part), part);
  const route = read("src/app/api/admin/b2b/clients/[id]/route.ts");
  assert.ok(route.includes("export async function PATCH") && route.includes("isAdminRequest(request)") && !/export async function (DELETE|POST)/.test(route));
  assert.ok(read("src/app/api/admin/b2b/clients/route.ts").includes('searchParams.get("tests") === "1"'));
});

test("3b) Clientes do site (B2C): agrupa por e-mail, só pedidos B2C, ignora orçamento/arquivado, soma só o pago, busca e link para os pedidos", async () => {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE customers (id uuid PRIMARY KEY, name text, email text);
    CREATE TABLE addresses (id uuid PRIMARY KEY, city text, state text);
    CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid, shipping_address_id uuid, status text, total_cents int, b2b_offer_id uuid, archived_at timestamp, created_at timestamptz);
    INSERT INTO customers VALUES
      ('c0000000-0000-4000-8000-000000000001', 'Ana Souza', 'Ana@Exemplo.com'),
      ('c0000000-0000-4000-8000-000000000002', 'Ana S.', 'ana@exemplo.com '),
      ('c0000000-0000-4000-8000-000000000003', 'Bruno Lima', 'bruno@exemplo.com'),
      ('c0000000-0000-4000-8000-000000000004', 'Lojista', 'loja@exemplo.com'),
      ('c0000000-0000-4000-8000-000000000005', 'Sem Email', '');
    INSERT INTO addresses VALUES ('d0000000-0000-4000-8000-000000000001', 'Campinas', 'SP'), ('d0000000-0000-4000-8000-000000000002', 'Niterói', 'RJ');
    INSERT INTO orders VALUES
      ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'paid', 10000, NULL, NULL, '2026-09-01T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'approved', 5000, NULL, NULL, '2026-10-10T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'pending', 7000, NULL, NULL, '2026-10-12T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'paid', 2000, NULL, '2026-10-01', '2026-10-01T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'paid', 90000, 'f0000000-0000-4000-8000-000000000001', NULL, '2026-10-05T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'checkout_pending', 3000, NULL, NULL, '2026-10-06T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'quote', 3000, NULL, NULL, '2026-10-07T10:00:00Z'),
      ('e0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'paid', 1000, NULL, NULL, '2026-10-08T10:00:00Z');`);
  const run = async (text, params = []) => (await pg.query(text, params)).rows;

  // sem a coluna archived_at em orders o filtro simplesmente não existe; aqui ela existe
  const list = await siteClients.searchSiteClients(run, "");
  assert.deepEqual(list.map((c) => c.email), ["ana@exemplo.com"], "só a Ana: Bruno só tem pedido arquivado/técnico/orçamento; lojista é B2B; sem e-mail fica de fora");
  const ana = list[0];
  assert.equal(ana.orders, 3);
  assert.equal(ana.paidOrders, 2);
  assert.equal(ana.totalPaidCents, 15000);
  assert.equal(ana.name, "Ana S.", "nome do pedido mais recente");
  assert.equal(ana.city, "Niterói");
  assert.equal(ana.state, "RJ");
  assert.equal(ana.lastOrderAt, "2026-10-12T10:00:00Z");

  assert.equal((await siteClients.searchSiteClients(run, "niterói")).length, 1);
  assert.equal((await siteClients.searchSiteClients(run, "ana@")).length, 1);
  assert.equal((await siteClients.searchSiteClients(run, "inexistente")).length, 0);

  const tab = read("src/components/admin/b2b/SiteClientsTab.tsx");
  const tabCode = tab.replace(/\/\*[\s\S]*?\*\//g, "").replace(/export default/, "");
  assert.ok(tab.includes("/admin/pedidos?cliente=") && tab.includes("Somente leitura") && !/exportar|baixar|csv|download/i.test(tabCode), "sem exportação");
  const route = read("src/app/api/admin/b2b/site-clients/route.ts");
  assert.ok(route.includes("isAdminRequest(request)") && !/export async function (POST|PUT|PATCH|DELETE)/.test(route), "só leitura");
  assert.ok(read("src/components/admin/b2b/AdminB2BTabs.tsx").includes('{ id: "siteclients", label: "Clientes do site (B2C)" }'));
  assert.ok(read("src/app/admin/(protected)/pedidos/page.tsx").includes("lower(btrim(${customers.email})) = ${clienteEmail}"), "filtro por comprador na lista de pedidos");
});

test("4) complemento do Omie: até 60 passa; mais que 60 é cortado em 60 e o resto vai para a observação, sem falhar", () => {
  assert.deepEqual(note.splitComplementForOmie("Apto 12"), { complement: "Apto 12", overflow: null });
  assert.deepEqual(note.splitComplementForOmie(""), { complement: null, overflow: null });
  assert.deepEqual(note.splitComplementForOmie(null), { complement: null, overflow: null });
  const exact = "a".repeat(60);
  assert.deepEqual(note.splitComplementForOmie(exact), { complement: exact, overflow: null });

  const long = "Deixar com o porteiro e ligar antes de chegar porque a campainha não funciona direito";
  const result = note.splitComplementForOmie(long);
  assert.ok(result.complement.length <= 60 && result.complement.length >= 40);
  assert.equal(`${result.complement} ${result.overflow}`, long, "nada se perde: complemento + resto = texto original");
  assert.ok(!result.complement.endsWith(" ") && !result.overflow.startsWith(" "));
  assert.ok(!/\w$/.test(result.complement) || long.charAt(result.complement.length) === " ", "não parte palavra quando dá para evitar");

  const noSpaces = note.splitComplementForOmie("x".repeat(75));
  assert.equal(noSpaces.complement.length, 60);
  assert.equal(noSpaces.overflow.length, 15);

  assert.equal(note.splitComplementForOmie("Bloco B\napto 4\t\t fundos").complement, "Bloco B apto 4 fundos", "quebras e tabs viram espaço");
  assert.equal(note.omieComplementOverflowLine("o resto"), "COMPLEMENTO (continuação): o resto");
  assert.equal(note.omieComplementOverflowLine(null), null);
  assert.equal(note.omieComplementOverflowLine("  "), null);
});

test("4) Central/Omie: o endereço sai com complemento ≤ 60 e o resto na observação do Pedido de Venda", () => {
  const central = read("src/lib/central/brand-api.ts");
  assert.ok(central.includes("splitComplementForOmie(row.complement)") && central.includes("observations.push(overflowLine)"));
  assert.ok(central.includes("complement: complement.complement"), "campo do endereço já cortado");
  assert.ok(central.includes("a.cep, a.street, a.number, a.complement, a.district"));
  const contract = read("src/lib/central/contract.ts");
  assert.ok(contract.includes("address?:") && contract.includes("cortado em 60"));
});
