/**
 * ESQUENTA BLACK e BLACK FRIDAY da Bio (B2C; porte da Secreta 6499185, com as duas fases pedidas pela mestre em 03/11):
 *  - Esquenta: 10% sobre o PREÇO DO SITE de 04/11 00:00 a 26/11 23:59 (São Paulo).
 *  - Black: 25% sobre o preço do site de 27/11 00:00 a 30/11 23:59.
 * Automático (sem cupom). Cupom (GPT10, parceira e outros) NÃO soma: vale o MAIOR desconto entre a campanha e o cupom; no empate,
 * a campanha. O Pix (4%) continua, sobre o valor já com desconto. Frete: regra normal (base = preço do site). B2B não usa nada daqui.
 *
 * Funções puras (a hora entra por parâmetro): tela, sacola, cotação, pedido e testes usam as mesmas.
 */

export type CampaignPhase = {
  key: "esquenta" | "black";
  percent: number;
  /** Rótulo ao lado do preço. */
  priceLabel: string;
  /** Faixa do topo. */
  strip: string;
  startsAtMs: number;
  endsAtMs: number;
};

export const CAMPAIGN_PHASES: readonly CampaignPhase[] = [
  {
    key: "esquenta",
    percent: 10,
    priceLabel: "Preço Esquenta Black",
    strip: "Esquenta Black: 10% em tudo até 26/11",
    startsAtMs: Date.parse("2026-11-04T00:00:00-03:00"),
    endsAtMs: Date.parse("2026-11-26T23:59:59.999-03:00"),
  },
  {
    key: "black",
    percent: 25,
    priceLabel: "Preço Black",
    strip: "Black Friday: 25% em tudo até 30/11",
    startsAtMs: Date.parse("2026-11-27T00:00:00-03:00"),
    endsAtMs: Date.parse("2026-11-30T23:59:59.999-03:00"),
  },
];

export function activeCampaign(nowMs: number = Date.now(), phases: readonly CampaignPhase[] = CAMPAIGN_PHASES): CampaignPhase | null {
  return phases.find((phase) => nowMs >= phase.startsAtMs && nowMs <= phase.endsAtMs) ?? null;
}

/** Fase para os feeds: a que está valendo ou, antes dela, a próxima (o Google e a Meta trocam o preço sozinhos na data de início). */
export function feedCampaignPhase(nowMs: number = Date.now(), phases: readonly CampaignPhase[] = CAMPAIGN_PHASES): CampaignPhase | null {
  return activeCampaign(nowMs, phases) ?? phases.find((phase) => phase.startsAtMs > nowMs) ?? null;
}

/** Vigência no formato dos feeds (ISO 8601, horário de São Paulo): "2026-11-04T00:00-0300/2026-11-26T23:59-0300". */
export function saleEffectiveDate(phase: CampaignPhase): string {
  const sp = (ms: number) => {
    const d = new Date(ms - 3 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");

    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}-0300`;
  };

  return `${sp(phase.startsAtMs)}/${sp(phase.endsAtMs)}`;
}

/** Preço de um item na campanha (percentual sobre o preço do site, arredondado ao centavo). Sem campanha: o próprio preço. */
export function campaignUnitPriceCents(sitePriceCents: number, phase: CampaignPhase | null): number {
  if (!phase) return sitePriceCents;

  return Math.round((sitePriceCents * (100 - phase.percent)) / 100);
}

/**
 * Cupom × campanha: o cliente fica com o MAIOR desconto. `campaignSavingsCents` = quanto a campanha tira dos produtos;
 * `couponsCents` = cupom comercial + cupom da parceira calculados sobre o preço do site. Empate: campanha (o cupom não é gasto).
 */
export function couponBeatsCampaign(campaignSavingsCents: number, couponsCents: number): boolean {
  return couponsCents > campaignSavingsCents;
}

/** Páginas onde a campanha NÃO aparece (o B2B e o admin; /parceiros usa o casco do B2C, mas é a loja do lojista). */
const NOT_B2C = ["/parceiros", "/b2b", "/admin"];

export function isCampaignPath(pathname: string | null | undefined): boolean {
  const path = String(pathname ?? "/");

  return !NOT_B2C.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Decisão do pedido (servidor; o checkout faz a mesma conta com a cotação): campanha ou cupom, o que der MAIS desconto.
 *  - site*: subtotal e ofertas pelo preço do site; campaign*: subtotal e ofertas pelo preço da campanha;
 *  - couponsCents: cupom comercial + parceira calculados sobre o preço do site.
 */
export function decideCampaign(input: {
  siteSubtotalCents: number;
  siteOfferDiscountCents: number;
  campaignSubtotalCents: number;
  campaignOfferDiscountCents: number;
  couponsCents: number;
}): { campaignApplied: boolean; promotionDiscountCents: number; offerDiscountCents: number; campaignSavingsCents: number } {
  const promotionDiscountCents = input.siteSubtotalCents - input.campaignSubtotalCents;
  const campaignSavingsCents = promotionDiscountCents + input.campaignOfferDiscountCents - input.siteOfferDiscountCents;

  if (couponBeatsCampaign(campaignSavingsCents, input.couponsCents)) {
    return { campaignApplied: false, promotionDiscountCents: 0, offerDiscountCents: input.siteOfferDiscountCents, campaignSavingsCents };
  }

  return { campaignApplied: true, promotionDiscountCents, offerDiscountCents: input.campaignOfferDiscountCents, campaignSavingsCents };
}
