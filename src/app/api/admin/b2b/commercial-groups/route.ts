/**
 * ADMIN B2B — linhas comerciais (b2b_commercial_groups): listar e criar.
 * É o que o vendedor escolhe ao montar a oferta.
 */

import { NextRequest, NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bCommercialGroupProducts,
  b2bCommercialGroups,
  b2bOfferCommercialGroups,
} from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import { isTestCommercialGroup } from "@/lib/b2b/test-groups";
import {
  parseCommercialGroupBody,
  replaceGroupProducts,
  validateGroupConflicts,
} from "@/lib/b2b/admin-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const groups = await db
      .select({
        id: b2bCommercialGroups.id,
        slug: b2bCommercialGroups.slug,
        name: b2bCommercialGroups.name,
        active: b2bCommercialGroups.active,
        b2bVisible: b2bCommercialGroups.b2bVisible,
        sortOrder: b2bCommercialGroups.sortOrder,
        updatedAt: b2bCommercialGroups.updatedAt,
      })
      .from(b2bCommercialGroups)
      .orderBy(asc(b2bCommercialGroups.sortOrder), asc(b2bCommercialGroups.name));

    // Dado de teste vazado em produção não aparece na lista de linhas do admin.
    const visibleGroups = groups.filter((group) => !isTestCommercialGroup(group));

    const links = await db
      .select({
        groupId: b2bCommercialGroupProducts.commercialGroupId,
        productId: b2bCommercialGroupProducts.productId,
      })
      .from(b2bCommercialGroupProducts);

    const offerCounts = await db
      .select({
        groupId: b2bOfferCommercialGroups.commercialGroupId,
        total: sql<number>`count(*)::int`,
      })
      .from(b2bOfferCommercialGroups)
      .groupBy(b2bOfferCommercialGroups.commercialGroupId);

    const offersBy = new Map(offerCounts.map((row) => [row.groupId, Number(row.total)]));

    return NextResponse.json({
      groups: visibleGroups.map((group) => ({
        ...group,
        productIds: links.filter((link) => link.groupId === group.id).map((link) => link.productId),
        offers: offersBy.get(group.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("[admin/b2b/commercial-groups GET]", error);
    return NextResponse.json({ error: "Erro ao carregar linhas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseCommercialGroupBody(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const conflict = await validateGroupConflicts(parsed.value);

    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const [group] = await db
      .insert(b2bCommercialGroups)
      .values({
        slug: parsed.value.slug,
        name: parsed.value.name,
        active: parsed.value.active,
        b2bVisible: parsed.value.b2bVisible,
        sortOrder: parsed.value.sortOrder,
      })
      .returning({ id: b2bCommercialGroups.id });

    await replaceGroupProducts(group.id, parsed.value.productIds);

    return NextResponse.json({ ok: true, id: group.id });
  } catch (error) {
    console.error("[admin/b2b/commercial-groups POST]", error);
    return NextResponse.json({ error: "Erro ao criar a linha." }, { status: 500 });
  }
}
