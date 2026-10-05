/**
 * BIO FLORAIS B2B — exige responsável/RCA logado e ativo.
 * Retorna null (nunca lança) quando a sessão é inválida.
 *
 * requireResponsible: usado nas rotas do PAINEL (clientes, ofertas, links...). Com o
 * período de teste VENCIDO e o cadastro incompleto devolve null: o painel só deixa
 * completar o cadastro. Os links públicos dos clientes e a atribuição dos pedidos NÃO
 * passam por aqui (só exigem vendedor ativo), então seguem funcionando.
 * requireResponsibleAnyState: só sessão + vendedor ativo (tela/rota de completar cadastro).
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import {
  B2B_SESSION_COOKIE,
  readB2BResponsibleSession,
} from "@/lib/b2b/responsible-session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadVendorAccess } from "@/lib/b2b/vendor-profile";

export async function requireResponsibleAnyState(request: NextRequest) {
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

export async function requireResponsible(request: NextRequest) {
  const responsible = await requireResponsibleAnyState(request);

  if (!responsible) {
    return null;
  }

  const access = await loadVendorAccess(getAppSqlRunner(), responsible.id);

  // Teste vencido sem cadastro completo: o painel só aceita completar o cadastro.
  return access.state === "expired" ? null : responsible;
}
