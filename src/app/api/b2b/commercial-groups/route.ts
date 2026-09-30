import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bCommercialGroups } from "@/lib/db/schema";
import { requireResponsible } from "@/lib/b2b/require-responsible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responsible = await requireResponsible(request);

  if (!responsible) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const commercialGroups = await db
    .select({
      id: b2bCommercialGroups.id,
      slug: b2bCommercialGroups.slug,
      name: b2bCommercialGroups.name,
    })
    .from(b2bCommercialGroups)
    .where(and(eq(b2bCommercialGroups.active, true), eq(b2bCommercialGroups.b2bVisible, true)))
    .orderBy(b2bCommercialGroups.sortOrder, b2bCommercialGroups.name);

  return NextResponse.json({ commercialGroups });
}
