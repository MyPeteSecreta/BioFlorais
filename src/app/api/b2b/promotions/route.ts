/**
 * BIO FLORAIS B2B — promoções selecionáveis pelo responsável.
 * Só o tipo com efeito implementado ("compre X, leve Y grátis").
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bPromotions } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { B2B_SUPPORTED_PROMOTION_TYPE } from "@/lib/b2b/promotion-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const promotions = await db
    .select({
      id: b2bPromotions.id,
      name: b2bPromotions.name,
      buyQuantity: b2bPromotions.buyQuantity,
      freeQuantity: b2bPromotions.freeQuantity,
    })
    .from(b2bPromotions)
    .where(
      and(
        eq(b2bPromotions.type, B2B_SUPPORTED_PROMOTION_TYPE),
        eq(b2bPromotions.active, true),
        eq(b2bPromotions.sellerSelectable, true)
      )
    );

  return NextResponse.json({ promotions });
}
