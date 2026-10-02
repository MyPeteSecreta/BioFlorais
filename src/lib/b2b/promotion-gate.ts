/**
 * BIO FLORAIS B2B — "porteiro" das promoções de uma oferta (Rodada 2):
 * para cada promoção da oferta, se ainda está DISPONÍVEL para o cliente
 * (abertura/reconquista x recorrente, R1) e quantos usos já foram gastos
 * (contador dinâmico, R5). O servidor usa isto no link, na cotação e na
 * criação do pedido: nunca confia na tela.
 *
 * A abertura é avaliada pelo histórico do CLIENTE ignorando os pedidos da
 * própria oferta (a compra feita por ela não a invalida; vendedor novo, com
 * oferta nova, é bloqueado se o cliente está na fase de preço normal, R3).
 */

import { getAppSqlRunner, type SqlRunner } from "@/lib/b2b/ownership";
import {
  buildHistory,
  loadClientPurchases,
  loadPromotionUses,
  loadReconquistaMonths,
  promotionAvailability,
  type PromotionType,
} from "@/lib/b2b/purchase-history";

export type PromotionGateEntry = {
  available: boolean;
  reason: string;
  promoType: PromotionType;
  /** Usos já gastos: pedidos que a bonificaram e contam como compra ou reservam. */
  used: number;
};

export type PromotionGate = Map<string, PromotionGateEntry>;

export async function loadOfferPromotionGate(
  offerId: string,
  clientId: string,
  now = new Date(),
  run: SqlRunner = getAppSqlRunner()
): Promise<PromotionGate> {
  try {
    const rows = await run(
      `SELECT op.promotion_id, op.commercial_group_id, p.promo_type,
              coalesce((SELECT json_agg(pg.commercial_group_id) FROM b2b_promotion_commercial_groups pg
                         WHERE pg.promotion_id = p.id), '[]'::json) AS promo_groups
         FROM b2b_offer_promotions op
         JOIN b2b_promotions p ON p.id = op.promotion_id
        WHERE op.offer_id = $1`,
      [offerId]
    );

    if (rows.length === 0) return new Map();

    const [purchases, months, uses] = await Promise.all([
      loadClientPurchases(run, clientId, offerId),
      loadReconquistaMonths(run),
      loadPromotionUses(run, offerId),
    ]);

    const gate: PromotionGate = new Map();

    for (const row of rows) {
      const promoType: PromotionType = row.promo_type === "recorrente" ? "recorrente" : "abertura_reconquista";
      const lineGroups = row.commercial_group_id
        ? [String(row.commercial_group_id)]
        : ((row.promo_groups as string[] | null) ?? []).map(String);
      const dates = purchases
        .filter((purchase) => lineGroups.length === 0 || lineGroups.includes(purchase.groupId))
        .map((purchase) => purchase.at);
      const availability = promotionAvailability(promoType, buildHistory(dates, now, months));

      gate.set(String(row.promotion_id), {
        ...availability,
        promoType,
        used: uses.get(String(row.promotion_id)) ?? 0,
      });
    }

    return gate;
  } catch (error) {
    // SQL 14b ainda não aplicado (promo_type ausente): sem porteiro; o resolvedor segue só com datas/limites.
    console.error("[b2b/promotion-gate] indisponível", error);
    return new Map();
  }
}
