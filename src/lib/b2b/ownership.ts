/**
 * BIO FLORAIS B2B — isolamento de vendedor.
 *
 * ÚNICA fonte das consultas de posse usadas pelas páginas e rotas da área
 * do vendedor: um vendedor só enxerga/age sobre os PRÓPRIOS clientes
 * (vínculo ativo em b2b_client_relationships) e as PRÓPRIAS ofertas.
 * Vendedor desativado não enxerga nada.
 *
 * SQL puro sobre um SqlRunner, para que o MESMO código rode no Neon (app)
 * e no Postgres em memória dos testes (scripts/b2b-vendor-isolation.test.mjs,
 * com PGlite e dois vendedores).
 */

import { andNotArchived } from "@/lib/b2b/archive";
import { neon } from "@neondatabase/serverless";

import { isUuid } from "@/lib/b2b/admin-input";

export type SqlRunner = (
  text: string,
  params?: unknown[]
) => Promise<Array<Record<string, unknown>>>;

let appRunner: SqlRunner | null = null;

/** Runner do app (Neon HTTP), criado sob demanda. */
export function getAppSqlRunner(): SqlRunner {
  if (appRunner) return appRunner;

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const sql = neon(databaseUrl);
  appRunner = async (text, params = []) =>
    (await sql.query(text, params)) as Array<Record<string, unknown>>;

  return appRunner;
}

export type OwnedClient = {
  id: string;
  displayName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  responsibleName: string;
};

const ACTIVE_RELATIONSHIP = `
  r.responsible_id = $1
  AND r.active = true
  AND r.unlinked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM b2b_responsibles br
     WHERE br.id = $1 AND br.status = 'active'
  )
`;

function toClient(row: Record<string, unknown>): OwnedClient {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    contactName: (row.contact_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    responsibleName: String(row.responsible_name),
  };
}

/** Cliente do vendedor (vínculo ativo); null para cliente de outro vendedor. */
export async function findOwnedClient(
  run: SqlRunner,
  responsibleId: string,
  clientId: string
): Promise<OwnedClient | null> {
  if (!isUuid(responsibleId) || !isUuid(clientId)) return null;

  const notArchived = await andNotArchived(run, "b2b_clients", "c");
  const rows = await run(
    `SELECT c.id, c.display_name, c.contact_name, c.email, c.phone,
            (SELECT name FROM b2b_responsibles WHERE id = $1) AS responsible_name
       FROM b2b_clients c
       JOIN b2b_client_relationships r ON r.client_id = c.id
      WHERE c.id = $2${notArchived} AND ${ACTIVE_RELATIONSHIP}
      LIMIT 1`,
    [responsibleId, clientId]
  );

  return rows[0] ? toClient(rows[0]) : null;
}

/** Só os clientes do vendedor, em ordem alfabética. */
export async function listOwnedClients(
  run: SqlRunner,
  responsibleId: string
): Promise<OwnedClient[]> {
  if (!isUuid(responsibleId)) return [];

  const notArchived = await andNotArchived(run, "b2b_clients", "c");
  const rows = await run(
    `SELECT c.id, c.display_name, c.contact_name, c.email, c.phone,
            (SELECT name FROM b2b_responsibles WHERE id = $1) AS responsible_name
       FROM b2b_clients c
       JOIN b2b_client_relationships r ON r.client_id = c.id
      WHERE ${ACTIVE_RELATIONSHIP}${notArchived}
      ORDER BY c.display_name ASC`,
    [responsibleId]
  );

  return rows.map(toClient);
}

export type OwnedOffer = {
  id: string;
  clientId: string;
  status: string;
  activatedAt: Date | null;
  revokedAt: Date | null;
};

/**
 * Oferta do vendedor, de um cliente ainda vinculado a ele. Com clientId,
 * exige também que a oferta seja desse cliente.
 */
export async function findOwnedOffer(
  run: SqlRunner,
  responsibleId: string,
  offerId: string,
  clientId?: string
): Promise<OwnedOffer | null> {
  if (!isUuid(responsibleId) || !isUuid(offerId)) return null;
  if (clientId !== undefined && !isUuid(clientId)) return null;

  const rows = await run(
    `SELECT o.id, o.client_id, o.status, o.activated_at, o.revoked_at
       FROM b2b_offers o
       JOIN b2b_client_relationships r ON r.client_id = o.client_id
      WHERE o.id = $2
        AND o.responsible_id = $1
        AND ($3::uuid IS NULL OR o.client_id = $3::uuid)
        AND ${ACTIVE_RELATIONSHIP}
      LIMIT 1`,
    [responsibleId, offerId, clientId ?? null]
  );

  const row = rows[0];

  if (!row) return null;

  return {
    id: String(row.id),
    clientId: String(row.client_id),
    status: String(row.status),
    activatedAt: row.activated_at ? new Date(String(row.activated_at)) : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
  };
}

/** Ofertas do vendedor para um cliente dele (mais recentes primeiro). */
export async function listOwnedOffersForClient(
  run: SqlRunner,
  responsibleId: string,
  clientId: string
) {
  if (!isUuid(responsibleId) || !isUuid(clientId)) return [];

  const rows = await run(
    `SELECT o.id, o.status, o.created_at, o.activated_at, o.revoked_at,
            EXISTS (SELECT 1 FROM b2b_offer_links l
                     WHERE l.offer_id = o.id AND l.revoked_at IS NULL) AS has_active_link,
            (SELECT count(*)::int FROM b2b_offer_commercial_groups g WHERE g.offer_id = o.id) AS lines,
            (SELECT count(*)::int FROM b2b_offer_promotions p WHERE p.offer_id = o.id) AS promotions
       FROM b2b_offers o
       JOIN b2b_client_relationships r ON r.client_id = o.client_id
      WHERE o.client_id = $2
        AND o.responsible_id = $1
        AND ${ACTIVE_RELATIONSHIP}
      ORDER BY o.created_at DESC`,
    [responsibleId, clientId]
  );

  return rows.map((row) => ({
    id: String(row.id),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)),
    activatedAt: row.activated_at ? new Date(String(row.activated_at)) : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    hasActiveLink: Boolean(row.has_active_link),
    lines: Number(row.lines ?? 0),
    promotions: Number(row.promotions ?? 0),
  }));
}
