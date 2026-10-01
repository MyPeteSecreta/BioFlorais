/**
 * BIO FLORAIS B2B — gravação das linhas comerciais pelo admin.
 * Compartilhado por POST (criar) e PATCH (editar).
 */

import { and, eq, inArray, ne, notInArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bCommercialGroupProducts, b2bCommercialGroups, products } from "@/lib/db/schema";
import { isValidSlug, parseInteger, parseUuidList, slugify } from "@/lib/b2b/admin-input";

export type CommercialGroupInput = {
  name: string;
  slug: string;
  active: boolean;
  b2bVisible: boolean;
  sortOrder: number;
  productIds: string[];
};

export function parseCommercialGroupBody(
  body: Record<string, unknown>
): { ok: true; value: CommercialGroupInput } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim() || slugify(name);
  const sortOrder = parseInteger(body.sortOrder ?? 0, { min: 0, max: 9999 });
  const productIds = parseUuidList(body.productIds);

  if (!name) return { ok: false, error: "Informe o nome da linha." };
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug inválido: use letras minúsculas, números e hífens." };
  }
  if (sortOrder === null) return { ok: false, error: "Ordem inválida (0 a 9999)." };
  if (productIds === null) return { ok: false, error: "Lista de produtos inválida." };

  return {
    ok: true,
    value: {
      name,
      slug,
      active: body.active !== false,
      b2bVisible: body.b2bVisible !== false,
      sortOrder,
      productIds,
    },
  };
}

export async function validateGroupConflicts(input: CommercialGroupInput, groupId?: string) {
  const [slugTaken] = await db
    .select({ id: b2bCommercialGroups.id })
    .from(b2bCommercialGroups)
    .where(
      groupId
        ? and(eq(b2bCommercialGroups.slug, input.slug), ne(b2bCommercialGroups.id, groupId))
        : eq(b2bCommercialGroups.slug, input.slug)
    )
    .limit(1);

  if (slugTaken) {
    return "Já existe uma linha com este slug.";
  }

  if (input.productIds.length > 0) {
    const found = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, input.productIds));

    if (found.length !== input.productIds.length) {
      return "Um ou mais produtos selecionados não existem.";
    }
  }

  return null;
}

/** Deixa a linha com exatamente os produtos informados. */
export async function replaceGroupProducts(groupId: string, productIds: string[]) {
  await db
    .delete(b2bCommercialGroupProducts)
    .where(
      productIds.length > 0
        ? and(
            eq(b2bCommercialGroupProducts.commercialGroupId, groupId),
            notInArray(b2bCommercialGroupProducts.productId, productIds)
          )
        : eq(b2bCommercialGroupProducts.commercialGroupId, groupId)
    );

  if (productIds.length > 0) {
    await db
      .insert(b2bCommercialGroupProducts)
      .values(productIds.map((productId) => ({ commercialGroupId: groupId, productId })))
      .onConflictDoNothing();
  }
}
