/**
 * BIO FLORAIS B2B — dados e validação do Offer Builder.
 *
 * Linhas = grupos comerciais ativos e visíveis no B2B, com a arte real
 * da Home. Promoções de cada linha = ativas, selecionáveis pelo vendedor,
 * do tipo com efeito no servidor, dentro da vigência e vinculadas à
 * linha. Promoção com produtos explícitos é PONTUAL (ex.: Baby Sono): o
 * card e o modal dizem "somente <produto>".
 */

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bCommercialGroups,
  b2bPromotionCommercialGroups,
  b2bPromotionProducts,
  b2bPromotions,
  products,
} from "@/lib/db/schema";
import { homeLineImage } from "@/lib/b2b/line-images";
import { B2B_PERCENT_PROMOTION_TYPE, isB2BPromotionComplete } from "@/lib/b2b/promotion-resolver";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import {
  historyForGroup,
  loadClientPurchases,
  loadReconquistaMonths,
  promotionAvailability,
  type PromotionType,
} from "@/lib/b2b/purchase-history";

export type BuilderPromotion = {
  id: string;
  name: string;
  buyQuantity: number;
  freeQuantity: number;
  /** C3: percentual da promoção "X% de desconto" (null = bonificação X+Y). */
  percent: number | null;
  /** abertura_reconquista | recorrente (Rodada 2). */
  promoType: PromotionType;
  /** Para o cliente em questão: disponível? (sem cliente = sempre disponível) */
  available: boolean;
  /** Motivo mostrado ao vendedor ("Disponível: cliente nunca comprou esta linha", "Indisponível: ..."). */
  reason: string;
  /** Produtos da promoção pontual; vazio = linha inteira. */
  onlyProducts: Array<{ id: string; name: string }>;
};

export type BuilderLine = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  promotions: BuilderPromotion[];
};

/**
 * Dado de teste que vazou para produção ("BIO-B2B TEST GROUP <hex>") nunca
 * vira card, mesmo que esteja ativo no banco. O SQL 08b o desativa de vez.
 */
export function isTestCommercialGroup(group: { slug: string; name: string }) {
  return /^\s*bio-b2b[\s-]*test/i.test(group.name) || /^bio-b2b-test/i.test(group.slug);
}

/**
 * `clientId`: avalia, para ESSE cliente, quais promoções estão disponíveis
 * (abertura/reconquista só para quem nunca comprou a linha ou está há mais
 * de N meses sem comprar; recorrente vale para todos). O servidor repete a
 * checagem no rascunho, na ativação, no link e no pedido.
 */
export async function loadBuilderLines(
  now = new Date(),
  clientId?: string | null,
  /** Oferta já ativa: os pedidos dela não invalidam a própria abertura. */
  excludeOfferId?: string | null
): Promise<BuilderLine[]> {
  const groups = (
    await db
      .select({ id: b2bCommercialGroups.id, slug: b2bCommercialGroups.slug, name: b2bCommercialGroups.name })
      .from(b2bCommercialGroups)
      .where(and(eq(b2bCommercialGroups.active, true), eq(b2bCommercialGroups.b2bVisible, true)))
      .orderBy(asc(b2bCommercialGroups.sortOrder), asc(b2bCommercialGroups.name))
  ).filter((group) => !isTestCommercialGroup(group));

  if (groups.length === 0) return [];

  const links = await db
    .select({
      groupId: b2bPromotionCommercialGroups.commercialGroupId,
      id: b2bPromotions.id,
      name: b2bPromotions.name,
      type: b2bPromotions.type,
      active: b2bPromotions.active,
      sellerSelectable: b2bPromotions.sellerSelectable,
      startsAt: b2bPromotions.startsAt,
      endsAt: b2bPromotions.endsAt,
      buyQuantity: b2bPromotions.buyQuantity,
      freeQuantity: b2bPromotions.freeQuantity,
      percentage: b2bPromotions.percentage,
      promoType: b2bPromotions.promoType,
    })
    .from(b2bPromotionCommercialGroups)
    .innerJoin(b2bPromotions, eq(b2bPromotions.id, b2bPromotionCommercialGroups.promotionId))
    .where(inArray(b2bPromotionCommercialGroups.commercialGroupId, groups.map((group) => group.id)))
    .orderBy(asc(b2bPromotions.freeQuantity), asc(b2bPromotions.name));

  const usable = links.filter(
    (row) =>
      isB2BPromotionComplete(row) &&
      row.active &&
      row.sellerSelectable &&
      !(row.startsAt && now < row.startsAt) &&
      !(row.endsAt && now > row.endsAt)
  );

  const promotionIds = Array.from(new Set(usable.map((row) => row.id)));

  const run = getAppSqlRunner();
  const [purchases, months] = clientId
    ? await Promise.all([loadClientPurchases(run, clientId, excludeOfferId), loadReconquistaMonths(run)])
    : [[], 6];

  const productRows = promotionIds.length
    ? await db
        .select({
          promotionId: b2bPromotionProducts.promotionId,
          id: products.id,
          name: products.name,
        })
        .from(b2bPromotionProducts)
        .innerJoin(products, eq(products.id, b2bPromotionProducts.productId))
        .where(inArray(b2bPromotionProducts.promotionId, promotionIds))
    : [];

  return groups.map((group) => ({
    id: group.id,
    slug: group.slug,
    name: group.name,
    image: homeLineImage(group.slug),
    promotions: usable
      .filter((row) => row.groupId === group.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        buyQuantity: row.buyQuantity ?? 0,
        freeQuantity: row.freeQuantity ?? 0,
        percent: row.type === B2B_PERCENT_PROMOTION_TYPE ? Number(row.percentage) : null,
        ...(() => {
          const promoType: PromotionType = row.promoType === "recorrente" ? "recorrente" : "abertura_reconquista";
          if (!clientId) return { promoType, available: true, reason: "" };
          return { promoType, ...promotionAvailability(promoType, historyForGroup(purchases, group.id, now, months)) };
        })(),
        onlyProducts: productRows
          .filter((product) => product.promotionId === row.id)
          .map((product) => ({ id: product.id, name: product.name })),
      })),
  }));
}
