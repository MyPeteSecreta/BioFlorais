/**
 * BIO FLORAIS B2B — Rodada 7: /parceiros é uma LOJA B2B pública (mesmos componentes do link do cliente,
 * preço B2B normal, sem promoção). Cada vendedor (e o vendedor da casa) tem uma VITRINE: uma oferta
 * padrão pública marcada is_storefront. A identificação do lojista acontece no checkout; ao criar o
 * pedido a vitrine resolve DE QUEM é o cliente:
 *   1. CNPJ/CPF que já é cliente de um vendedor ativo -> fica com o DONO (não troca de dono);
 *   2. senão, o vendedor da vitrine (?v= ou casa), criando o cliente com a origem "parceiros".
 * O pedido aponta para uma oferta padrão (sem promoção) do cliente com o vendedor atribuído, e a
 * resposta devolve o link dela ("Salve este link para comprar de novo").
 */

import { NOT_DEMO_SQL } from "@/lib/b2b/demo";
import { readActiveOfferLink, issueOfferLink } from "@/lib/b2b/offer-link";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { createLeadClient, findExistingLead, type LeadInput } from "@/lib/b2b/partners";
import { createActiveOffer, evaluateStandardOffer } from "@/lib/b2b/quick-offer";

export const STOREFRONT_ORIGIN = "parceiros";
export const STOREFRONT_CLIENT_NAME = "Vitrine /parceiros";

export type StorefrontSeller = { id: string; name: string; phone?: string | null };

/** Caminho (/b2b/oferta/<token>) da vitrine do vendedor; cria a vitrine na primeira vez. */
export async function ensureStorefrontPath(run: SqlRunner, seller: StorefrontSeller): Promise<string | null> {
  try {
    let found = await findStorefront(run, seller.id);

    if (!found) {
      const [client] = await run(
        `INSERT INTO b2b_clients (display_name, active, lead_source) VALUES ($1, true, 'vitrine') RETURNING id`,
        [STOREFRONT_CLIENT_NAME]
      );

      await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id, active) VALUES ($1::uuid, $2::uuid, true)`, [
        client.id,
        seller.id,
      ]);

      const standard = await evaluateStandardOffer(String(client.id));

      if (standard.commercialGroupIds.length === 0) return null;

      const created = await createActiveOffer(run, {
        responsible: { id: seller.id, name: seller.name },
        client: { id: String(client.id), displayName: STOREFRONT_CLIENT_NAME, phone: null },
        commercialGroupIds: standard.commercialGroupIds,
        promotions: [],
      });

      if (!created.ok) return null;

      try {
        await run(`UPDATE b2b_offers SET is_storefront = true WHERE id = $1::uuid`, [created.offerId]);
      } catch {
        // Outra requisição criou a vitrine ao mesmo tempo (índice único): usa a que ficou.
        found = await findStorefront(run, seller.id);

        if (!found) return null;
      }

      return new URL(created.url).pathname;
    }

    const contact = { clientName: STOREFRONT_CLIENT_NAME, clientPhone: null, responsibleName: seller.name };
    const existing = await readActiveOfferLink(found.offerId, contact);

    if (existing) return existing.path;

    return (await issueOfferLink({ offerId: found.offerId, ...contact })).path;
  } catch (error) {
    console.error("[storefront] vitrine indisponível (SQL 37b?)", error);

    return null;
  }
}

/** Vitrine PADRÃO do vendedor (as vitrines dos links com promoção, SQL 52b, têm promo_link_id e ficam de fora). */
export async function findStorefront(run: SqlRunner, sellerId: string) {
  const [row] = await run(
    `SELECT o.id, o.client_id FROM b2b_offers o
      WHERE o.responsible_id = $1::uuid AND o.is_storefront = true AND o.status = 'active' AND o.revoked_at IS NULL
        AND to_jsonb(o) ->> 'promo_link_id' IS NULL
      ORDER BY o.created_at DESC LIMIT 1`,
    [sellerId]
  );

  return row ? { offerId: String(row.id), clientId: String(row.client_id) } : null;
}

export type Owner = { clientId: string; responsibleId: string; responsibleName: string; responsibleType: string; clientName: string; phone: string | null };

/**
 * Cliente já conhecido pelo documento (CNPJ/CPF): primeiro o cliente criado por esta loja/vendedor
 * (b2b_clients.document); depois o cliente de pedidos anteriores desse documento. Só vínculo ATIVO com
 * vendedor ATIVO e não demo; a vitrine nunca é "dono".
 */
export async function findDocumentOwner(run: SqlRunner, documentDigits: string): Promise<Owner | null> {
  const ownerQuery = (where: string) => `
    SELECT c.id AS client_id, c.display_name, c.phone, r.id AS responsible_id, r.name AS responsible_name, r.type AS responsible_type
      FROM b2b_clients c
      JOIN b2b_client_relationships rel ON rel.client_id = c.id AND rel.active = true AND rel.unlinked_at IS NULL
      JOIN b2b_responsibles r ON r.id = rel.responsible_id AND r.status = 'active' AND ${NOT_DEMO_SQL("r")}
     WHERE c.active = true AND COALESCE(to_jsonb(c) ->> 'lead_source', '') <> 'vitrine' AND ${where}
     ORDER BY rel.created_at ASC LIMIT 1`;

  const map = (row: Record<string, unknown> | undefined): Owner | null =>
    row
      ? {
          clientId: String(row.client_id),
          clientName: String(row.display_name),
          phone: (row.phone as string | null) ?? null,
          responsibleId: String(row.responsible_id),
          responsibleName: String(row.responsible_name),
          responsibleType: String(row.responsible_type),
        }
      : null;

  const [byDocument] = await run(ownerQuery(`to_jsonb(c) ->> 'document' = $1`), [documentDigits]);

  if (byDocument) return map(byDocument);

  const [byOrders] = await run(
    ownerQuery(`c.id = (
      SELECT o.b2b_client_id FROM orders o JOIN customers cu ON cu.id = o.customer_id
       WHERE (cu.cnpj = $1 OR cu.cpf = $1) AND o.b2b_client_id IS NOT NULL
       ORDER BY o.created_at ASC LIMIT 1)`),
    [documentDigits]
  );

  return map(byOrders);
}

/** Dependências que falam com o Offer Builder/drizzle (trocadas nos testes). */
export type StorefrontDeps = {
  readLink: (offerId: string, contact: { clientName: string; clientPhone: string | null; responsibleName: string }) => Promise<{ url: string } | null>;
  createOffer: (
    run: SqlRunner,
    seller: { id: string; name: string },
    client: { id: string; displayName: string; phone: string | null }
  ) => Promise<{ offerId: string; url: string } | null>;
};

const defaultDeps: StorefrontDeps = {
  readLink: (offerId, contact) => readActiveOfferLink(offerId, contact),
  createOffer: async (run, seller, client) => {
    const standard = await evaluateStandardOffer(client.id);

    if (standard.commercialGroupIds.length === 0) return null;

    const created = await createActiveOffer(run, { responsible: seller, client, commercialGroupIds: standard.commercialGroupIds, promotions: [] });

    return created.ok ? { offerId: created.offerId, url: created.url } : null;
  },
};

/** Oferta padrão (sem promoção) ATIVA do cliente com o vendedor, com o link; cria se não houver. */
export async function ensureStandardOffer(
  run: SqlRunner,
  seller: { id: string; name: string },
  client: { id: string; displayName: string; phone: string | null },
  deps: StorefrontDeps = defaultDeps
): Promise<{ offerId: string; url: string } | null> {
  const rows = await run(
    `SELECT o.id FROM b2b_offers o
      WHERE o.client_id = $1::uuid AND o.responsible_id = $2::uuid AND o.status = 'active' AND o.revoked_at IS NULL
        AND COALESCE(to_jsonb(o) ->> 'is_storefront', 'false') <> 'true'
        AND NOT EXISTS (SELECT 1 FROM b2b_offer_promotions p WHERE p.offer_id = o.id)
        AND EXISTS (SELECT 1 FROM b2b_offer_links l WHERE l.offer_id = o.id AND l.revoked_at IS NULL)
      ORDER BY o.created_at DESC LIMIT 3`,
    [client.id, seller.id]
  );

  for (const row of rows) {
    const link = await deps.readLink(String(row.id), {
      clientName: client.displayName,
      clientPhone: client.phone,
      responsibleName: seller.name,
    });

    if (link) return { offerId: String(row.id), url: link.url };
  }

  return deps.createOffer(run, seller, client);
}

export type StorefrontAttribution = {
  offerId: string;
  clientId: string;
  clientDisplayName: string;
  responsibleId: string;
  responsibleName: string;
  responsibleType: string;
  /** Link permanente do lojista ("Salve este link para comprar de novo"). */
  storeUrl: string;
  /** O pedido foi para o DONO do cliente (e não para o vendedor da vitrine). */
  keptOwner: boolean;
};

export async function attributeStorefrontOrder(
  run: SqlRunner,
  input: {
    storeSeller: { id: string; name: string; type: string };
    documentDigits: string;
    lead: LeadInput;
    referralCode: string | null;
    /** Vitrine de um link com promoção: a oferta do cliente sai com a promoção do link (null = cai na oferta padrão). */
    promoOffer?: (
      run: SqlRunner,
      seller: { id: string; name: string },
      client: { id: string; displayName: string; phone: string | null }
    ) => Promise<{ offerId: string; url: string } | null>;
  },
  deps: StorefrontDeps = defaultDeps
): Promise<StorefrontAttribution | null> {
  const owner = await findDocumentOwner(run, input.documentDigits);

  const seller = owner
    ? { id: owner.responsibleId, name: owner.responsibleName, type: owner.responsibleType }
    : input.storeSeller;

  const client = owner
    ? { id: owner.clientId, displayName: owner.clientName, phone: owner.phone }
    : await (async () => {
        const existing = await findExistingLead(run, seller.id, input.lead);

        return (
          existing ??
          (await createLeadClient(run, seller.id, input.lead, {
            referralCode: input.referralCode,
            via: input.referralCode ? "code" : "house",
          }))
        );
      })();

  const offer =
    (input.promoOffer ? await input.promoOffer(run, { id: seller.id, name: seller.name }, client) : null) ??
    (await ensureStandardOffer(run, { id: seller.id, name: seller.name }, client, deps));

  if (!offer) return null;

  return {
    offerId: offer.offerId,
    clientId: client.id,
    clientDisplayName: client.displayName,
    responsibleId: seller.id,
    responsibleName: seller.name,
    responsibleType: seller.type,
    storeUrl: offer.url,
    keptOwner: Boolean(owner),
  };
}
