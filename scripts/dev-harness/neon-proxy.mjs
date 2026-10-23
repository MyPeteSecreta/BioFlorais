/*
 * HARNESS LOCAL (só desenvolvimento): banco PGlite atrás de um endpoint compatível com o HTTP do Neon (/sql), com o esquema do
 * drizzle + os SQL aditivos de sql/b2b e dados de teste (representante, cliente de teste, link pessoal, vitrine). Permite rodar
 * o app de verdade (next dev) SEM tocar no Neon. Uso:
 *   node --import ./scripts/register-ts-paths.mjs scripts/dev-harness/neon-proxy.mjs <schema.sql> [porta]
 * O app roda com NODE_OPTIONS=--require scripts/dev-harness/patch.cjs (redireciona o fetch do Neon, Melhor Envio e ViaCEP).
 */

import http from "node:http";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { PGlite, types } from "@electric-sql/pglite";

import { hashPassword } from "../../src/lib/b2b/password.ts";
import { createB2BResponsibleSession } from "../../src/lib/b2b/responsible-session.ts";
import { encryptOfferToken, generateOpaqueToken, hashToken } from "../../src/lib/b2b/token.ts";
import { bioProducts } from "../../src/lib/catalog/bio-products.ts";

const schemaFile = process.argv[2];
const port = Number(process.argv[3] ?? 5999);
const out = process.argv[4] ?? "";

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "harness-segredo-local";

const pg = new PGlite();

await pg.exec(readFileSync(schemaFile, "utf8").replace(/--> statement-breakpoint/g, ""));

const SKIP = /^(06b|08|10|12|16|29b|40b|41b|42b)/;
const files = readdirSync(new URL("../../sql/b2b/", import.meta.url))
  .filter((name) => /^\d{2}[b-c]?_.*\.sql$/.test(name) && /^\d{2}[bc]_/.test(name) && !SKIP.test(name))
  .sort();

for (const name of files) {
  try {
    await pg.exec(readFileSync(new URL(`../../sql/b2b/${name}`, import.meta.url), "utf8"));
  } catch (error) {
    console.error(`[harness] ${name}: ${String(error.message).slice(0, 120)}`);
  }
}

// ---------------------------------------------------------------------------- dados de teste
const q = async (text, params = []) => (await pg.query(text, params)).rows;

for (const product of bioProducts) {
  await q(
    `INSERT INTO products (slug, name, line_slug, category, price_cents, weight_grams, length_cm, width_cm, height_cm, active) VALUES ($1,$2,$3,$4,$5,150,12,6,6,true) ON CONFLICT (slug) DO NOTHING`,
    [product.slug, product.name, product.lineSlug, product.category, product.priceCents ?? 5000]
  );
}

await q(`INSERT INTO integration_credentials (provider, access_token, refresh_token, access_token_expires_at) VALUES ('melhorenvio', 'x', 'y', now() + interval '300 days') ON CONFLICT DO NOTHING`);

for (const [slug, name, lines] of [
  ["adulto", "Adulto", ["adulto"]],
  ["pet", "Pet", ["pet"]],
]) {
  const [group] = await q(`INSERT INTO b2b_commercial_groups (slug, name, active) VALUES ($1,$2,true) RETURNING id`, [slug, name]);
  await q(`INSERT INTO b2b_commercial_group_products (commercial_group_id, product_id) SELECT $1::uuid, id FROM products WHERE line_slug = ANY($2::text[])`, [group.id, lines]);
}

const [seller] = await q(
  `INSERT INTO b2b_responsibles (type, status, name, email, login, password_hash, referral_code, person_type, onboarding_completed_at)
   VALUES ('rca', 'active', 'Vendedora Ana', 'ana@teste.local', 'ana', $1, 'ANA01', 'pf', now()) RETURNING id`,
  [hashPassword("senha-de-teste")]
);

async function makeOffer({ clientId, storefront }) {
  const [offer] = await q(
    `INSERT INTO b2b_offers (client_id, responsible_id, status, activated_at${storefront ? ", is_storefront" : ""}) VALUES ($1::uuid, $2::uuid, 'active', now()${storefront ? ", true" : ""}) RETURNING id`,
    [clientId, seller.id]
  );
  await q(`INSERT INTO b2b_offer_commercial_groups (offer_id, commercial_group_id) SELECT $1::uuid, id FROM b2b_commercial_groups`, [offer.id]);
  const token = generateOpaqueToken();
  await q(`INSERT INTO b2b_offer_links (offer_id, token_hash, token_ciphertext) VALUES ($1::uuid, $2, $3)`, [offer.id, hashToken(token), encryptOfferToken(token)]);
  return { offerId: offer.id, token };
}

const [client] = await q(
  `INSERT INTO b2b_clients (display_name, contact_name, email, phone, active, document, city, state)
   VALUES ('Loja Flor de Lis Ltda', 'Maria', 'loja@flordelis.test', '11912345678', true, '11222333000181', 'São Paulo', 'SP') RETURNING id`
);
await q(`INSERT INTO b2b_client_relationships (client_id, responsible_id, active) VALUES ($1::uuid, $2::uuid, true)`, [client.id, seller.id]);
const personal = await makeOffer({ clientId: client.id });

const [vitrine] = await q(`INSERT INTO b2b_clients (display_name, active, lead_source) VALUES ('Vitrine /parceiros', true, 'vitrine') RETURNING id`);
await q(`INSERT INTO b2b_client_relationships (client_id, responsible_id, active) VALUES ($1::uuid, $2::uuid, true)`, [vitrine.id, seller.id]);
const store = await makeOffer({ clientId: vitrine.id, storefront: true });

const info = {
  personalToken: personal.token,
  storefrontToken: store.token,
  sellerId: seller.id,
  sellerSession: createB2BResponsibleSession(seller.id),
  clientId: client.id,
  personalOfferId: personal.offerId,
};

if (out) writeFileSync(out, JSON.stringify(info, null, 2));
console.log("[harness] seed ok", JSON.stringify({ personalToken: info.personalToken, storefrontToken: info.storefrontToken }));

// ---------------------------------------------------------------------------- endpoint /sql (protocolo HTTP do Neon)
const identity = (value) => value;
const parsers = Object.fromEntries(Object.values(types).filter((oid) => typeof oid === "number").map((oid) => [oid, identity]));

function run(statement) {
  return pg.query(statement.query, statement.params ?? [], { rowMode: "array", parsers });
}

function format(result) {
  return {
    command: result.command ?? "SELECT",
    rowCount: result.affectedRows ?? result.rows.length,
    rows: result.rows,
    fields: result.fields.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })),
    rowAsArray: true,
  };
}

http
  .createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

    try {
      let payload;

      if (Array.isArray(body.queries)) {
        const results = await pg.transaction(async (tx) => {
          const all = [];
          for (const statement of body.queries) all.push(format(await tx.query(statement.query, statement.params ?? [], { rowMode: "array", parsers })));
          return all;
        });
        payload = { results };
      } else {
        payload = format(await run(body));
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: error.message, code: error.code, severity: "ERROR" }));
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`[harness] /sql em http://127.0.0.1:${port}`));
