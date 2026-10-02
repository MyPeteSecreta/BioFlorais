/**
 * ADMIN B2B — editar promoção "compre X, leve Y grátis".
 * Promoções de outros tipos não são editáveis (sem efeito na Bio).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bPromotions } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import { isUuid } from "@/lib/b2b/admin-input";
import {
  B2B_SUPPORTED_PROMOTION_TYPE,
  parsePromotionBody,
  replacePromotionLinks,
  validatePromotionLinks,
} from "@/lib/b2b/admin-promotions";

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
      return NextResponse.json({ error: "Promoção não encontrada." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parsePromotionBody(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const linkError = await validatePromotionLinks(parsed.value);

    if (linkError) {
      return NextResponse.json({ error: linkError }, { status: 400 });
    }

    const [updated] = await db
      .update(b2bPromotions)
      .set({
        name: parsed.value.name,
        promoType: parsed.value.promoType,
        buyQuantity: parsed.value.buyQuantity,
        freeQuantity: parsed.value.freeQuantity,
        active: parsed.value.active,
        sellerSelectable: parsed.value.sellerSelectable,
        startsAt: parsed.value.startsAt,
        endsAt: parsed.value.endsAt,
        updatedAt: new Date(),
      })
      .where(and(eq(b2bPromotions.id, id), eq(b2bPromotions.type, B2B_SUPPORTED_PROMOTION_TYPE)))
      .returning({ id: b2bPromotions.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Promoção não encontrada ou de um tipo que não é editável." },
        { status: 404 }
      );
    }

    await replacePromotionLinks(id, parsed.value);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/b2b/promotions/:id PATCH]", error);
    return NextResponse.json({ error: "Erro ao salvar a promoção." }, { status: 500 });
  }
}
