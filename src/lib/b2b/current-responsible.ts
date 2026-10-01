/**
 * BIO FLORAIS B2B — vendedor logado em páginas do servidor (App Router).
 * Sem sessão válida ou vendedor desativado -> /b2b/login.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  B2B_SESSION_COOKIE,
  readB2BResponsibleSession,
} from "@/lib/b2b/responsible-session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export type CurrentResponsible = { id: string; name: string; type: string };

export async function requireResponsiblePage(): Promise<CurrentResponsible> {
  const cookieStore = await cookies();
  const session = readB2BResponsibleSession(cookieStore.get(B2B_SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/b2b/login");
  }

  const [row] = await getAppSqlRunner()(
    `SELECT id, name, type FROM b2b_responsibles WHERE id = $1 AND status = 'active' LIMIT 1`,
    [session.responsibleId]
  );

  if (!row) {
    redirect("/b2b/login");
  }

  return { id: String(row.id), name: String(row.name), type: String(row.type) };
}
