/**
 * ADMIN B2B — produtos para o seletor das linhas/promoções
 * (filtro por categoria e busca são feitos na tela).
 */

import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        category: products.category,
        lineSlug: products.lineSlug,
        priceCents: products.priceCents,
        active: products.active,
      })
      .from(products)
      .orderBy(asc(products.name));

    return NextResponse.json({ products: rows });
  } catch (error) {
    console.error("[admin/b2b/products GET]", error);
    return NextResponse.json({ error: "Erro ao carregar produtos." }, { status: 500 });
  }
}
