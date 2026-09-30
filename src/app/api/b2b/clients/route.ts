/**
 * BIO FLORAIS B2B — clientes do responsável logado (listar / cadastrar).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bClientRelationships, b2bClients } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const clients = await db
    .select({
      id: b2bClients.id,
      displayName: b2bClients.displayName,
      contactName: b2bClients.contactName,
      email: b2bClients.email,
      phone: b2bClients.phone,
      active: b2bClients.active,
    })
    .from(b2bClientRelationships)
    .innerJoin(b2bClients, eq(b2bClients.id, b2bClientRelationships.clientId))
    .where(
      and(
        eq(b2bClientRelationships.responsibleId, responsible.id),
        eq(b2bClientRelationships.active, true),
        isNull(b2bClientRelationships.unlinkedAt)
      )
    )
    .orderBy(b2bClients.displayName);

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
  };

  const displayName = body.displayName?.trim() ?? "";

  if (!displayName) {
    return NextResponse.json(
      { error: "Informe o nome/razão social do cliente." },
      { status: 400 }
    );
  }

  const [client] = await db
    .insert(b2bClients)
    .values({
      displayName,
      contactName: body.contactName?.trim() || null,
      email: body.email?.trim().toLowerCase() || null,
      phone: body.phone?.replace(/\D/g, "") || null,
    })
    .returning({ id: b2bClients.id });

  await db.insert(b2bClientRelationships).values({
    clientId: client.id,
    responsibleId: responsible.id,
  });

  return NextResponse.json({ success: true, clientId: client.id });
}
