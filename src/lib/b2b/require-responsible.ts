/**
 * BIO FLORAIS B2B — exige responsável/RCA logado e ativo.
 * Retorna null (nunca lança) quando a sessão é inválida.
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import {
  B2B_SESSION_COOKIE,
  readB2BResponsibleSession,
} from "@/lib/b2b/responsible-session";

export async function requireResponsible(request: NextRequest) {
  const session = readB2BResponsibleSession(
    request.cookies.get(B2B_SESSION_COOKIE)?.value
  );

  if (!session) {
    return null;
  }

  const [responsible] = await db
    .select({
      id: b2bResponsibles.id,
      name: b2bResponsibles.name,
      type: b2bResponsibles.type,
      status: b2bResponsibles.status,
    })
    .from(b2bResponsibles)
    .where(eq(b2bResponsibles.id, session.responsibleId))
    .limit(1);

  if (!responsible || responsible.status !== "active") {
    return null;
  }

  return responsible;
}
