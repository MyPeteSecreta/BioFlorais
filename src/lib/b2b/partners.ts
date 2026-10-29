/**
 * BIO FLORAIS B2B — L3: página pública /parceiros, código de captação do vendedor ("Meu link de
 * captação": /parceiros?v=<código>), vendedor da casa e cadastro rápido do lojista.
 * Tudo sobre SqlRunner (testado em PGlite). O código tem 6 letras/números e não revela e-mail.
 */

import { forwardQuery } from "@/lib/forward-query";
import { randomInt } from "node:crypto";

import { NOT_DEMO_SQL } from "@/lib/b2b/demo";
import type { SqlRunner } from "@/lib/b2b/ownership";

export const HOUSE_SETTING_KEY = "house_responsible_id";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-Z0-9]{4,12}$/;

export function generateReferralCode(random: (max: number) => number = randomInt) {
  let code = "";

  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];

  return code;
}

export function normalizeReferralCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();

  return CODE_RE.test(code) ? code : null;
}

export function partnersPath(code: string) {
  return `/parceiros?v=${encodeURIComponent(code)}`;
}

/** Parâmetros INTERNOS do /parceiros (não vão para a loja): o código do vendedor e o modo lançamento. */
export const PARTNER_INTERNAL_PARAMS = ["v", "lancar", "promo"] as const;

/**
 * O redirecionamento /parceiros -> /b2b/oferta/<token> não pode descartar a query string: repassa utm_* e demais
 * parâmetros (exceto os internos) para medirmos as vendas dos anúncios.
 */
export function withForwardedParams(
  path: string,
  params: Record<string, string | string[] | undefined> | undefined
): string {
  return forwardQuery(path, params, PARTNER_INTERNAL_PARAMS);
}

export type PartnerSeller = { id: string; name: string; referralCode: string | null; type: string };

/** Vendedor ATIVO (não arquivado) dono do código. */
export async function findSellerByCode(run: SqlRunner, codeInput: unknown): Promise<PartnerSeller | null> {
  const code = normalizeReferralCode(codeInput);

  if (!code) return null;

  try {
    const [row] = await run(
      `SELECT id, name, type, referral_code FROM b2b_responsibles r
        WHERE upper(referral_code) = $1 AND status = 'active' AND ${NOT_DEMO_SQL("r")} LIMIT 1`,
      [code]
    );

    return row ? { id: String(row.id), name: String(row.name), type: String(row.type), referralCode: String(row.referral_code) } : null;
  } catch {
    return null;
  }
}

/** Vendedor da casa configurado no admin (deve estar ativo). */
export async function findHouseSeller(run: SqlRunner): Promise<PartnerSeller | null> {
  try {
    const [setting] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [HOUSE_SETTING_KEY]);

    if (!setting?.value) return null;

    const [row] = await run(`SELECT id, name, type, referral_code FROM b2b_responsibles r WHERE id = $1::uuid AND status = 'active' AND ${NOT_DEMO_SQL("r")}`, [
      String(setting.value),
    ]);

    return row ? { id: String(row.id), name: String(row.name), type: String(row.type), referralCode: (row.referral_code as string | null) ?? null } : null;
  } catch {
    return null;
  }
}

/** Quem recebe o lojista: o dono do ?v= se for válido; senão o vendedor da casa; senão ninguém. */
export async function resolvePartnerSeller(run: SqlRunner, codeInput: unknown) {
  const byCode = await findSellerByCode(run, codeInput);

  if (byCode) return { seller: byCode, via: "code" as const };

  const house = await findHouseSeller(run);

  return house ? { seller: house, via: "house" as const } : { seller: null, via: "none" as const };
}

/** Código do vendedor; cria (e grava) se ainda não tiver. null = SQL 35b não aplicado. */
export async function ensureReferralCode(run: SqlRunner, responsibleId: string): Promise<string | null> {
  try {
    const [row] = await run(`SELECT referral_code FROM b2b_responsibles WHERE id = $1::uuid`, [responsibleId]);

    if (!row) return null;
    if (row.referral_code) return String(row.referral_code);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateReferralCode();
      const rows = await run(
        `UPDATE b2b_responsibles SET referral_code = $2
          WHERE id = $1::uuid AND referral_code IS NULL
            AND NOT EXISTS (SELECT 1 FROM b2b_responsibles WHERE upper(referral_code) = $2)
          RETURNING referral_code`,
        [responsibleId, code]
      );

      if (rows[0]) return String(rows[0].referral_code);

      const [again] = await run(`SELECT referral_code FROM b2b_responsibles WHERE id = $1::uuid`, [responsibleId]);

      if (again?.referral_code) return String(again.referral_code);
    }

    return null;
  } catch {
    return null;
  }
}

export type SetCodeResult = { ok: true; code: string } | { ok: false; status: number; error: string };

/** Admin: troca o código (4 a 12 letras/números); recusa repetido. */
export async function setReferralCode(run: SqlRunner, responsibleId: string, input: unknown): Promise<SetCodeResult> {
  const code = normalizeReferralCode(input);

  if (!code) return { ok: false, status: 400, error: "Use de 4 a 12 letras ou números, sem espaços." };

  try {
    const [taken] = await run(`SELECT id FROM b2b_responsibles WHERE upper(referral_code) = $1 AND id <> $2::uuid LIMIT 1`, [code, responsibleId]);

    if (taken) return { ok: false, status: 409, error: "Este código já é de outro vendedor." };

    const rows = await run(`UPDATE b2b_responsibles SET referral_code = $2 WHERE id = $1::uuid RETURNING id`, [responsibleId, code]);

    return rows[0] ? { ok: true, code } : { ok: false, status: 404, error: "Vendedor não encontrado." };
  } catch {
    return { ok: false, status: 409, error: "Aplique o SQL 35b (página de parceiros) antes." };
  }
}

export async function setHouseSeller(run: SqlRunner, responsibleId: string | null): Promise<{ ok: boolean; error?: string }> {
  if (responsibleId === null) {
    await run(`DELETE FROM b2b_settings WHERE key = $1`, [HOUSE_SETTING_KEY]);

    return { ok: true };
  }

  const [row] = await run(`SELECT status FROM b2b_responsibles WHERE id = $1::uuid`, [responsibleId]);

  if (!row) return { ok: false, error: "Vendedor não encontrado." };
  if (row.status !== "active") return { ok: false, error: "O vendedor da casa precisa estar ativo." };

  await run(
    `INSERT INTO b2b_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [HOUSE_SETTING_KEY, responsibleId]
  );

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cadastro rápido do lojista
// ---------------------------------------------------------------------------

export type LeadInput = { name: string; document: string; phone: string; email: string; city: string; state: string };

function validCpf(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;

  const calc = (length: number) => {
    let sum = 0;

    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);

    const rest = (sum * 10) % 11;

    return rest === 10 ? 0 : rest;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function validCnpj(digits: string) {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;

  const calc = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;

    return rest < 2 ? 0 : 11 - rest;
  };

  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

export function parseLead(raw: Record<string, unknown>): { ok: true; value: LeadInput } | { ok: false; error: string } {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  const document = String(raw.document ?? "").replace(/\D/g, "");
  const phone = String(raw.phone ?? "").replace(/\D/g, "");
  const email = String(raw.email ?? "").trim().toLowerCase();
  const city = String(raw.city ?? "").trim().slice(0, 80);
  const state = String(raw.state ?? "").trim().toUpperCase();

  if (name.length < 2) return { ok: false, error: "Informe o nome da loja." };
  if (!validCnpj(document) && !validCpf(document)) return { ok: false, error: "Informe um CNPJ ou CPF válido." };
  if (phone.length < 10 || phone.length > 13) return { ok: false, error: "Informe o WhatsApp com DDD." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: "Informe um e-mail válido." };
  if (city.length < 2) return { ok: false, error: "Informe a cidade." };
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false, error: "Informe a UF (2 letras)." };

  return { ok: true, value: { name, document, phone, email, city, state } };
}

/** Cliente já captado por este vendedor com o mesmo e-mail ou documento (evita duplicar a cada acesso). */
export async function findExistingLead(run: SqlRunner, responsibleId: string, lead: LeadInput) {
  const [row] = await run(
    `SELECT c.id, c.display_name, c.phone FROM b2b_clients c
       JOIN b2b_client_relationships r ON r.client_id = c.id
      WHERE r.responsible_id = $1::uuid AND r.active = true AND r.unlinked_at IS NULL
        AND (lower(c.email) = $2 OR (c.document IS NOT NULL AND c.document = $3))
      ORDER BY c.created_at LIMIT 1`,
    [responsibleId, lead.email, lead.document]
  );

  return row ? { id: String(row.id), displayName: String(row.display_name), phone: (row.phone as string | null) ?? null } : null;
}

/** Cria o cliente do lojista ligado ao vendedor, com os dados e a origem (parceiros). */
export async function createLeadClient(
  run: SqlRunner,
  responsibleId: string,
  lead: LeadInput,
  source: { referralCode: string | null; via: "code" | "house" }
) {
  const [client] = await run(
    `INSERT INTO b2b_clients (display_name, email, phone, document, city, state, lead_source, lead_referral_code)
     VALUES ($1, $2, $3, $4, $5, $6, 'parceiros', $7) RETURNING id`,
    [lead.name, lead.email, lead.phone, lead.document, lead.city, lead.state, source.via === "code" ? source.referralCode : null]
  );

  await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ($1::uuid, $2::uuid)`, [client.id, responsibleId]);

  return { id: String(client.id), displayName: lead.name, phone: lead.phone };
}
