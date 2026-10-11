/**
 * BIO FLORAIS B2B — MODO DEMONSTRAÇÃO: representantes da campanha de e-mail testam a plataforma sem
 * cadastro e sem risco (referência: My Pet, commit 6585957).
 *
 * - Entrada SÓ por link de campanha gerado pelo admin (b2b_demo_links; só o hash do token no banco).
 *   Um link serve para muitas pessoas: cada clique cria um VENDEDOR DE DEMONSTRAÇÃO temporário
 *   (is_demo, 24 h) com um cliente fictício "Loja Exemplo".
 * - Compras desativadas no servidor (pedido, pagamentos, cupom e a própria oferta recusam).
 * - Dados demo ficam fora de listas/métricas do admin, comissões, Dados de teste, /parceiros e Central;
 *   a limpeza diária só apaga vendedor demo EXPIRADO e o que é dele.
 * - Tudo sobre SqlRunner (testado em PGlite). Consultas fora deste arquivo usam
 *   `to_jsonb(r) ->> 'is_demo'` para continuar funcionando ANTES do SQL 36b.
 */

import crypto from "node:crypto";

import type { SqlRunner } from "@/lib/b2b/ownership";

export const DEMO_HOURS = 24;
export const DEMO_LINK_DEFAULT_DAYS = 30;
export const DEMO_IP_LIMIT = 10; // por IP por hora
export const DEMO_SELLER_NAME = "Demonstração";
export const DEMO_EXAMPLE_CLIENT = "Loja Exemplo";
export const DEMO_PURCHASE_DISABLED_MESSAGE = "Demonstração: compras desativadas.";
export const DEMO_BANNER_TEXT =
  "DEMONSTRAÇÃO — nada aqui é real. Compras desativadas. Seus dados de teste ficam disponíveis por 24 horas e depois são apagados automaticamente.";

/** Condição SQL "não é vendedor de demonstração", tolerante a coluna ainda inexistente (SQL 36b). */
export const NOT_DEMO_SQL = (alias: string) => `COALESCE((to_jsonb(${alias}) ->> 'is_demo')::boolean, false) = false`;

/* "Quero ser representante": URL configurável (env B2B_DEMO_CTA_URL); padrão = WhatsApp do atendimento. */
export const DEMO_DEFAULT_CTA = "https://wa.me/552139553713?text=Quero%20ser%20representante%20da%20Bio%20Florais";

export function demoCtaUrl(env: string | undefined): string {
  const value = (env ?? "").trim();

  return /^(https?:\/\/|mailto:)/i.test(value) ? value : DEMO_DEFAULT_CTA;
}

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value) return new Date(value);

  return null;
};

/* ---------------- links de campanha (admin) ---------------- */

export type DemoLinkRow = {
  id: string;
  campaign: string;
  expiresAt: string;
  maxAccesses: number | null;
  accesses: number;
  revoked: boolean;
  createdAt: string;
  expired: boolean;
};

export function parseDemoLinkInput(
  body: Record<string, unknown>
): { ok: true; campaign: string; days: number; maxAccesses: number | null } | { ok: false; error: string } {
  const campaign = String(body.campaign ?? "").trim();
  const days = body.days === undefined || body.days === "" ? DEMO_LINK_DEFAULT_DAYS : Number(body.days);
  const rawMax = body.maxAccesses;
  const maxAccesses = rawMax === undefined || rawMax === null || rawMax === "" ? null : Number(rawMax);

  if (campaign.length < 2) return { ok: false, error: "Informe o nome da campanha." };
  if (!Number.isInteger(days) || days < 1 || days > 365) return { ok: false, error: "A validade vai de 1 a 365 dias." };

  if (maxAccesses !== null && (!Number.isInteger(maxAccesses) || maxAccesses < 1)) {
    return { ok: false, error: "O limite de acessos deve ser um número inteiro maior que 0 (ou deixe vazio)." };
  }

  return { ok: true, campaign: campaign.slice(0, 80), days, maxAccesses };
}

export async function createDemoLink(
  run: SqlRunner,
  input: { campaign: string; days: number; maxAccesses: number | null; createdBy: string; now?: Date }
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + input.days * 86_400_000);

  const rows = await run(
    `INSERT INTO b2b_demo_links (campaign, token_hash, expires_at, max_accesses, created_by)
     VALUES ($1, $2, $3::timestamptz, $4::int, $5) RETURNING id`,
    [input.campaign, hashToken(token), expiresAt.toISOString(), input.maxAccesses, input.createdBy]
  );

  return { id: String(rows[0].id), token, expiresAt };
}

export async function listDemoLinks(run: SqlRunner, now: Date = new Date()): Promise<DemoLinkRow[]> {
  const rows = await run(
    `SELECT id, campaign, expires_at, max_accesses, accesses, revoked_at, created_at FROM b2b_demo_links ORDER BY created_at DESC LIMIT 100`
  );

  return rows.map((row) => {
    const expiresAt = toDate(row.expires_at) ?? now;

    return {
      id: String(row.id),
      campaign: String(row.campaign),
      expiresAt: expiresAt.toISOString(),
      maxAccesses: row.max_accesses === null || row.max_accesses === undefined ? null : Number(row.max_accesses),
      accesses: Number(row.accesses ?? 0),
      revoked: row.revoked_at !== null && row.revoked_at !== undefined,
      createdAt: (toDate(row.created_at) ?? now).toISOString(),
      expired: expiresAt.getTime() <= now.getTime(),
    };
  });
}

export async function revokeDemoLink(run: SqlRunner, id: string): Promise<boolean> {
  const rows = await run(`UPDATE b2b_demo_links SET revoked_at = now() WHERE id = $1::uuid AND revoked_at IS NULL RETURNING id`, [id]);

  return rows.length > 0;
}

export type DemoLinkCheck = { ok: true; linkId: string } | { ok: false; reason: "invalid" | "revoked" | "expired" | "exhausted" };

/* Sem token válido = "link de demonstração inválido ou expirado". */
export async function resolveDemoLink(run: SqlRunner, token: string, now: Date = new Date()): Promise<DemoLinkCheck> {
  const value = token.trim();

  if (!value) return { ok: false, reason: "invalid" };

  const [row] = await run(`SELECT id, expires_at, max_accesses, accesses, revoked_at FROM b2b_demo_links WHERE token_hash = $1 LIMIT 1`, [
    hashToken(value),
  ]);

  if (!row) return { ok: false, reason: "invalid" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };
  if ((toDate(row.expires_at) ?? now).getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  if (row.max_accesses !== null && row.max_accesses !== undefined && Number(row.accesses) >= Number(row.max_accesses)) {
    return { ok: false, reason: "exhausted" };
  }

  return { ok: true, linkId: String(row.id) };
}

/* ---------------- anti-abuso: no máximo 10 por IP por hora ---------------- */

export async function registerDemoCreation(run: SqlRunner, ipHash: string, linkId: string | null, now: Date = new Date()) {
  const since = new Date(now.getTime() - 3_600_000).toISOString();
  const [row] = await run(`SELECT count(*)::int AS n FROM b2b_demo_creations WHERE ip_hash = $1 AND created_at > $2::timestamptz`, [ipHash, since]);

  if (Number(row?.n ?? 0) >= DEMO_IP_LIMIT) return { allowed: false };

  await run(`INSERT INTO b2b_demo_creations (ip_hash, link_id, created_at) VALUES ($1, $2::uuid, $3::timestamptz)`, [
    ipHash,
    linkId,
    now.toISOString(),
  ]);

  return { allowed: true };
}

export const hashIp = (ip: string) =>
  crypto.createHash("sha256").update(`bio-demo:${process.env.ADMIN_SESSION_SECRET ?? ""}:${ip}`).digest("hex");

/* ---------------- vendedor de demonstração ---------------- */

export async function createDemoSeller(run: SqlRunner, linkId: string | null, now: Date = new Date()) {
  const responsibleId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + DEMO_HOURS * 3_600_000);

  await run(
    `INSERT INTO b2b_responsibles
       (id, type, status, name, email, is_demo, demo_expires_at, demo_link_id,
        company_approved_at, onboarding_completed_at, profile_completed_at)
     VALUES ($1::uuid, 'clt', 'active', $2, $3, true, $4::timestamptz, $5::uuid, $6::timestamptz, $6::timestamptz, $6::timestamptz)`,
    [responsibleId, DEMO_SELLER_NAME, `demo+${responsibleId}@invalid`, expiresAt.toISOString(), linkId, now.toISOString()]
  );

  // Cliente fictício de exemplo, para a lista já vir preenchida.
  const [client] = await run(`INSERT INTO b2b_clients (display_name, active) VALUES ($1, true) RETURNING id`, [DEMO_EXAMPLE_CLIENT]);

  await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id, active) VALUES ($1::uuid, $2::uuid, true)`, [client.id, responsibleId]);

  if (linkId) await run(`UPDATE b2b_demo_links SET accesses = accesses + 1 WHERE id = $1::uuid`, [linkId]);

  return { responsibleId, expiresAt };
}

export type DemoState = { isDemo: boolean; expired: boolean; expiresAt: string | null };

/** Estado de demonstração do vendedor; tolera o SQL 36b ausente (então ninguém é demo). */
export async function loadDemoState(run: SqlRunner, responsibleId: string, now: Date = new Date()): Promise<DemoState> {
  try {
    const [row] = await run(
      `SELECT to_jsonb(r) ->> 'is_demo' AS is_demo, to_jsonb(r) ->> 'demo_expires_at' AS demo_expires_at FROM b2b_responsibles r WHERE r.id = $1::uuid LIMIT 1`,
      [responsibleId]
    );

    if (!row || row.is_demo !== "true") return { isDemo: false, expired: false, expiresAt: null };

    const expiresAt = toDate(row.demo_expires_at);

    return { isDemo: true, expired: !expiresAt || expiresAt.getTime() <= now.getTime(), expiresAt: expiresAt?.toISOString() ?? null };
  } catch {
    return { isDemo: false, expired: false, expiresAt: null };
  }
}

/** A oferta pertence a vendedor de demonstração? */
export async function offerIsDemo(run: SqlRunner, offerId: string): Promise<boolean> {
  try {
    const [row] = await run(
      `SELECT to_jsonb(r) ->> 'is_demo' AS is_demo FROM b2b_offers o INNER JOIN b2b_responsibles r ON r.id = o.responsible_id WHERE o.id = $1::uuid LIMIT 1`,
      [offerId]
    );

    return row?.is_demo === "true";
  } catch {
    return false;
  }
}

/* ---------------- cookie "voltou no mesmo navegador dentro de 24 h" ---------------- */

export const DEMO_COOKIE = "bioflorais_b2b_demo";

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;

  if (!value) throw new Error("ADMIN_SESSION_SECRET não configurada.");

  return value;
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(`b2b-demo:${payload}`).digest("base64url");

export function createDemoCookie(responsibleId: string, expiresAt: Date): string {
  const payload = Buffer.from(JSON.stringify({ responsibleId, exp: expiresAt.getTime() }), "utf8").toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function readDemoCookie(value: string | undefined, now: Date = new Date()): { responsibleId: string } | null {
  if (!value) return null;

  const [payload, signature] = value.split(".");

  if (!payload || !signature) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);

    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { responsibleId?: string; exp?: number };

    if (!parsed.responsibleId || !parsed.exp || parsed.exp <= now.getTime()) return null;

    return { responsibleId: parsed.responsibleId };
  } catch {
    return null;
  }
}

/* ---------------- limpeza diária ---------------- */

export type CleanupResult = { sellers: number; clients: number; offers: number };

/*
 * Apaga SÓ vendedor de demonstração EXPIRADO e o que é dele (clientes só dele, vínculos, ofertas, links,
 * condições, eventos, modelos, regras de comissão), numa única instrução. Vendedor demo com pedido ligado
 * é preservado. Vendedor real (is_demo = false) nunca entra.
 */
export async function cleanupExpiredDemo(run: SqlRunner, now: Date = new Date()): Promise<CleanupResult> {
  const [row] = await run(
    `WITH exp AS (
       SELECT r.id FROM b2b_responsibles r
        WHERE r.is_demo = true AND r.demo_expires_at IS NOT NULL AND r.demo_expires_at < $1::timestamptz
          AND NOT EXISTS (SELECT 1 FROM b2b_offers f INNER JOIN orders o ON o.b2b_offer_id = f.id WHERE f.responsible_id = r.id)
     ),
     offs AS (SELECT f.id FROM b2b_offers f WHERE f.responsible_id IN (SELECT id FROM exp)),
     cli AS (
       SELECT c.id FROM b2b_clients c
        WHERE EXISTS (SELECT 1 FROM b2b_client_relationships x WHERE x.client_id = c.id AND x.responsible_id IN (SELECT id FROM exp))
          AND NOT EXISTS (SELECT 1 FROM b2b_client_relationships y WHERE y.client_id = c.id AND y.responsible_id NOT IN (SELECT id FROM exp))
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.b2b_client_id = c.id)
     ),
     d_views AS (DELETE FROM b2b_offer_line_views WHERE offer_id IN (SELECT id FROM offs) RETURNING 1),
     d_links AS (DELETE FROM b2b_offer_links WHERE offer_id IN (SELECT id FROM offs) RETURNING 1),
     d_promos AS (DELETE FROM b2b_offer_promotions WHERE offer_id IN (SELECT id FROM offs) RETURNING 1),
     d_groups AS (DELETE FROM b2b_offer_commercial_groups WHERE offer_id IN (SELECT id FROM offs) RETURNING 1),
     d_rules AS (DELETE FROM b2b_commission_rules WHERE responsible_id IN (SELECT id FROM exp) OR client_id IN (SELECT id FROM cli) RETURNING 1),
     d_templates AS (DELETE FROM b2b_offer_templates WHERE responsible_id IN (SELECT id FROM exp) RETURNING 1),
     d_offers AS (DELETE FROM b2b_offers WHERE id IN (SELECT id FROM offs) RETURNING 1),
     d_rel AS (DELETE FROM b2b_client_relationships WHERE responsible_id IN (SELECT id FROM exp) RETURNING 1),
     d_clients AS (DELETE FROM b2b_clients WHERE id IN (SELECT id FROM cli) RETURNING 1),
     d_sellers AS (DELETE FROM b2b_responsibles WHERE id IN (SELECT id FROM exp) RETURNING 1)
     SELECT (SELECT count(*) FROM d_sellers)::int AS sellers,
            (SELECT count(*) FROM d_clients)::int AS clients,
            (SELECT count(*) FROM d_offers)::int AS offers`,
    [now.toISOString()]
  );

  return { sellers: Number(row?.sellers ?? 0), clients: Number(row?.clients ?? 0), offers: Number(row?.offers ?? 0) };
}
