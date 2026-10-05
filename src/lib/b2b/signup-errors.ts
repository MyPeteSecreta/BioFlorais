/**
 * BIO FLORAIS B2B — erros reais do cadastro rápido do vendedor.
 *
 * O cadastro dizia sempre "e-mail já em uso ou o SQL 26b não foi aplicado", mesmo quando a
 * causa era outra (ex.: coluna legada NOT NULL no banco). Aqui o erro do Postgres é lido
 * (código, coluna, constraint), logado por inteiro no servidor e traduzido para a causa
 * real. Também tenta de novo preenchendo coluna legada NOT NULL que o cadastro rápido
 * (de propósito) não envia. Puro, testado em scripts/b2b-vendor-trial.test.mjs.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

export type PgErrorInfo = {
  code: string | null;
  column: string | null;
  constraint: string | null;
  detail: string | null;
  message: string;
};

/** Lê o erro do Postgres (o drizzle embrulha o original em `cause`). */
export function pgErrorInfo(error: unknown): PgErrorInfo {
  const seen = new Set<unknown>();
  let current: unknown = error;
  let best: Record<string, unknown> | null = null;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as Record<string, unknown>;

    if (typeof candidate.code === "string" || typeof candidate.column === "string" || typeof candidate.constraint === "string") {
      best = candidate;
      break;
    }

    current = candidate.cause;
  }

  const base = (best ?? (error as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);

  return {
    code: text(base.code),
    column: text(base.column),
    constraint: text(base.constraint),
    detail: text(base.detail),
    message: text(base.message) ?? String(error),
  };
}

/** Mensagem para o vendedor/admin com a causa REAL. */
export function describeSignupError(info: PgErrorInfo): string {
  const where = `${info.constraint ?? ""} ${info.detail ?? ""}`.toLowerCase();

  if (info.code === "23505") {
    if (/email|login/.test(where)) return "Este e-mail já está cadastrado para outro vendedor. Use outro e-mail ou fale com o administrador.";
    if (/invite/.test(where)) return "Este convite já foi usado. Peça um novo ao administrador.";
    return `Já existe um cadastro com estes dados (${info.constraint ?? "valor repetido"}). Fale com o administrador.`;
  }

  if (info.code === "23502") {
    return `O banco exige o campo "${info.column ?? "?"}" no cadastro de vendedor. Avise o administrador para rodar o SQL 28b.`;
  }

  if (info.code === "42703" || info.code === "42P01") {
    return `Falta uma coluna ou tabela no banco (${info.message}). Avise o administrador para rodar o SQL 26b.`;
  }

  if (info.code === "23514") {
    return `O banco recusou os dados (regra ${info.constraint ?? "de validação"}). Avise o administrador.`;
  }

  return "Não foi possível concluir o cadastro agora. Tente de novo em instantes; se persistir, avise o administrador (o erro ficou registrado).";
}

/**
 * Insere; se o banco recusar por coluna legada NOT NULL (23502) que o cadastro rápido não
 * envia, repete preenchendo essa coluna com vazio (até 12 colunas). `columnToKey` mapeia o
 * nome da coluna no banco para a propriedade do schema.
 */
export async function insertWithNotNullFallback<T>(
  insert: (values: Record<string, unknown>) => Promise<T>,
  base: Record<string, unknown>,
  columnToKey: Map<string, string>,
  onRetry?: (info: PgErrorInfo) => void
): Promise<T> {
  const values: Record<string, unknown> = { ...base };

  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      return await insert(values);
    } catch (error) {
      const info = pgErrorInfo(error);
      const key = info.column ? columnToKey.get(info.column) : undefined;

      if (info.code !== "23502" || !key || key in values) throw error;

      onRetry?.(info);
      values[key] = "";
    }
  }

  return insert(values);
}

/** E-mail (ou login) já usado por um vendedor. */
export async function findVendorByEmail(run: SqlRunner, email: string) {
  const [row] = await run(
    `SELECT id, name FROM b2b_responsibles WHERE lower(email) = $1 OR lower(login) = $1 LIMIT 1`,
    [email.toLowerCase()]
  );

  return row ? { id: String(row.id), name: String(row.name) } : null;
}
