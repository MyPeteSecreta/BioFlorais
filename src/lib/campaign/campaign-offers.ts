/**
 * Combos/kits × Esquenta/Black (Luis, 15/11): vale o MAIOR desconto, nunca os dois (offerBeatsCampaign). Usado pela cotação da sacola e
 * pelo pedido, com o mesmo cálculo. Fora da campanha, os combos valem como sempre.
 */

import { offerBeatsCampaign, type CampaignPhase } from "@/lib/campaign/esquenta-black";
import { bioOffers, type SelectedOfferInput } from "@/lib/commerce/offers";

export function campaignSelectedOffers(selected: SelectedOfferInput[], phase: CampaignPhase | null): SelectedOfferInput[] {
  if (!phase) return selected;

  return selected.filter((offer) => {
    const definition = (bioOffers as Record<string, { discountPercent: number } | undefined>)[offer.code];

    return definition ? offerBeatsCampaign(definition.discountPercent, phase, offer.productSlugs ?? []) : false;
  });
}
