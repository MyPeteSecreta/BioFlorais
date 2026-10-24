/*
 * 51a: conferência (somente leitura) do vendedor dos pedidos de oferta, inclusive os da loja geral /parceiros.
 * Garante: o SQL é só leitura, classifica corretamente (ok / sem_vendedor / vendedor_diferente) e mostra como admin e Central rotulam;
 * e que o código de criação do pedido grava o vendedor do pedido a partir do responsável da oferta (atribuição da loja pública).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const TABLES = `
  CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text NOT NULL, omie_vendor_code text);
  CREATE TABLE b2b_offers (id uuid PRIMARY KEY, responsible_id uuid, is_storefront boolean NOT NULL DEFAULT false);
  CREATE TABLE orders (id uuid PRIMARY KEY, b2b_offer_id uuid, b2b_responsible_id uuid, b2b_responsible_name text, status text, origin text, origin_code text, created_at timestamp DEFAULT now());
  CREATE TABLE order_items (order_id uuid, qty int, unit_price_cents int, commission_total_percent numeric);`;

const ANA = "00000000-0000-0000-0000-0000000000a1";
const BIA = "00000000-0000-0000-0000-0000000000b1";
const OFFER_ANA = "00000000-0000-0000-0000-00000000f0a1";
const OFFER_VITRINE = "00000000-0000-0000-0000-00000000f0a2";
const OFFER_SEM = "00000000-0000-0000-0000-00000000f0a3";
const o = (n) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, "0")}`;

test("51a: é só leitura e classifica os pedidos da oferta (parceiros e link do cliente), com os rótulos do admin e da Central", async () => {
  const sql = read("sql/b2b/51a_conferencia_vendedor_pedidos_oferta_one_shot.sql");
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")), "conferência é só leitura");

  const pg = new PGlite();
  await pg.exec(TABLES);
  await pg.exec(`
    INSERT INTO b2b_responsibles VALUES ('${ANA}', 'Vendedora Ana', NULL), ('${BIA}', 'Vendedora Bia', 'BIA NO OMIE');
    INSERT INTO b2b_offers VALUES ('${OFFER_ANA}', '${ANA}', false), ('${OFFER_VITRINE}', '${ANA}', true), ('${OFFER_SEM}', NULL, false);
    -- 1) /parceiros com vendedor certo e comissão; 2) link do cliente certo; 3) /parceiros SEM vendedor no pedido (venda direta);
    -- 4) /parceiros com outro vendedor; 5) oferta sem responsável; 6) certo, mas sem comissão
    INSERT INTO orders (id, b2b_offer_id, b2b_responsible_id, b2b_responsible_name, status, origin, origin_code) VALUES
      ('${o(1)}', '${OFFER_ANA}', '${ANA}', 'Vendedora Ana', 'paid', 'parceiros', 'ANA01'),
      ('${o(2)}', '${OFFER_ANA}', '${ANA}', 'Vendedora Ana', 'paid', NULL, NULL),
      ('${o(3)}', '${OFFER_ANA}', NULL, NULL, 'paid', 'parceiros', 'ANA01'),
      ('${o(4)}', '${OFFER_VITRINE}', '${BIA}', 'Vendedora Bia', 'paid', 'parceiros', NULL),
      ('${o(5)}', '${OFFER_SEM}', NULL, NULL, 'paid', NULL, NULL),
      ('${o(6)}', '${OFFER_ANA}', '${ANA}', 'Vendedora Ana', 'pending', 'parceiros', 'ANA01'),
      ('${o(7)}', NULL, '${ANA}', 'Vendedora Ana', 'paid', 'mostruario', NULL);
    INSERT INTO order_items VALUES
      ('${o(1)}', 1, 1990, 7), ('${o(2)}', 1, 1990, 7), ('${o(3)}', 1, 1990, NULL), ('${o(4)}', 1, 1990, 7), ('${o(5)}', 1, 1990, NULL), ('${o(6)}', 1, 1990, NULL);`);

  const result = (await pg.query(sql)).rows[0].conferencia_vendedor_pedidos_oferta;

  assert.equal(result.colunas_necessarias_existem, true);
  assert.equal(result.pedidos_de_oferta, 6, "o pedido de mostruário (sem oferta) não entra");
  assert.deepEqual(result.por_diagnostico, { ok: 3, sem_vendedor: 1, vendedor_diferente: 1, oferta_sem_vendedor: 1 });

  assert.equal(result.amostra_divergentes.length, 4, "1 e 2 estão ok e com comissão; 3, 4, 5 e 6 aparecem");

  const sem = result.amostra_divergentes.find((row) => row.diagnostico === "sem_vendedor");
  assert.equal(sem.origem, "parceiros");
  assert.equal(sem.vendedor_esperado, "Vendedora Ana");
  assert.equal(sem.rotulo_admin, "Bio Florais", "o admin mostra o nome da casa quando o pedido não tem vendedor");
  assert.equal(sem.rotulo_central, "(sem vendedor)");
  assert.equal(sem.nome_no_omie, "(sem vendedor)");

  const diff = result.amostra_divergentes.find((row) => row.diagnostico === "vendedor_diferente");
  assert.equal(diff.rotulo_central, "Vendedora Bia");
  assert.equal(diff.nome_no_omie, "BIA NO OMIE", "o 'nome no Omie' gravado vale sobre o nome do cadastro");

  const semComissao = result.amostra_divergentes.find((row) => row.diagnostico === "ok");
  assert.match(semComissao.comissao, /sem comissão/);
  assert.equal(semComissao.rotulo_central, "Vendedora Ana");

  const parceirosOk = result.por_origem_e_diagnostico.find((row) => row.origem === "parceiros" && row.diagnostico === "ok");
  assert.equal(parceirosOk.pedidos, 2);
});

test("código: o pedido da loja /parceiros recebe o vendedor da OFERTA atribuída (dono do documento ou vendedor da vitrine), nunca fica sem vendedor", () => {
  const route = read("src/app/api/b2b/orders/create/route.ts");
  const storefront = read("src/lib/b2b/storefront.ts");

  // a atribuição troca o contexto inteiro (oferta + cliente + vendedor) ANTES de gravar o pedido
  assert.ok(route.includes("offerId: attribution.offerId") && route.includes("responsibleId: attribution.responsibleId") && route.includes("responsibleName: attribution.responsibleName"));
  assert.ok(route.indexOf("attributeStorefrontOrder(") < route.indexOf("b2bResponsibleId: context.responsibleId"));
  assert.ok(route.includes("b2bOfferId: context.offerId") && route.includes("b2bResponsibleId: context.responsibleId") && route.includes("b2bResponsibleName: context.responsibleName"));

  // a oferta criada para o cliente pertence ao mesmo vendedor do pedido
  assert.ok(storefront.includes("ensureStandardOffer(run, { id: seller.id, name: seller.name }, client, deps)"));
  assert.ok(storefront.includes("responsibleId: seller.id"));

  // a comissão é calculada para o vendedor atribuído (não para o da vitrine)
  assert.ok(read("src/lib/b2b/order-snapshots.ts").includes("loadCommissionMatrix(runSql, context.responsibleId, context.clientId)"));
});
