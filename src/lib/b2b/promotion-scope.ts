/**
 * BIO FLORAIS B2B — alcance de uma promoção por LINHA (C4, Rodada 3).
 *
 * O aviso/opção de uma promoção só existe nas linhas a que ela se aplica:
 *  - promoção com PRODUTOS explícitos (SKU): aparece só na linha que contém
 *    algum desses produtos (e, se o admin também ligou linhas, só nelas), e
 *    "somente <produto>" lista apenas os produtos DAQUELA linha;
 *  - promoção com LINHAS ligadas: só nelas;
 *  - promoção sem produtos nem linhas: vale para qualquer linha (o vendedor a
 *    escolhe por linha; o servidor limita ao produto da linha escolhida).
 * Pura, testada em scripts/b2b-promotion-admin.test.mjs.
 */

export type PromotionScopeInput = {
  /** Linhas ligadas à promoção no admin (vazio = nenhuma ligação). */
  linkedGroupIds: string[];
  /** Produtos explícitos da promoção (vazio = linha inteira). */
  productIds: string[];
};

export type GroupMembership = Map<string, Set<string>>; // groupId -> productIds

/** A promoção se aplica a esta linha? E, se pontual, a quais produtos dela? */
export function promotionScopeForGroup(
  promotion: PromotionScopeInput,
  groupId: string,
  membership: GroupMembership
): { applies: boolean; onlyProductIds: string[] } {
  const linked = promotion.linkedGroupIds;
  const inLinkedGroups = linked.length === 0 || linked.includes(groupId);

  if (promotion.productIds.length > 0) {
    const members = membership.get(groupId) ?? new Set<string>();
    const onlyProductIds = promotion.productIds.filter((productId) => members.has(productId));

    return { applies: inLinkedGroups && onlyProductIds.length > 0, onlyProductIds };
  }

  return { applies: inLinkedGroups, onlyProductIds: [] };
}
