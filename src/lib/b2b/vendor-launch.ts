/**
 * BIO FLORAIS B2B — PEDIDO LANÇADO PELO VENDEDOR ("Lançar pedido").
 *
 * O vendedor está na loja (ou ao telefone) e lança o pedido pelo MESMO link/oferta do cliente (Offer
 * Builder, loja do link e checkout B2B). Este módulo concentra o que é novo e o que o servidor revalida:
 *  - cadastro do cliente com CPF/CNPJ validado e a regra de DONO (documento de cliente de OUTRO vendedor
 *    é recusado: "cliente atendido por outro representante");
 *  - autorização do modo lançamento: sessão do vendedor dono da oferta, ativo e fora da demonstração;
 *  - prévia da comissão do vendedor (só ele vê).
 * O pedido nasce com orders.origin = 'vendedor' (relatório), comissão normal congelada, Central/Omie normais.
 * Só SqlRunner + funções puras (testável em PGlite, sem Next/db).
 */

import { DEMO_PURCHASE_DISABLED_MESSAGE, loadDemoState } from "@/lib/b2b/demo";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { readB2BResponsibleSession } from "@/lib/b2b/responsible-session";

import { LAUNCH_OTHER_REP_MESSAGE } from "@/lib/b2b/launch-constants";

export { LAUNCH_LGPD_NOTICE, LAUNCH_ORIGIN, LAUNCH_OTHER_REP_MESSAGE, buildCardPayLinkPath } from "@/lib/b2b/launch-constants";

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;

  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

export function parseDocument(raw: unknown): { ok: true; digits: string; kind: "cpf" | "cnpj" } | { ok: false; error: string } {
  const digits = String(raw ?? "").replace(/\D/g, "");

  if (digits.length === 11) {
    return isValidCpf(digits) ? { ok: true, digits, kind: "cpf" } : { ok: false, error: "CPF inválido. Confira os números." };
  }

  if (digits.length === 14) {
    return isValidCnpj(digits) ? { ok: true, digits, kind: "cnpj" } : { ok: false, error: "CNPJ inválido. Confira os números." };
  }

  return { ok: false, error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." };
}

// ---------------------------------------------------------------------------
// Cliente novo
// ---------------------------------------------------------------------------

export type LaunchClientInput = { name: string; document: string; kind: "cpf" | "cnpj"; email: string; phone: string };

export function parseLaunchClient(body: Record<string, unknown>): { ok: true; value: LaunchClientInput } | { ok: false; error: string } {
  const name = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const document = parseDocument(body.document);

  if (name.length < 2) return { ok: false, error: "Informe o nome ou a razão social do cliente." };
  if (!document.ok) return { ok: false, error: document.error };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: "Informe um e-mail válido do cliente." };
  if (phone.length < 10 || phone.length > 13) return { ok: false, error: "Informe o WhatsApp do cliente com DDD." };

  return { ok: true, value: { name, document: document.digits, kind: document.kind, email, phone } };
}

export type DocumentOwner = { clientId: string; responsibleId: string; responsibleName: string; clientName: string };

export type LaunchClientResult =
  | { ok: true; clientId: string; displayName: string; reused: boolean }
  | { ok: false; status: number; error: string };

/**
 * Cadastra o cliente do vendedor (ou reaproveita o que ele já tem com o mesmo documento).
 * `findOwner` = findDocumentOwner (storefront.ts): injetado para manter este módulo sem db.
 */
export async function registerLaunchClient(
  run: SqlRunner,
  responsibleId: string,
  input: LaunchClientInput,
  findOwner: (run: SqlRunner, documentDigits: string) => Promise<DocumentOwner | null>
): Promise<LaunchClientResult> {
  const owner = await findOwner(run, input.document);

  if (owner) {
    if (owner.responsibleId !== responsibleId) {
      return { ok: false, status: 409, error: LAUNCH_OTHER_REP_MESSAGE };
    }

    return { ok: true, clientId: owner.clientId, displayName: owner.clientName, reused: true };
  }

  let clientId: string | null = null;

  try {
    const [row] = await run(
      `INSERT INTO b2b_clients (display_name, email, phone, document) VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.name, input.email, input.phone, input.document]
    );
    clientId = row ? String(row.id) : null;
  } catch {
    // Sem a coluna document (SQL 35b): cadastra sem ela; a regra de dono segue pelos pedidos.
    const [row] = await run(`INSERT INTO b2b_clients (display_name, email, phone) VALUES ($1, $2, $3) RETURNING id`, [
      input.name,
      input.email,
      input.phone,
    ]);
    clientId = row ? String(row.id) : null;
  }

  if (!clientId) return { ok: false, status: 500, error: "Não foi possível cadastrar o cliente." };

  await run(`INSERT INTO b2b_client_relationships (client_id, responsible_id) VALUES ($1::uuid, $2::uuid)`, [clientId, responsibleId]);

  return { ok: true, clientId, displayName: input.name, reused: false };
}

// ---------------------------------------------------------------------------
// Autorização do modo lançamento
// ---------------------------------------------------------------------------

export type LaunchAccess = { ok: true } | { ok: false; status: number; error: string };

/**
 * O pedido só pode ser "lançado" pelo vendedor DONO da oferta: sessão válida, vendedor ativo, fora da
 * demonstração. Vendedor em teste PODE lançar (a comissão fica retida até completar o cadastro).
 */
export async function verifyLaunchAccess(
  run: SqlRunner,
  sessionCookie: string | undefined,
  offerResponsibleId: string
): Promise<LaunchAccess> {
  const session = readB2BResponsibleSession(sessionCookie);

  if (!session) {
    return { ok: false, status: 401, error: "Sua sessão de vendedor expirou. Entre de novo para lançar o pedido." };
  }

  if (session.responsibleId !== offerResponsibleId) {
    return { ok: false, status: 403, error: "Esta oferta não é sua: só o representante dono pode lançar o pedido." };
  }

  const [row] = await run(`SELECT status FROM b2b_responsibles WHERE id = $1::uuid LIMIT 1`, [offerResponsibleId]);

  if (!row || row.status !== "active") {
    return { ok: false, status: 403, error: "Vendedor inativo." };
  }

  const demo = await loadDemoState(run, offerResponsibleId);

  if (demo.isDemo) {
    return { ok: false, status: 403, error: DEMO_PURCHASE_DISABLED_MESSAGE };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comissão estimada (só o vendedor vê)
// ---------------------------------------------------------------------------

export function estimateCommissionCents(
  snapshots: ReadonlyArray<{ unitPriceCents: number; paidQty: number; commissionTotalPercent: string | null }>
): { cents: number; configured: boolean } {
  let cents = 0;
  let configured = false;

  for (const item of snapshots) {
    if (item.commissionTotalPercent === null || item.commissionTotalPercent === undefined) continue;
    const percent = Number(item.commissionTotalPercent);
    if (!Number.isFinite(percent)) continue;

    configured = true;
    cents += Math.round((item.unitPriceCents * item.paidQty * percent) / 100);
  }

  return { cents, configured };
}
