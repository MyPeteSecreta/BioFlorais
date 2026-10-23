/**
 * Admin → Clientes (Rodada 19b): buscar e editar o cadastro (b2b_clients), registrando quem alterou e quando
 * (b2b_client_edits, SQL 47b). Nunca apaga. Cada edição grava o cadastro e o histórico NA MESMA instrução (atômico).
 */

import { isUuid } from "@/lib/b2b/admin-input";
import { andNotArchived } from "@/lib/b2b/archive";
import {
  CLIENT_COLUMNS,
  CLIENT_FIELDS,
  describeChanges,
  diffClient,
  type ClientField,
  type ClientValues,
} from "@/lib/b2b/client-edit";
import type { SqlRunner } from "@/lib/b2b/ownership";

export const SQL_47B_MESSAGE = "Aplique o SQL 47b (edição de clientes) para usar esta função.";

export type ClientRow = ClientValues & { id: string; responsible: string | null; updatedAt: string | null; isTest: boolean };

// Colunas opcionais lidas por to_jsonb: a lista abre mesmo antes do SQL 47b.
const SELECT_FIELDS = `
  c.id::text AS id,
  c.display_name,
  c.contact_name,
  c.email,
  c.phone,
  to_jsonb(c) ->> 'document' AS document,
  to_jsonb(c) ->> 'postal_code' AS postal_code,
  to_jsonb(c) ->> 'street' AS street,
  to_jsonb(c) ->> 'address_number' AS address_number,
  to_jsonb(c) ->> 'address_complement' AS address_complement,
  to_jsonb(c) ->> 'neighborhood' AS neighborhood,
  (coalesce(to_jsonb(c) ->> 'is_test', 'false') = 'true') AS is_test,
  to_jsonb(c) ->> 'city' AS city,
  to_jsonb(c) ->> 'state' AS state,
  to_char(c.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
  resp.name AS responsible`;

const FROM = `
  FROM b2b_clients c
  LEFT JOIN LATERAL (
    SELECT r2.name FROM b2b_client_relationships rel
      JOIN b2b_responsibles r2 ON r2.id = rel.responsible_id
     WHERE rel.client_id = c.id AND rel.active = true AND rel.unlinked_at IS NULL
     ORDER BY rel.linked_at DESC LIMIT 1
  ) resp ON true`;

const nullable = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));

function toClient(row: Record<string, unknown>): ClientRow {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? ""),
    contactName: nullable(row.contact_name),
    document: nullable(row.document),
    email: nullable(row.email),
    phone: nullable(row.phone),
    postalCode: nullable(row.postal_code),
    street: nullable(row.street),
    addressNumber: nullable(row.address_number),
    addressComplement: nullable(row.address_complement),
    neighborhood: nullable(row.neighborhood),
    city: nullable(row.city),
    state: nullable(row.state),
    responsible: nullable(row.responsible),
    updatedAt: nullable(row.updated_at),
    isTest: row.is_test === true || row.is_test === "true",
  };
}

/** Busca por nome/razão social, contato, e-mail, cidade, CNPJ/CPF ou WhatsApp. Vazio = os mais recentes. */
export async function searchClients(run: SqlRunner, query: string, limit = 40, options: { includeTests?: boolean } = {}): Promise<ClientRow[]> {
  const q = String(query ?? "").trim().slice(0, 80);
  const digitsOnly = q.replace(/\D/g, "");
  const notArchived = await andNotArchived(run, "b2b_clients", "c");
  const params: unknown[] = [];
  // Clientes marcados como "teste" ficam escondidos por padrão ("mostrar testes" os inclui). Coluna is_test = SQL 32b.
  let where = `WHERE true${notArchived}${options.includeTests ? "" : " AND coalesce(to_jsonb(c) ->> 'is_test', 'false') <> 'true'"}`;

  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`);
    const like = `$${params.length}`;
    let digitsClause = "";

    if (digitsOnly.length >= 3) {
      params.push(`%${digitsOnly}%`);
      digitsClause = ` OR regexp_replace(coalesce(to_jsonb(c) ->> 'document', ''), '\\D', '', 'g') LIKE $${params.length}
                       OR regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') LIKE $${params.length}`;
    }

    where += ` AND (c.display_name ILIKE ${like} OR c.contact_name ILIKE ${like} OR c.email ILIKE ${like}
                    OR (to_jsonb(c) ->> 'city') ILIKE ${like}${digitsClause})`;
  }

  params.push(Math.max(1, Math.min(limit, 100)));

  const rows = await run(`SELECT ${SELECT_FIELDS}${FROM} ${where} ORDER BY c.updated_at DESC NULLS LAST, c.display_name LIMIT $${params.length}`, params);

  return rows.map(toClient);
}

export async function loadClient(run: SqlRunner, id: string): Promise<ClientRow | null> {
  if (!isUuid(id)) return null;

  const rows = await run(`SELECT ${SELECT_FIELDS}${FROM} WHERE c.id = $1::uuid`, [id]);

  return rows[0] ? toClient(rows[0]) : null;
}

export type ClientEdit = { id: string; changedBy: string; changedAt: string; changes: string[] };

export async function listClientEdits(run: SqlRunner, id: string, limit = 30): Promise<ClientEdit[]> {
  if (!isUuid(id)) return [];

  try {
    const rows = await run(
      `SELECT id::text AS id, changed_by, to_char(changed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS changed_at, changes
         FROM b2b_client_edits WHERE client_id = $1::uuid ORDER BY changed_at DESC, seq DESC LIMIT $2`,
      [id, limit]
    );

    return rows.map((row) => {
      const changes = (typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes) as Partial<Record<ClientField, { before: string | null; after: string | null }>>;

      return { id: String(row.id), changedBy: String(row.changed_by), changedAt: String(row.changed_at), changes: describeChanges(changes ?? {}) };
    });
  } catch {
    return [];
  }
}

export type UpdateResult =
  | { ok: true; changed: boolean; client: ClientRow; changes: string[] }
  | { ok: false; status: number; error: string; field?: ClientField };

/** Grava só o que mudou e registra quem/quando/antes/depois. CNPJ/CPF repetido em outro cadastro é recusado. */
export async function updateClient(run: SqlRunner, id: string, values: ClientValues, changedBy: string): Promise<UpdateResult> {
  const current = await loadClient(run, id);

  if (!current) return { ok: false, status: 404, error: "Cliente não encontrado." };

  const changes = diffClient(current, values);
  const fields = Object.keys(changes) as ClientField[];

  if (fields.length === 0) return { ok: true, changed: false, client: current, changes: [] };

  if (changes.document && values.document) {
    const clash = await run(
      `SELECT c.id::text AS id, c.display_name FROM b2b_clients c
        WHERE regexp_replace(coalesce(to_jsonb(c) ->> 'document', ''), '\\D', '', 'g') = $1 AND c.id <> $2::uuid LIMIT 1`,
      [values.document, id]
    );

    if (clash[0]) {
      return { ok: false, status: 409, field: "document", error: `Este CNPJ/CPF já está no cadastro de “${String(clash[0].display_name)}”. Confira o número ou unifique os cadastros.` };
    }
  }

  const params: unknown[] = [id];
  const sets = fields.map((field) => {
    params.push(values[field]);

    return `${CLIENT_COLUMNS[field]} = $${params.length}`;
  });

  params.push(changedBy);
  const byParam = params.length;
  params.push(JSON.stringify(changes));
  const changesParam = params.length;

  try {
    const rows = await run(
      `WITH upd AS (
         UPDATE b2b_clients SET ${sets.join(", ")}, updated_at = now() WHERE id = $1::uuid RETURNING id
       )
       INSERT INTO b2b_client_edits (client_id, changed_by, changes)
       SELECT id, $${byParam}, $${changesParam}::jsonb FROM upd RETURNING id`,
      params
    );

    if (rows.length === 0) return { ok: false, status: 404, error: "Cliente não encontrado." };
  } catch (error) {
    console.error("[admin/clients] atualização", error);

    return { ok: false, status: 409, error: SQL_47B_MESSAGE };
  }

  const client = (await loadClient(run, id)) ?? current;

  return { ok: true, changed: true, client, changes: describeChanges(changes) };
}

export { CLIENT_FIELDS };

export type TestMarkResult = { ok: true; changed: boolean; client: ClientRow } | { ok: false; status: number; error: string };

/**
 * Marca (ou desmarca) um cliente como "teste": só uma bandeira, nada é apagado nem arquivado. Fica no histórico de alterações
 * (quem/quando). Coluna b2b_clients.is_test = SQL 32b.
 */
export async function setClientTest(run: SqlRunner, id: string, isTest: boolean, changedBy: string): Promise<TestMarkResult> {
  const by = String(changedBy ?? "").replace(/\s+/g, " ").trim().slice(0, 80);

  if (by.length < 2) return { ok: false, status: 400, error: "Informe o seu nome para registrar quem alterou o cadastro." };

  const current = await loadClient(run, id);

  if (!current) return { ok: false, status: 404, error: "Cliente não encontrado." };
  if (current.isTest === isTest) return { ok: true, changed: false, client: current };

  try {
    const rows = await run(
      `WITH upd AS (UPDATE b2b_clients SET is_test = $2, updated_at = now() WHERE id = $1::uuid RETURNING id)
       INSERT INTO b2b_client_edits (client_id, changed_by, changes)
       SELECT id, $3, $4::jsonb FROM upd RETURNING id`,
      [id, isTest, by, JSON.stringify({ isTest: { before: current.isTest ? "sim" : "não", after: isTest ? "sim" : "não" } })]
    );

    if (rows.length === 0) return { ok: false, status: 404, error: "Cliente não encontrado." };
  } catch (error) {
    console.error("[admin/clients] marcar teste", error);

    return { ok: false, status: 409, error: "Aplique o SQL 32b (dados de teste) e o 47b (histórico de clientes) para marcar clientes de teste." };
  }

  return { ok: true, changed: true, client: (await loadClient(run, id)) ?? current };
}
