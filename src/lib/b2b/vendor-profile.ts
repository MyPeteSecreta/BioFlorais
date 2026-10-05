/**
 * BIO FLORAIS B2B — período de teste do vendedor (7 dias) e cadastro completo.
 *
 *  - Cadastro RÁPIDO pelo convite: nome, WhatsApp, e-mail e senha. O vendedor já
 *    usa tudo (clientes, ofertas, links, pedidos, comissões).
 *  - trial_ends_at = cadastro + 7 dias. Banner no painel com os dias que faltam.
 *  - Cadastro COMPLETO a qualquer momento: CPF/CNPJ, endereço, Pix ou dados
 *    bancários e aceite do Termo RCA (data/hora, IP e versão). Preenche
 *    profile_completed_at e o banner some.
 *  - Teste vencido sem completar: o PAINEL mostra só a tela de completar. Os
 *    LINKS dos clientes e a atribuição dos pedidos NÃO dependem disto (só olham
 *    status do vendedor), então continuam funcionando.
 *  - Comissão acumula, mas fica RETIDA até completar (commissions.ts).
 * Funções puras + consultas sobre SqlRunner (testáveis em PGlite).
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";

export const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Versão do Termo RCA gravada no aceite: definida UMA vez em rca-terms.ts (junto com o texto). */
export { RCA_TERMS_VERSION } from "@/lib/b2b/rca-terms";

export type AccessState =
  | { state: "complete" }
  | { state: "trial"; daysLeft: number; endsAt: Date }
  | { state: "expired"; endsAt: Date };

export function trialEndsFrom(now: Date, days = TRIAL_DAYS) {
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * Situação de acesso. Sem trial_ends_at e sem profile_completed_at = cadastro
 * antigo (feito com o formulário completo): conta como completo.
 */
export function accessState(
  input: { trialEndsAt: Date | null; profileCompletedAt: Date | null },
  now = new Date()
): AccessState {
  if (input.profileCompletedAt || !input.trialEndsAt) return { state: "complete" };

  if (now.getTime() <= input.trialEndsAt.getTime()) {
    return { state: "trial", endsAt: input.trialEndsAt, daysLeft: Math.max(1, Math.ceil((input.trialEndsAt.getTime() - now.getTime()) / DAY_MS)) };
  }

  return { state: "expired", endsAt: input.trialEndsAt };
}

const brDate = (value: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(value);

export function bannerText(access: AccessState) {
  if (access.state !== "trial") return null;
  const unit = access.daysLeft === 1 ? "dia" : "dias";
  return `Período de teste: ${access.daysLeft === 1 ? "falta" : "faltam"} ${access.daysLeft} ${unit} (até ${brDate(access.endsAt)}). Complete seu cadastro para continuar e receber suas comissões.`;
}

/** Texto da situação na lista de vendedores do admin. */
export function adminSituation(input: { trialEndsAt: Date | null; profileCompletedAt: Date | null }, now = new Date()) {
  const access = accessState(input, now);
  if (access.state === "complete") return "Cadastro completo";
  if (access.state === "trial") return `Em teste até ${brDate(access.endsAt).slice(0, 5)}`;
  return "Teste vencido";
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const text = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export type QuickSignup = { name: string; phone: string; email: string; password: string };

export function parseQuickSignup(
  body: Record<string, unknown>,
  inviteEmail: string
): { ok: true; value: QuickSignup } | { ok: false; error: string } {
  const name = text(body.name);
  const phone = digits(body.phone);
  const email = (text(body.email) || inviteEmail).toLowerCase();
  const password = String(body.password ?? "");

  if (name.length < 3) return { ok: false, error: "Informe seu nome." };
  if (phone.length < 10 || phone.length > 13) return { ok: false, error: "Informe seu WhatsApp com DDD." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: "Informe um e-mail válido." };
  if (password.length < 8) return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres." };

  return { ok: true, value: { name, phone, email, password } };
}

export type CompleteProfile = {
  personType: "pf" | "pj";
  cpf: string | null;
  rg: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  pixKey: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  rcaTermsAccepted: boolean;
};

export function parseCompleteProfile(
  body: Record<string, unknown>,
  responsibleType: string
): { ok: true; value: CompleteProfile } | { ok: false; error: string } {
  const personType = body.personType === "pj" ? "pj" : "pf";
  const cpf = digits(body.cpf);
  const cnpj = digits(body.cnpj);
  const rg = text(body.rg);
  const stateRegistration = text(body.stateRegistration);
  const postalCode = digits(body.postalCode);
  const street = text(body.street);
  const addressNumber = text(body.addressNumber);
  const neighborhood = text(body.neighborhood);
  const city = text(body.city);
  const state = text(body.state).toUpperCase();
  const pixKey = text(body.pixKey);
  const bankName = text(body.bankName);
  const bankAgency = text(body.bankAgency);
  const bankAccount = text(body.bankAccount);

  if (personType === "pf" && cpf.length !== 11) return { ok: false, error: "Informe um CPF válido (11 dígitos)." };
  if (personType === "pj" && cnpj.length !== 14) return { ok: false, error: "Informe um CNPJ válido (14 dígitos)." };

  if (postalCode.length !== 8 || !street || !addressNumber || !neighborhood || !city || !/^[A-Z]{2}$/.test(state)) {
    return { ok: false, error: "Preencha o endereço completo (CEP, rua, número, bairro, cidade e UF)." };
  }

  // Chave Pix OU dados bancários completos.
  const bankComplete = Boolean(bankName && bankAgency && bankAccount);

  if (!pixKey && !bankComplete) {
    return { ok: false, error: "Informe a chave Pix ou os dados bancários (banco, agência e conta) para receber as comissões." };
  }

  if (responsibleType === "rca" && body.rcaTermsAccepted !== true) {
    return { ok: false, error: "É preciso aceitar o Termo de adesão do RCA." };
  }

  return {
    ok: true,
    value: {
      personType,
      cpf: personType === "pf" ? cpf : null,
      rg: personType === "pf" ? rg || null : null,
      cnpj: personType === "pj" ? cnpj : null,
      stateRegistration: personType === "pj" ? stateRegistration || null : null,
      postalCode,
      street,
      addressNumber,
      addressComplement: text(body.addressComplement) || null,
      neighborhood,
      city,
      state,
      pixKey: pixKey || null,
      bankName: bankName || null,
      bankAgency: bankAgency || null,
      bankAccount: bankAccount || null,
      rcaTermsAccepted: body.rcaTermsAccepted === true,
    },
  };
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/**
 * Situação de acesso de um vendedor. Sem as colunas (SQL 26b não aplicado) trata
 * como completo: ninguém é bloqueado por falta de migração.
 */
export async function loadVendorAccess(run: SqlRunner, responsibleId: string, now = new Date()): Promise<AccessState> {
  if (!isUuid(responsibleId)) return { state: "complete" };

  try {
    const [row] = await run(`SELECT to_char(trial_ends_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS trial_ends_at,
            to_char(profile_completed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS profile_completed_at
       FROM b2b_responsibles WHERE id = $1`, [responsibleId]);

    if (!row) return { state: "complete" };

    return accessState(
      {
        trialEndsAt: row.trial_ends_at ? new Date(String(row.trial_ends_at)) : null,
        profileCompletedAt: row.profile_completed_at ? new Date(String(row.profile_completed_at)) : null,
      },
      now
    );
  } catch {
    return { state: "complete" };
  }
}

/** Vendedores com cadastro completo (para liberar/reter comissão). Sem a coluna = todos completos. */
export async function loadCompletedVendorIds(run: SqlRunner, ids: string[]): Promise<Set<string>> {
  const valid = ids.filter((id) => isUuid(id));
  if (valid.length === 0) return new Set();

  try {
    const rows = await run(
      `SELECT id, (profile_completed_at IS NOT NULL OR trial_ends_at IS NULL) AS completo
         FROM b2b_responsibles WHERE id = ANY($1::uuid[])`,
      [valid]
    );

    return new Set(rows.filter((row) => row.completo).map((row) => String(row.id)));
  } catch {
    return new Set(valid);
  }
}
