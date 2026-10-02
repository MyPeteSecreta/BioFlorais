/*
 * ISOLAMENTO DE VENDEDOR + SQLs do Offer Builder, contra Postgres REAL em
 * memória (PGlite). Usa as MESMAS consultas da aplicação
 * (src/lib/b2b/ownership.ts e src/lib/b2b/commission.ts) e executa de
 * verdade os SQLs que o Luis roda no Neon (06a, 06b duas vezes, 07a, 07b).
 *
 * Rodar: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import {
  findOwnedClient,
  findOwnedOffer,
  listOwnedClients,
  listOwnedOffersForClient,
} from "../src/lib/b2b/ownership.ts";
import { loadCommissionMatrix } from "../src/lib/b2b/commission.ts";

const ID = {
  vendorA: "00000000-0000-4000-8000-00000000000a",
  vendorB: "00000000-0000-4000-8000-00000000000b",
  vendorInactive: "00000000-0000-4000-8000-00000000000c",
  clientA1: "00000000-0000-4000-8000-0000000000a1",
  clientA2: "00000000-0000-4000-8000-0000000000a2",
  clientB1: "00000000-0000-4000-8000-0000000000b1",
  clientMoved: "00000000-0000-4000-8000-0000000000d1",
  clientOfInactive: "00000000-0000-4000-8000-0000000000c1",
  offerA1: "00000000-0000-4000-8000-00000000f0a1",
  offerB1: "00000000-0000-4000-8000-00000000f0b1",
  offerMovedOld: "00000000-0000-4000-8000-00000000f0d1",
};

let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;
const sqlFile = (name) => readFileSync(new URL(`../sql/b2b/${name}`, import.meta.url), "utf8");

// Estrutura mínima das tabelas reais da Bio (colunas usadas pelo app/SQLs).
const FIXTURE_DDL = `
  CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE, name text NOT NULL, line_slug text, category text,
    price_cents integer NOT NULL DEFAULT 1000, weight_grams integer, length_cm integer,
    width_cm integer, height_cm integer, active boolean NOT NULL DEFAULT true, sku text
  );
  CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
  CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending');
  CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
    product_id uuid NOT NULL REFERENCES products(id), qty integer NOT NULL, unit_price_cents integer NOT NULL
  );
  CREATE TABLE b2b_responsibles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, status text NOT NULL DEFAULT 'pending'
  );
  CREATE TABLE b2b_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, contact_name text,
    email text, phone text, active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE b2b_client_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES b2b_clients(id),
    responsible_id uuid NOT NULL REFERENCES b2b_responsibles(id), active boolean NOT NULL DEFAULT true,
    linked_at timestamp NOT NULL DEFAULT now(), unlinked_at timestamp
  );
  CREATE TABLE b2b_commercial_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, name text NOT NULL,
    active boolean NOT NULL DEFAULT true, b2c_visible boolean NOT NULL DEFAULT true,
    b2b_visible boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE b2b_commercial_group_products (
    commercial_group_id uuid NOT NULL REFERENCES b2b_commercial_groups(id),
    product_id uuid NOT NULL REFERENCES products(id),
    PRIMARY KEY (commercial_group_id, product_id)
  );
  CREATE TABLE b2b_promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, scope text NOT NULL, type text NOT NULL,
    commercial_purpose text NOT NULL DEFAULT 'general', eligibility_scope text NOT NULL DEFAULT 'none',
    eligibility_history_key text, percentage numeric, fixed_discount_cents integer, fixed_price_cents integer,
    buy_quantity integer, free_quantity integer, seller_selectable boolean NOT NULL DEFAULT true,
    starts_at timestamp, ends_at timestamp, active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE b2b_promotion_commercial_groups (
    promotion_id uuid NOT NULL REFERENCES b2b_promotions(id),
    commercial_group_id uuid NOT NULL REFERENCES b2b_commercial_groups(id),
    PRIMARY KEY (promotion_id, commercial_group_id)
  );
  CREATE TABLE b2b_promotion_products (
    promotion_id uuid NOT NULL REFERENCES b2b_promotions(id),
    product_id uuid NOT NULL REFERENCES products(id),
    PRIMARY KEY (promotion_id, product_id)
  );
  CREATE TABLE b2b_offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES b2b_clients(id),
    responsible_id uuid NOT NULL REFERENCES b2b_responsibles(id), status text NOT NULL DEFAULT 'draft',
    created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
    activated_at timestamp, revoked_at timestamp
  );
  CREATE TABLE b2b_offer_commercial_groups (
    offer_id uuid NOT NULL REFERENCES b2b_offers(id),
    commercial_group_id uuid NOT NULL REFERENCES b2b_commercial_groups(id),
    PRIMARY KEY (offer_id, commercial_group_id)
  );
  CREATE TABLE b2b_offer_promotions (
    offer_id uuid NOT NULL REFERENCES b2b_offers(id), promotion_id uuid NOT NULL REFERENCES b2b_promotions(id),
    promotion_term_id uuid, max_uses integer, uses_count integer NOT NULL DEFAULT 0,
    valid_from timestamp, valid_until timestamp, created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (offer_id, promotion_id)
  );
  CREATE TABLE b2b_offer_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid NOT NULL REFERENCES b2b_offers(id),
    token_hash text NOT NULL UNIQUE, expires_at timestamp, revoked_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  );
`;

before(async () => {
  pg = new PGlite();
  await pg.exec(FIXTURE_DDL);

  await pg.exec(`
    INSERT INTO b2b_responsibles (id, name, status) VALUES
      ('${ID.vendorA}', 'Vendedor A', 'active'),
      ('${ID.vendorB}', 'Vendedor B', 'active'),
      ('${ID.vendorInactive}', 'Vendedor desativado', 'inactive');

    INSERT INTO b2b_clients (id, display_name) VALUES
      ('${ID.clientA1}', 'Farmácia A1'),
      ('${ID.clientA2}', 'Empório A2'),
      ('${ID.clientB1}', 'Pet Shop B1'),
      ('${ID.clientMoved}', 'Cliente transferido de A para B'),
      ('${ID.clientOfInactive}', 'Cliente do desativado');

    INSERT INTO b2b_client_relationships (client_id, responsible_id, active, unlinked_at) VALUES
      ('${ID.clientA1}', '${ID.vendorA}', true, NULL),
      ('${ID.clientA2}', '${ID.vendorA}', true, NULL),
      ('${ID.clientB1}', '${ID.vendorB}', true, NULL),
      ('${ID.clientMoved}', '${ID.vendorA}', false, now()),
      ('${ID.clientMoved}', '${ID.vendorB}', true, NULL),
      ('${ID.clientOfInactive}', '${ID.vendorInactive}', true, NULL);

    INSERT INTO b2b_offers (id, client_id, responsible_id, status) VALUES
      ('${ID.offerA1}', '${ID.clientA1}', '${ID.vendorA}', 'draft'),
      ('${ID.offerB1}', '${ID.clientB1}', '${ID.vendorB}', 'draft'),
      ('${ID.offerMovedOld}', '${ID.clientMoved}', '${ID.vendorA}', 'active');

    INSERT INTO products (slug, name, line_slug) VALUES
      ('adulto-floral-em-gotas-sono', 'Sono Adulto', 'adulto'),
      ('adulto-floral-em-gotas-ansiedade', 'Ansiedade Adulto', 'adulto'),
      ('pet-floral-em-gotas-ansiedade', 'Ansiedade Pet', 'pet'),
      ('infantil-floral-em-gotas-sono', 'Sono Infantil', 'infantil'),
      ('baby-floral-em-gotas-sono', 'Sono Baby', 'baby'),
      ('baby-floral-em-gotas-colica', 'Cólica Baby', 'baby'),
      ('cosmeticos-shampoo', 'Shampoo', 'cosmeticos');

    INSERT INTO b2b_commercial_groups (slug, name, active) VALUES
      ('bio-b2b-test-group', 'BIO-B2B TEST GROUP', true),
      ('bio-b2b-test-group-5519ea839c1d460b', 'BIO-B2B TEST GROUP 5519ea839c1d460b', true);
  `);
});

after(async () => {
  await pg?.close();
});

// ---------------------------------------------------------------------------
// Isolamento entre dois vendedores
// ---------------------------------------------------------------------------

test("cada vendedor lista só os próprios clientes", async () => {
  const a = await listOwnedClients(run, ID.vendorA);
  const b = await listOwnedClients(run, ID.vendorB);

  assert.deepEqual(a.map((client) => client.displayName), ["Empório A2", "Farmácia A1"]);
  assert.deepEqual(
    b.map((client) => client.displayName).sort(),
    ["Cliente transferido de A para B", "Pet Shop B1"]
  );
  assert.equal(a.some((client) => client.id === ID.clientB1), false);
  assert.equal(b.some((client) => client.id === ID.clientA1), false);
});

test("vendedor não abre cliente nem oferta do outro (nem trocando ids na URL)", async () => {
  assert.equal(await findOwnedClient(run, ID.vendorA, ID.clientB1), null);
  assert.equal(await findOwnedClient(run, ID.vendorB, ID.clientA1), null);
  assert.ok(await findOwnedClient(run, ID.vendorA, ID.clientA1));

  assert.equal(await findOwnedOffer(run, ID.vendorA, ID.offerB1), null);
  assert.equal(await findOwnedOffer(run, ID.vendorB, ID.offerA1), null);
  assert.ok(await findOwnedOffer(run, ID.vendorA, ID.offerA1));

  // Oferta própria, mas apontando para cliente de outro vendedor.
  assert.equal(await findOwnedOffer(run, ID.vendorA, ID.offerA1, ID.clientB1), null);
  assert.ok(await findOwnedOffer(run, ID.vendorA, ID.offerA1, ID.clientA1));

  assert.deepEqual(await listOwnedOffersForClient(run, ID.vendorA, ID.clientB1), []);
  assert.equal((await listOwnedOffersForClient(run, ID.vendorB, ID.clientB1)).length, 1);
});

test("cliente transferido: o vendedor antigo perde acesso (inclusive à oferta antiga)", async () => {
  assert.equal(await findOwnedClient(run, ID.vendorA, ID.clientMoved), null);
  assert.ok(await findOwnedClient(run, ID.vendorB, ID.clientMoved));
  assert.equal(await findOwnedOffer(run, ID.vendorA, ID.offerMovedOld), null);
});

test("vendedor desativado não enxerga nada", async () => {
  assert.deepEqual(await listOwnedClients(run, ID.vendorInactive), []);
  assert.equal(await findOwnedClient(run, ID.vendorInactive, ID.clientOfInactive), null);
});

test("ids inválidos não chegam ao banco (null, sem erro de SQL)", async () => {
  assert.equal(await findOwnedClient(run, ID.vendorA, "1 OR 1=1"), null);
  assert.equal(await findOwnedOffer(run, "x", ID.offerA1), null);
  assert.deepEqual(await listOwnedClients(run, "nao-e-uuid"), []);
});

// ---------------------------------------------------------------------------
// SQLs reais: preflight + seed (duas vezes) + candidato do Offer Builder
// ---------------------------------------------------------------------------

test("06a (preflight) roda antes do seed sem a tabela de comissão", async () => {
  const [row] = await run(sqlFile("06a_seed_promocoes_teste_preflight_one_shot.sql"));
  const preflight = row.preflight_seed_promocoes;

  assert.equal(preflight.commission_rules_table_exists, false);
  assert.equal(preflight.baby_sono_candidates.length, 1);
  assert.equal(preflight.products_by_line.adulto, 2);
});

test("06b (seed) é idempotente e cria exatamente o pedido do Luis", async () => {
  await pg.exec(sqlFile("06b_seed_promocoes_teste.sql"));
  await pg.exec(sqlFile("06b_seed_promocoes_teste.sql")); // segunda vez: não duplica

  const groups = await run(
    `SELECT slug, active FROM b2b_commercial_groups ORDER BY sort_order, slug`
  );
  assert.deepEqual(groups, [
    { slug: "bio-b2b-test-group", active: false },
    { slug: "bio-b2b-test-group-5519ea839c1d460b", active: false },
    { slug: "adulto", active: true },
    { slug: "pet", active: true },
    { slug: "infantil", active: true },
    { slug: "baby", active: true },
  ]);

  const [{ total: groupProducts }] = await run(
    `SELECT count(*)::int AS total FROM b2b_commercial_group_products`
  );
  assert.equal(groupProducts, 6); // 2 adulto + 1 pet + 1 infantil + 2 baby (cosméticos fora)

  const promotions = await run(
    `SELECT p.name, p.buy_quantity, p.free_quantity, g.slug AS line,
            (SELECT string_agg(pr.slug, ',') FROM b2b_promotion_products pp
               JOIN products pr ON pr.id = pp.product_id WHERE pp.promotion_id = p.id) AS only_products,
            (SELECT count(*)::int FROM b2b_commission_rules r WHERE r.promotion_id = p.id) AS rules
       FROM b2b_promotions p
       JOIN b2b_promotion_commercial_groups pg ON pg.promotion_id = p.id
       JOIN b2b_commercial_groups g ON g.id = pg.commercial_group_id
      ORDER BY g.sort_order, p.name`
  );

  assert.equal(promotions.length, 8);
  assert.ok(promotions.every((promotion) => promotion.rules === 7));
  assert.deepEqual(
    promotions.filter((promotion) => promotion.line === "baby").map((promotion) => promotion.only_products),
    ["baby-floral-em-gotas-sono", "baby-floral-em-gotas-sono"]
  );
  assert.ok(
    promotions
      .filter((promotion) => promotion.line !== "baby")
      .every((promotion) => promotion.only_products === null)
  );
  assert.deepEqual(
    promotions.filter((promotion) => promotion.name.startsWith("3 por 2")).map((p) => [p.buy_quantity, p.free_quantity])[0],
    [2, 1]
  );
  assert.deepEqual(
    promotions.filter((promotion) => promotion.name.startsWith("4 por 2")).map((p) => [p.buy_quantity, p.free_quantity])[0],
    [2, 2]
  );

  const [{ total: generalRules }] = await run(
    `SELECT count(*)::int AS total FROM b2b_commission_rules WHERE scope IN ('responsible_base', 'normal_price')`
  );
  assert.equal(generalRules, 2);
});

test("matriz de comissão lida do banco: valores do seed e override por vendedor", async () => {
  const matrixA = await loadCommissionMatrix(run, ID.vendorA, ID.clientA1);

  assert.equal(matrixA.configured, true);
  assert.equal(matrixA.basePercent, 10);
  assert.equal(matrixA.normalExtraPercent, 15);

  const [promotion3x2] = await run(`SELECT id FROM b2b_promotions WHERE name = '3 por 2 - Adulto'`);
  const [promotion4x2] = await run(`SELECT id FROM b2b_promotions WHERE name = '4 por 2 - Pet'`);

  const extras = (matrix, promotionId) =>
    matrix.rules
      .filter((rule) => rule.promotionId === promotionId)
      .map((rule) => `${rule.eligibilityMode}:${rule.maxUses ?? rule.durationDays}=${rule.extraPercent}`);

  assert.deepEqual(extras(matrixA, promotion3x2.id), [
    "days:30=10", "days:60=8", "days:90=6", "days:180=3",
    "uses:1=10", "uses:2=8", "uses:3=6",
  ]);
  assert.deepEqual(extras(matrixA, promotion4x2.id), [
    "days:30=6", "days:60=4", "days:90=2", "days:180=1",
    "uses:1=6", "uses:2=4", "uses:3=2",
  ]);

  // Override de base só para o vendedor B.
  await run(
    `INSERT INTO b2b_commission_rules (scope, responsible_id, base_percent) VALUES ('responsible_base', $1, 12)`,
    [ID.vendorB]
  );
  assert.equal((await loadCommissionMatrix(run, ID.vendorB, ID.clientB1)).basePercent, 12);
  assert.equal((await loadCommissionMatrix(run, ID.vendorA, ID.clientA1)).basePercent, 10);

  // Override por cliente vence o do vendedor.
  await run(
    `INSERT INTO b2b_commission_rules (scope, responsible_id, client_id, base_percent)
     VALUES ('responsible_base', $1, $2, 14)`,
    [ID.vendorB, ID.clientB1]
  );
  assert.equal((await loadCommissionMatrix(run, ID.vendorB, ID.clientB1)).basePercent, 14);
});

test("07b (Offer Builder) aplica e 07a confirma as colunas", async () => {
  await pg.exec(sqlFile("07b_offer_builder_candidate_if_not_exists.sql"));
  await pg.exec(sqlFile("07b_offer_builder_candidate_if_not_exists.sql")); // idempotente

  const [row] = await run(sqlFile("07a_offer_builder_preflight_one_shot.sql"));
  const columns = row.preflight_offer_builder.columns;

  assert.ok(columns.length > 0);
  assert.deepEqual(columns.filter((column) => column.status !== "ok"), []);
});

test("08b desativa o grupo de teste (com sufixo hex) sem apagar nada; 09b cria as demais linhas", async () => {
  // Reativa os dois grupos de teste para provar o 08b.
  await run(`UPDATE b2b_commercial_groups SET active = true WHERE slug LIKE 'bio-b2b-test-group%'`);

  await pg.exec(sqlFile("08b_desativar_grupo_de_teste.sql"));
  await pg.exec(sqlFile("08b_desativar_grupo_de_teste.sql")); // idempotente

  const tests = await run(
    `SELECT slug, active, b2b_visible FROM b2b_commercial_groups WHERE slug LIKE 'bio-b2b-test-group%' ORDER BY slug`
  );
  assert.equal(tests.length, 2); // nada foi apagado
  assert.ok(tests.every((row) => row.active === false && row.b2b_visible === false));

  await pg.exec(sqlFile("09b_linhas_b2b_demais.sql"));
  await pg.exec(sqlFile("09b_linhas_b2b_demais.sql")); // idempotente

  const lines = await run(
    `SELECT g.slug, (SELECT count(*)::int FROM b2b_commercial_group_products gp WHERE gp.commercial_group_id = g.id) AS produtos
       FROM b2b_commercial_groups g WHERE g.slug = 'cosmeticos'`
  );
  // Só a linha com produto ativo vira card; kids/teen/etc. sem produto não são criadas.
  assert.deepEqual(lines, [{ slug: "cosmeticos", produtos: 1 }]);
  const [{ total }] = await run(`SELECT count(*)::int AS total FROM b2b_commercial_groups WHERE slug IN ('kids','teen','home-care')`);
  assert.equal(total, 0);
  // Nenhuma promoção criada para a linha nova: preço B2B normal.
  const [{ promos }] = await run(
    `SELECT count(*)::int AS promos FROM b2b_promotion_commercial_groups pg
       JOIN b2b_commercial_groups g ON g.id = pg.commercial_group_id WHERE g.slug = 'cosmeticos'`
  );
  assert.equal(promos, 0);
});

test("08a (preflight de dados de teste) roda, é somente leitura e acha o grupo de teste", async () => {
  await pg.exec(`ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS email text;
                 CREATE TABLE IF NOT EXISTS coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, active boolean);`);
  const [row] = await run(sqlFile("08a_dados_de_teste_preflight_one_shot.sql"));
  const result = row.preflight_dados_de_teste;

  assert.equal(result.grupos_teste.length, 2);
  assert.ok(Array.isArray(result.ofertas_recentes));
  assert.ok(Array.isArray(result.linhas_de_produto_ativas_sem_grupo));
});

test("teste de linha: o filtro de grupos de teste do Offer Builder", async () => {
  const { isTestCommercialGroup } = await import("@/lib/b2b/offer-builder");
  assert.equal(isTestCommercialGroup({ slug: "x", name: "BIO-B2B TEST GROUP 5519ea839c1d460b" }), true);
  assert.equal(isTestCommercialGroup({ slug: "bio-b2b-test-group", name: "qualquer" }), true);
  assert.equal(isTestCommercialGroup({ slug: "adulto", name: "Adulto" }), false);
  assert.equal(isTestCommercialGroup({ slug: "cosmeticos", name: "Cosméticos" }), false);
});

test("08c desativa só o vendedor e o cliente de teste pelo id exato; vendedor inativo não loga nem acessa", async () => {
  await pg.exec(`
    ALTER TABLE b2b_responsibles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE b2b_clients ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    INSERT INTO b2b_responsibles (id, name, status, email) VALUES
      ('dcb67a56-cadf-4cce-ab46-86fb1285f288', 'BIO-B2B TEST 5519ea839c1d460b', 'active', 't@example.invalid'),
      (gen_random_uuid(), 'Bio-B2B-Test5', 'active', 'manual@example.invalid');
    INSERT INTO b2b_clients (id, display_name) VALUES
      ('1d403746-7519-454e-a9e6-32408d62d1ec', 'BIO-B2B TEST CLIENT 5519ea839c1d460b'),
      (gen_random_uuid(), 'ClienteTesteB2');
  `);

  await pg.exec(sqlFile("08c_desativar_vendedor_e_cliente_de_teste.sql"));
  await pg.exec(sqlFile("08c_desativar_vendedor_e_cliente_de_teste.sql")); // idempotente

  const responsibles = await run(`SELECT name, status FROM b2b_responsibles WHERE name LIKE '%Test%' OR name LIKE '%TEST%' ORDER BY name`);
  assert.deepEqual(responsibles, [
    { name: "BIO-B2B TEST 5519ea839c1d460b", status: "inactive" },
    { name: "Bio-B2B-Test5", status: "active" }, // teste manual do Luis: intacto
  ]);

  const clients = await run(`SELECT display_name, active FROM b2b_clients WHERE display_name LIKE '%TEST%' OR display_name LIKE 'ClienteTeste%' ORDER BY display_name`);
  assert.deepEqual(clients, [
    { display_name: "BIO-B2B TEST CLIENT 5519ea839c1d460b", active: false },
    { display_name: "ClienteTesteB2", active: true },
  ]);

  // Quem trava o vendedor inativo: login (403 depois da senha) e sessão/consultas (status = 'active').
  const { readFileSync: read } = await import("node:fs");
  const login = read(new URL("../src/app/api/b2b/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(login, /responsible\.status !== "active"[\s\S]{0,300}status: 403/);
  const guard = read(new URL("../src/lib/b2b/require-responsible.ts", import.meta.url), "utf8");
  assert.match(guard, /responsible\.status !== "active"/);
});

test("11b (cópia cifrada do link) é idempotente; token cifrado volta igual", async () => {
  await pg.exec(sqlFile("11b_offer_link_copia_cifrada.sql"));
  await pg.exec(sqlFile("11b_offer_link_copia_cifrada.sql"));
  const cols = await run(`SELECT column_name FROM information_schema.columns WHERE table_name='b2b_offer_links' AND column_name='token_ciphertext'`);
  assert.equal(cols.length, 1);

  process.env.ADMIN_SESSION_SECRET = "segredo-de-teste";
  const { encryptOfferToken, decryptOfferToken } = await import("@/lib/b2b/token");
  const encrypted = encryptOfferToken("abc-token-123");
  assert.ok(encrypted && !encrypted.includes("abc-token-123"));
  assert.equal(decryptOfferToken(encrypted), "abc-token-123");
  assert.equal(decryptOfferToken(encrypted.slice(0, -2) + "xx"), null); // adulterado
  assert.equal(decryptOfferToken(null), null);
});

test("10a/10b (conferências somente leitura) rodam e 10b acha dado fora do lugar", async () => {
  await pg.exec(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text, ADD COLUMN IF NOT EXISTS total_cents integer,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(), ADD COLUMN IF NOT EXISTS b2b_offer_id uuid,
      ADD COLUMN IF NOT EXISTS b2b_responsible_id uuid;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS paid_qty integer, ADD COLUMN IF NOT EXISTS bonus_qty integer,
      ADD COLUMN IF NOT EXISTS promotion_name text, ADD COLUMN IF NOT EXISTS commission_base_percent numeric,
      ADD COLUMN IF NOT EXISTS commission_extra_percent numeric, ADD COLUMN IF NOT EXISTS commission_total_percent numeric;
  `);
  const [{ id: offerId }] = await run(`SELECT id FROM b2b_offers LIMIT 1`);
  const [{ id: productId }] = await run(`SELECT id FROM products LIMIT 1`);
  const [{ id: orderId }] = await run(
    `INSERT INTO orders (status, payment_method, total_cents, b2b_offer_id) VALUES ('paid','pix',10000,$1) RETURNING id`, [offerId]);
  await run(`INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, paid_qty, commission_base_percent, commission_extra_percent, commission_total_percent)
             VALUES ($1,$2,2,2000,2,10,15,25), ($1,$2,2,3000,2,10,8,18)`, [orderId, productId]);

  const [a] = await run(sqlFile("10a_conferencia_comissao_pedidos_b2b.sql"));
  const pedido = a.conferencia_comissao_b2b.pedidos.find((p) => p.id === orderId);
  assert.equal(pedido.itens_sem_comissao, 0);
  assert.equal(Number(pedido.comissao_ponderada_pct), 20.8); // (4000*25 + 6000*18) / 10000

  const [b] = await run(sqlFile("10b_diagnostico_isolamento_vendedores.sql"));
  const d = b.diagnostico_isolamento;
  for (const key of ["cliente_com_mais_de_um_vendedor_ativo", "cliente_ativo_sem_vinculo",
    "oferta_de_vendedor_diferente_do_vinculo", "pedido_b2b_com_vendedor_diferente_da_oferta", "vendedores"]) {
    assert.ok(Array.isArray(d[key]), key);
  }
  // O pedido de teste não tem vendedor, a oferta tem: o diagnóstico aponta.
  assert.ok(d.pedido_b2b_com_vendedor_diferente_da_oferta.some((row) => row.order_id === orderId));
});

test("12a/12b corrigem texto quebrado só em b2b_*, sem apagar", async () => {
  await run(`INSERT INTO b2b_promotions (name, scope, type) VALUES ('3 por 2 â€” PromoÃ§Ã£o', 'b2b', 'buy_x_get_y_auto_same_sku')`);
  const [before] = await run(sqlFile("12a_diagnostico_texto_quebrado.sql"));
  const found = before.diagnostico_texto_quebrado.achados.find((row) => row.tabela === "b2b_promotions");
  assert.equal(found.corrigido, "3 por 2 — Promoção");

  await pg.exec(sqlFile("12b_corrigir_texto_quebrado.sql"));
  const [after] = await run(sqlFile("12a_diagnostico_texto_quebrado.sql"));
  assert.deepEqual(after.diagnostico_texto_quebrado.achados, []);
  const rows = await run(`SELECT name FROM b2b_promotions WHERE name LIKE '3 por 2 —%'`);
  assert.equal(rows.length, 1);
});
