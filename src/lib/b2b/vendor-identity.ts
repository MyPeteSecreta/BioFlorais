/**
 * Rodada 5 / V2: e-mail "preso". Editar e-mail/login de um vendedor e "Desativar e liberar e-mail".
 * Nada é apagado: o vendedor continua com o mesmo id (pedidos e comissões seguem ligados), o e-mail
 * e o login originais ficam em email_original/login_original (SQL 31b). Convite revogado ou
 * expirado nunca reserva e-mail (só quem já é vendedor ocupa o e-mail).
 */

import type { SqlRunner } from "@/lib/b2b/ownership";

const LOGIN_PATTERN = /^[a-z0-9._@+-]{3,254}$/;

export const RELEASED_DOMAIN = "invalid";

export function releasedMarker(id: string) {
  return `liberado+${id}@${RELEASED_DOMAIN}`;
}

export function isReleasedEmail(email: string | null | undefined) {
  return String(email ?? "").endsWith(`@${RELEASED_DOMAIN}`) && String(email).startsWith("liberado+");
}

export type IdentityConflict = { id: string; name: string; status: string; field: "email" | "login" };

/** Mensagem para o admin: de quem é o e-mail/login e o que fazer. */
export function describeIdentityConflict(conflict: IdentityConflict) {
  const what = conflict.field === "email" ? "e-mail" : "login";
  const active = conflict.status === "active";

  return active
    ? `Este ${what} já pertence ao vendedor ativo ${conflict.name}. Edite o ${what} dele ou use outro.`
    : `Este ${what} já pertence a ${conflict.name} (inativo). Use "Editar e-mail/login" ou "Desativar e liberar e-mail" nele para liberar.`;
}

/** Quem já usa o e-mail ou o login (ignorando o próprio vendedor). null = livre. */
export async function findIdentityConflict(
  run: SqlRunner,
  input: { email?: string | null; login?: string | null },
  exceptId: string | null = null
): Promise<IdentityConflict | null> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const login = String(input.login ?? "").trim().toLowerCase();

  if (email) {
    const rows = await run(
      `SELECT id, name, status FROM b2b_responsibles
        WHERE (lower(email) = $1 OR lower(coalesce(login, '')) = $1) AND ($2::uuid IS NULL OR id <> $2::uuid)
        LIMIT 1`,
      [email, exceptId]
    );

    if (rows[0]) return { id: String(rows[0].id), name: String(rows[0].name), status: String(rows[0].status), field: "email" };
  }

  if (login) {
    const rows = await run(
      `SELECT id, name, status FROM b2b_responsibles
        WHERE (lower(coalesce(login, '')) = $1 OR lower(email) = $1) AND ($2::uuid IS NULL OR id <> $2::uuid)
        LIMIT 1`,
      [login, exceptId]
    );

    if (rows[0]) return { id: String(rows[0].id), name: String(rows[0].name), status: String(rows[0].status), field: "login" };
  }

  return null;
}

export type IdentityInput = { email: string; login: string };

export function parseIdentityInput(raw: { email?: unknown; login?: unknown }): { ok: true; value: IdentityInput } | { ok: false; error: string } {
  const email = String(raw.email ?? "").trim().toLowerCase();
  const login = String(raw.login ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Informe um e-mail válido." };
  }

  if (!LOGIN_PATTERN.test(login)) {
    return { ok: false, error: "Login inválido: use de 3 a 254 letras minúsculas, números, ponto, hífen, _ ou @." };
  }

  return { ok: true, value: { email, login } };
}

/** Guarda o original uma única vez (o primeiro valor é o que vale como histórico). */
const KEEP_ORIGINALS = `email_original = coalesce(email_original, email), login_original = coalesce(login_original, login)`;

export async function changeIdentity(
  run: SqlRunner,
  id: string,
  input: IdentityInput
): Promise<{ ok: true } | { ok: false; conflict?: IdentityConflict; notFound?: boolean }> {
  const conflict = await findIdentityConflict(run, input, id);

  if (conflict) return { ok: false, conflict };

  const rows = await run(
    `UPDATE b2b_responsibles SET ${KEEP_ORIGINALS}, email = $2, login = $3, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, input.email, input.login]
  );

  return rows.length > 0 ? { ok: true } : { ok: false, notFound: true };
}

/**
 * Desativa e libera o e-mail/login: status inactive, e-mail e login viram um marcador único
 * (`liberado+<id>@invalid`), originais guardados. Sem DELETE; o id e o que está ligado a ele ficam.
 * Convites pendentes desse e-mail também são revogados (não reservam nada).
 */
export async function releaseIdentity(run: SqlRunner, id: string): Promise<{ ok: boolean; originalEmail?: string }> {
  const marker = releasedMarker(id);
  const rows = await run(
    `UPDATE b2b_responsibles r
        SET email_original = coalesce(r.email_original, r.email),
            login_original = coalesce(r.login_original, r.login),
            email = $2, login = $2, status = 'inactive', released_at = now(), updated_at = now()
       FROM (SELECT id, email FROM b2b_responsibles WHERE id = $1) old
      WHERE r.id = old.id
      RETURNING old.email AS old_email`,
    [id, marker]
  );

  if (rows.length === 0) return { ok: false };

  const oldEmail = String(rows[0].old_email ?? "");

  if (oldEmail) {
    await run(
      `UPDATE b2b_responsible_invites SET status = 'revoked', revoked_at = now() WHERE status = 'pending' AND lower(email) = lower($1)`,
      [oldEmail]
    );
  }

  return { ok: true, originalEmail: oldEmail };
}
