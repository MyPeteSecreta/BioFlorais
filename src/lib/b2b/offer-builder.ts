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
  b2bCommercialGroupProducts,
  b2bCommercialGroups,
  b2bPromotionCommercialGroups,
  b2bPromotionProducts,
  b2bPromotions,
  products,
} from "@/lib/db/schema";
import { homeLineImage } from "@/lib/b2b/line-images";
import { isTestCommercialGroup } from "@/lib/b2b/test-groups";
import { promotionScopeForGroup, type GroupMembership } from "@/lib/b2b/promotion-scope";
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

export { isTestCommercialGroup };

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

  // Todas as promoções ativas e selecionáveis (C1/C4): o alcance por linha vem de
  // promotion-scope.ts (linhas ligadas e/ou produtos explícitos), não só do vínculo com a linha.
  const candidates = await db
    .select({
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
    .from(b2bPromotions)
    .orderBy(asc(b2bPromotions.freeQuantity), asc(b2bPromotions.name));

  const usable = candidates.filter(
    (row) =>
      isB2BPromotionComplete(row) &&
      row.active &&
      row.sellerSelectable &&
      !(row.startsAt && now < row.startsAt) &&
      !(row.endsAt && now > row.endsAt)
  );

  const promotionIds = usable.map((row) => row.id);

  const [groupLinkRows, productRows] = promotionIds.length
    ? await Promise.all([
        db
          .select({
            promotionId: b2bPromotionCommercialGroups.promotionId,
            groupId: b2bPromotionCommercialGroups.commercialGroupId,
          })
          .from(b2bPromotionCommercialGroups)
          .where(inArray(b2bPromotionCommercialGroups.promotionId, promotionIds)),
        db
          .select({
            promotionId: b2bPromotionProducts.promotionId,
            id: products.id,
            name: products.name,
          })
          .from(b2bPromotionProducts)
          .innerJoin(products, eq(products.id, b2bPromotionProducts.productId))
          .where(inArray(b2bPromotionProducts.promotionId, promotionIds)),
      ])
    : [[], []];

  const explicitProductIds = Array.from(new Set(productRows.map((row) => row.id)));
  const membershipRows = explicitProductIds.length
    ? await db
        .select({
          groupId: b2bCommercialGroupProducts.commercialGroupId,
          productId: b2bCommercialGroupProducts.productId,
        })
        .from(b2bCommercialGroupProducts)
        .where(inArray(b2bCommercialGroupProducts.productId, explicitProductIds))
    : [];

  const membership: GroupMembership = new Map();
  for (const row of membershipRows) {
    const set = membership.get(row.groupId) ?? new Set<string>();
    set.add(row.productId);
    membership.set(row.groupId, set);
  }

  const run = getAppSqlRunner();
  const [purchases, months] = clientId
    ? await Promise.all([loadClientPurchases(run, clientId, excludeOfferId), loadReconquistaMonths(run)])
    : [[], 6];

  return groups.map((group) => ({
    id: group.id,
    slug: group.slug,
    name: group.name,
    image: homeLineImage(group.slug),
    promotions: usable
      .map((row) => ({
        row,
        scope: promotionScopeForGroup(
          {
            linkedGroupIds: groupLinkRows.filter((link) => link.promotionId === row.id).map((link) => link.groupId),
            productIds: productRows.filter((product) => product.promotionId === row.id).map((product) => product.id),
          },
          group.id,
          membership
        ),
      }))
      .filter((item) => item.scope.applies)
      .map(({ row, scope }) => ({
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
        // Só os produtos DESTA linha (C4): o aviso "somente X" não vaza para outras linhas.
        onlyProducts: productRows
          .filter((product) => product.promotionId === row.id && scope.onlyProductIds.includes(product.id))
          .map((product) => ({ id: product.id, name: product.name })),
      })),
  }));
}
