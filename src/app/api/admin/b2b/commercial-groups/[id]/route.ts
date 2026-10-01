/**
 * ADMIN B2B — editar linha comercial (dados + produtos).
 * Não há exclusão: para tirar uma linha de circulação, desative-a ou
 * oculte-a do B2B (ofertas antigas continuam íntegras).
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bCommercialGroups } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import {
  parseCommercialGroupBody,
  replaceGroupProducts,
  validateGroupConflicts,
} from "@/lib/b2b/admin-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Linha não encontrada." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseCommercialGroupBody(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const conflict = await validateGroupConflicts(parsed.value, id);

    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const [updated] = await db
      .update(b2bCommercialGroups)
      .set({
        slug: parsed.value.slug,
        name: parsed.value.name,
        active: parsed.value.active,
        b2bVisible: parsed.value.b2bVisible,
        sortOrder: parsed.value.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(b2bCommercialGroups.id, id))
      .returning({ id: b2bCommercialGroups.id });

    if (!updated) {
      return NextResponse.json({ error: "Linha não encontrada." }, { status: 404 });
    }

    await replaceGroupProducts(id, parsed.value.productIds);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/b2b/commercial-groups/:id PATCH]", error);
    return NextResponse.json({ error: "Erro ao salvar a linha." }, { status: 500 });
  }
}
