/*
 * Rodada 7: /parceiros é uma LOJA B2B pública. Atribuição no checkout: sem código -> vendedor da casa;
 * com ?v= -> aquele vendedor; CNPJ/CPF que já é cliente de outro vendedor -> fica com o DONO; origem
 * registrada; pagamento aceita o token da vitrine só para pedido de origem "parceiros".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const storefront = await import("../src/lib/b2b/storefront.ts");
const partners = await import("../src/lib/b2b/partners.ts");
const { buildOrderItemSnapshots } = await import("../src/lib/b2b/order-commission.ts");
const { isB2BOrderAboveMinimum, B2B_MIN_ORDER_CENTS } = await import("../src/lib/b2b/pricing.ts");

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const [CASA, ANA, BETO] = [U(1), U(2), U(3)];
const CNPJ_DONO = "11222333000181"; // já é cliente da Beto
const CNPJ_NOVO = "52998224725"; // CPF válido (qualquer documento novo)
let pg;
const run = async (text, params = []) => (await pg.query(text, params)).rows;

async function fresh() {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE b2b_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamp DEFAULT now());
    CREATE TABLE b2b_responsibles (id uuid PRIMARY KEY, name text, email text, type text, status text, referral_code text, is_demo boolean NOT NULL DEFAULT false);
    CREATE TABLE b2b_clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, email text, phone text, active boolean DEFAULT true,
      document text, city text, state text, lead_source text, lead_referral_code text, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_client_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid,
      active boolean DEFAULT true, unlinked_at timestamp, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, responsible_id uuid, status text DEFAULT 'active',
      revoked_at timestamp, is_storefront boolean NOT NULL DEFAULT false, created_at timestamp DEFAULT now());
    CREATE TABLE b2b_offer_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid, revoked_at timestamp);
    CREATE TABLE b2b_offer_promotions (offer_id uuid, promotion_id uuid);
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cpf text, cnpj text);
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, b2b_client_id uuid, b2b_offer_id uuid, origin text, origin_code text,
      created_at timestamp DEFAULT now());
    INSERT INTO b2b_responsibles (id, name, email, type, status, referral_code) VALUES
      ('${CASA}', 'Angel Blanc – Comercial', 'casa@x.com', 'clt', 'active', 'CASA11'),
      ('${ANA}', 'Ana RCA', 'ana@x.com', 'rca', 'active', 'ANA222'),
      ('${BETO}', 'Beto RCA', 'beto@x.com', 'rca', 'active', 'BETO33');
    INSERT INTO b2b_clients (id, display_name, document, lead_source) VALUES ('${U(50)}', 'Loja do Beto', '${CNPJ_DONO}', 'parceiros');
    INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${U(50)}', '${BETO}');
  `);
  await pg.exec(read("sql/b2b/37b_loja_publica.sql").replace(/ALTER TABLE b2b_offers[^;]*;|ALTER TABLE orders[^;]*;/g, "").replace(/DO \$\$[\s\S]*?END \$\$;/, ""));
}

/** Dependências falsas: lê/cria a oferta padrão direto no PGlite (o Offer Builder real usa o banco do app). */
const deps = {
  readLink: async (offerId) => ({ url: `https://www.bioflorais.com.br/b2b/oferta/LINK-${offerId.slice(0, 8)}` }),
  createOffer: async (runner, seller, client) => {
    const [offer] = await runner(`INSERT INTO b2b_offers (client_id, responsible_id) VALUES ($1::uuid, $2::uuid) RETURNING id`, [client.id, seller.id]);
    await runner(`INSERT INTO b2b_offer_links (offer_id) VALUES ($1::uuid)`, [offer.id]);

    return { offerId: String(offer.id), url: `https://www.bioflorais.com.br/b2b/oferta/NOVO-${String(offer.id).slice(0, 8)}` };
  },
};

const lead = (over = {}) => ({ name: "Pet Shop Rex", document: CNPJ_NOVO, phone: "21999991111", email: "rex@loja.com", city: "Niterói", state: "RJ", ...over });
const attribute = (input) => storefront.attributeStorefrontOrder(run, input, deps);

test("37a/37b: aditivo e idempotente (colunas conferidas antes, índice único por vendedor)", () => {
  const sql = read("sql/b2b/37b_loja_publica.sql");
  assert.ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql) && !/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.ok(sql.includes("is_storefront") && sql.includes("origin_code") && sql.includes("b2b_offers_storefront_uq") && sql.includes("lock_timeout"));
  assert.ok(read("sql/b2b/37a_loja_publica_preflight_one_shot.sql").includes("preflight_loja_publica"));
});

test("sem código: a casa; com ?v=: o vendedor do link; cliente novo nasce com a origem parceiros", async () => {
  await fresh();
  await partners.setHouseSeller(run, CASA);

  const noCode = await partners.resolvePartnerSeller(run, undefined);
  assert.equal(noCode.seller.id, CASA);
  const viaAna = await partners.resolvePartnerSeller(run, "ana222");
  assert.equal(viaAna.seller.id, ANA);

  const a = await attribute({ storeSeller: { id: CASA, name: "Casa", type: "clt" }, documentDigits: CNPJ_NOVO, lead: lead(), referralCode: null });
  assert.equal(a.responsibleId, CASA);
  assert.equal(a.keptOwner, false);
  const [client] = await run(`SELECT display_name, document, lead_source, lead_referral_code FROM b2b_clients WHERE id = $1`, [a.clientId]);
  assert.deepEqual(client, { display_name: "Pet Shop Rex", document: CNPJ_NOVO, lead_source: "parceiros", lead_referral_code: null });
  assert.match(a.storeUrl, /\/b2b\/oferta\/NOVO-/);

  // outro lojista pelo link da Ana
  const b = await attribute({
    storeSeller: { id: ANA, name: "Ana RCA", type: "rca" },
    documentDigits: "12345678909",
    lead: lead({ document: "12345678909", email: "outro@loja.com" }),
    referralCode: "ANA222",
  });
  assert.equal(b.responsibleId, ANA);
  assert.equal((await run(`SELECT lead_referral_code FROM b2b_clients WHERE id = $1`, [b.clientId]))[0].lead_referral_code, "ANA222");
});

test("CNPJ que já é cliente de OUTRO vendedor: o pedido fica com o dono (mesmo comprando pelo link de outra pessoa)", async () => {
  await fresh();
  const viaAna = await attribute({
    storeSeller: { id: ANA, name: "Ana RCA", type: "rca" },
    documentDigits: CNPJ_DONO,
    lead: lead({ document: CNPJ_DONO, name: "Loja do Beto" }),
    referralCode: "ANA222",
  });

  assert.equal(viaAna.keptOwner, true);
  assert.equal(viaAna.responsibleId, BETO);
  assert.equal(viaAna.clientId, U(50));
  assert.equal((await run(`SELECT count(*)::int AS n FROM b2b_clients WHERE document = $1`, [CNPJ_DONO]))[0].n, 1, "não duplica o cliente");

  // dono também reconhecido por pedido anterior com o documento (cliente criado pelo vendedor, sem document)
  await run(`INSERT INTO b2b_clients (id, display_name) VALUES ('${U(60)}', 'Loja da Ana')`);
  await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ('${U(60)}', '${ANA}')`);
  await run(`INSERT INTO customers (id, cnpj) VALUES ('${U(61)}', '45997418000153')`);
  await run(`INSERT INTO orders (customer_id, b2b_client_id) VALUES ('${U(61)}', '${U(60)}')`);
  const viaBeto = await attribute({
    storeSeller: { id: BETO, name: "Beto RCA", type: "rca" },
    documentDigits: "45997418000153",
    lead: lead({ document: "45997418000153" }),
    referralCode: "BETO33",
  });
  assert.equal(viaBeto.responsibleId, ANA);
  assert.equal(viaBeto.clientId, U(60));
});

test("dono inativo, demo ou vitrine nunca vira dono; volta ao vendedor da loja", async () => {
  await fresh();
  await run(`UPDATE b2b_responsibles SET status = 'inactive' WHERE id = $1`, [BETO]);
  assert.equal(await storefront.findDocumentOwner(run, CNPJ_DONO), null);
  await run(`UPDATE b2b_responsibles SET status = 'active', is_demo = true WHERE id = $1`, [BETO]);
  assert.equal(await storefront.findDocumentOwner(run, CNPJ_DONO), null);
  await run(`UPDATE b2b_responsibles SET is_demo = false WHERE id = $1`, [BETO]);
  assert.equal((await storefront.findDocumentOwner(run, CNPJ_DONO)).responsibleId, BETO);
  await run(`UPDATE b2b_clients SET lead_source = 'vitrine' WHERE id = $1`, [U(50)]);
  assert.equal(await storefront.findDocumentOwner(run, CNPJ_DONO), null, "a vitrine não é dono");
});

test("oferta padrão do lojista é reaproveitada (sem promoção); com promoção não serve para a loja pública", async () => {
  await fresh();
  const first = await attribute({ storeSeller: { id: CASA, name: "Casa", type: "clt" }, documentDigits: CNPJ_NOVO, lead: lead(), referralCode: null });
  const second = await attribute({ storeSeller: { id: CASA, name: "Casa", type: "clt" }, documentDigits: CNPJ_NOVO, lead: lead(), referralCode: null });
  assert.equal(second.offerId, first.offerId, "mesma oferta, mesmo link");
  assert.equal((await run(`SELECT count(*)::int AS n FROM b2b_clients WHERE document = $1`, [CNPJ_NOVO]))[0].n, 1);

  await run(`INSERT INTO b2b_offer_promotions VALUES ($1, $2)`, [first.offerId, U(99)]);
  const third = await attribute({ storeSeller: { id: CASA, name: "Casa", type: "clt" }, documentDigits: CNPJ_NOVO, lead: lead(), referralCode: null });
  assert.notEqual(third.offerId, first.offerId, "oferta com promoção não é usada na loja pública");
});

test("regras do B2B seguem: mínimo R$250, sem promoção, comissão normal congelada no item", () => {
  assert.equal(B2B_MIN_ORDER_CENTS, 25000);
  assert.equal(isB2BOrderAboveMinimum(24999), false);
  assert.equal(isB2BOrderAboveMinimum(25000), true);

  const matrix = { configured: true, basePercent: 10, normalExtraPercent: 15, rules: [] };
  const [item] = buildOrderItemSnapshots({
    matrix,
    offerPromotions: [],
    lines: [{ productId: U(7), qty: 5, unitPriceCents: 5000 }],
    bonusLines: [],
    window: { firstPaidAt: null, endsAt: null, open: true },
  });
  assert.deepEqual([item.commissionBasePercent, item.commissionExtraPercent, item.commissionTotalPercent, item.commissionBasis], ["10", "15", "25", "normal_price"]);
  assert.equal(item.promotionId, null);
});

test("fios: /parceiros abre a vitrine, orders/create resolve o vendedor, boleto só PJ, pagamento aceita o token da vitrine", () => {
  const page = read("src/app/parceiros/page.tsx");
  assert.ok(page.includes("redirect(storePath)") && !page.includes("PartnerSignupForm"));
  assert.ok(!read("src/app/b2b/oferta/[token]/page.tsx").includes("Meus pedidos</") || read("src/app/b2b/oferta/[token]/page.tsx").includes("{!store && ("));
  assert.ok(read("src/app/b2b/oferta/[token]/page.tsx").includes("<B2BHero") && read("src/app/b2b/oferta/[token]/page.tsx").includes("Quero ser representante"));

  const create = read("src/app/api/b2b/orders/create/route.ts");
  assert.ok(create.includes("context.isStorefront") && create.includes("attributeStorefrontOrder") && create.includes("STOREFRONT_ORIGIN"));
  assert.ok(create.indexOf("attributeStorefrontOrder") < create.indexOf("computeB2BQuote({"), "atribui antes de cotar e gravar");
  assert.ok(create.includes('Boleto disponível apenas para pessoa jurídica'));
  assert.ok(create.includes("storeLink"));

  const ctx = read("src/lib/b2b/public-offer-context.ts");
  assert.ok(ctx.includes("resolution.context.isStorefront") && ctx.includes("'parceiros'"));
  assert.ok(read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("Seus dados serão usados para contato comercial") && read("src/app/b2b/checkout/B2BCheckoutContent.tsx").includes("storeLink"));
  assert.ok(read("src/components/b2b/ReorderLink.tsx").includes("Salve este link para comprar de novo"));
  assert.ok(read("src/lib/b2b/ownership.ts").includes("'vitrine'"), "vitrine fora da lista de clientes");
  assert.ok(read("src/app/api/admin/b2b/tracking/route.ts").includes("is_storefront"));
  // Meu link de captação do vendedor continua
  assert.ok(read("src/app/b2b/painel/page.tsx").includes("<ReferralLinkPanel"));
});
