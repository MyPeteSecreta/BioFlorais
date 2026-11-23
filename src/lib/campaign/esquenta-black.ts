/**
 * ESQUENTA BLACK e BLACK FRIDAY da Bio (B2C; porte da Secreta 6499185, com as duas fases pedidas pela mestre em 03/11):
 *  - Esquenta: 10% sobre o PREÇO DO SITE de 04/11 00:00 a 26/11 23:59 (São Paulo).
 *  - Black: 25% sobre o preço do site de 27/11 00:00 a 30/11 23:59.
 * Automático (sem cupom). Cupom comercial/de campanha (GPT10, FLORESCE20) SOMA, sobre o preço já com desconto; cupom da
 * criadora (Academia): SOMA com a campanha (23/11), sobre o preço já promocional, no servidor (decideCampaignCoupons). O Pix (4%) continua, sobre o valor já com desconto. Frete: regra normal (base = preço do site). B2B não usa nada daqui.
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
  /** Percentual MAIOR para alguns produtos (pelo começo do slug, que na Bio é a linha). Sem regra: `percent`. */
  overrides?: ReadonlyArray<{ slug: RegExp; percent: number }>;
};

export const CAMPAIGN_PHASES: readonly CampaignPhase[] = [
  {
    key: "esquenta",
    percent: 10,
    priceLabel: "Preço Esquenta Black",
    // Faixa sem o percentual (Luis, 07/11): o desconto aparece no preço riscado do produto.
    strip: "Esquenta Black em tudo até 26/11 · Frete grátis a partir de R$ 70",
    startsAtMs: Date.parse("2026-11-04T00:00:00-03:00"),
    endsAtMs: Date.parse("2026-11-26T23:59:59.999-03:00"),
  },
  {
    key: "black",
    percent: 25,
    priceLabel: "Preço Black",
    // Sem percentual na faixa (Luis, 15/11): só "Black Friday"; o desconto aparece no preço riscado.
    strip: "Black Friday em tudo até 30/11 · Frete grátis a partir de R$ 70",
    // Black por produto (Luis, 15/11): 25% em tudo; linha Virtudes Divinas 35%; Flormed 30% (Flormed Adulto e Baby, 15/11).
    overrides: [
      { slug: /^virtudes-divinas-/, percent: 35 },
      { slug: /(^|-)flormed(-|$)/, percent: 30 },
    ],
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

/** Percentual da campanha para um produto: o da regra do produto (só a Black tem) ou o geral da fase. */
export function campaignPercentFor(phase: Pick<CampaignPhase, "percent" | "overrides">, slug?: string | null): number {
  const rule = slug ? phase.overrides?.find((override) => override.slug.test(slug)) : undefined;

  return rule ? rule.percent : phase.percent;
}

/** Preço de um item na campanha (percentual do produto sobre o preço do site, arredondado ao centavo). Sem campanha: o próprio preço. */
export function campaignUnitPriceCents(sitePriceCents: number, phase: CampaignPhase | null, slug?: string | null): number {
  if (!phase) return sitePriceCents;

  return Math.round((sitePriceCents * (100 - campaignPercentFor(phase, slug))) / 100);
}

/**
 * Kits/combos × campanha (Luis, 15/11, regra da My Pet f215d8d): vale o MAIOR desconto, nunca os dois. O combo só entra na campanha
 * se o % dele for maior que o da campanha em TODOS os produtos dele (empate: campanha). Hoje o único combo é 10% (shampoo +
 * condicionador): na campanha (10% ou mais) ele não soma.
 */
export function offerBeatsCampaign(offerPercent: number, phase: CampaignPhase | null, slugs: readonly string[] = []): boolean {
  if (!phase) return true;

  const campaignPercents = slugs.length ? slugs.map((slug) => campaignPercentFor(phase, slug)) : [phase.percent];

  return campaignPercents.every((percent) => offerPercent > percent);
}

/** Regra de um cupom comercial (a mesma conta de /api/orders/create e de /api/coupons/validate). */
export type CouponRule = { discountType: string; discountValue: number };

/** Desconto de um cupom comercial sobre uma base: percentual arredondado ao centavo ou valor fixo, nunca acima da base. */
export function couponDiscountOn(rule: CouponRule | null | undefined, baseCents: number): number {
  if (!rule) return 0;

  const raw = rule.discountType === "percentage" ? Math.round(baseCents * (rule.discountValue / 100)) : rule.discountValue;

  return Math.max(0, Math.min(baseCents, raw));
}

/** Desconto do cupom da criadora (percentual) sobre uma base (a mesma conta de resolvePartnerCoupon). */
export function partnerDiscountOn(discountPercent: number | null | undefined, baseCents: number): number {
  if (discountPercent === null || discountPercent === undefined) return 0;

  return Math.max(0, Math.min(baseCents, Math.round(baseCents * (discountPercent / 100))));
}

/** Páginas onde a campanha NÃO aparece (o B2B e o admin; /parceiros usa o casco do B2C, mas é a loja do lojista). */
const NOT_B2C = ["/parceiros", "/b2b", "/admin"];

export function isCampaignPath(pathname: string | null | undefined): boolean {
  const path = String(pathname ?? "/");

  return !NOT_B2C.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type CampaignCouponDecision = {
  /** true: os itens vão pelo preço da campanha. */
  campaignApplied: boolean;
  /** Camada de promoção: preço do site − preço da campanha (0 sem campanha). */
  promotionDiscountCents: number;
  offerDiscountCents: number;
  /** Base do cupom comercial (produtos depois das ofertas e da campanha). */
  commercialBaseCents: number;
  commercialCouponCents: number;
  /** Base do cupom da criadora (depois do comercial). Comissão = (esta base − desconto da criadora) × percentual. */
  partnerBaseCents: number;
  partnerCouponCents: number;
  /** Legado: antes a campanha podia vencer o cupom da criadora; desde 23/11 o cupom soma e este campo é sempre false. */
  partnerDiscountOverridden: boolean;
  /** Produtos depois de todos os descontos (antes do Pix; sem frete). */
  merchandiseCents: number;
};

/**
 * Decisão do pedido (servidor; o checkout faz a MESMA conta com a cotação). Regra do Luis (05/11):
 *  - cupom comercial / de campanha (GPT10, FLORESCE20...): SOMA com o Esquenta/Black, sobre o preço já com desconto;
 *  - cupom da criadora (parceira/UGC, Academia): SOMA com o Esquenta/Black (Luis, 23/11): comercial e depois criadora, sempre
 *    sobre o preço já promocional. partnerDiscountOverridden fica sempre false (campo mantido por compatibilidade).
 * site*: subtotal e ofertas pelo preço do site; campaign*: pelo preço da campanha (null = sem campanha).
 */
export function decideCampaignCoupons(input: {
  siteSubtotalCents: number;
  siteOfferDiscountCents: number;
  campaignSubtotalCents: number | null;
  campaignOfferDiscountCents: number | null;
  commercial: CouponRule | null;
  partnerDiscountPercent: number | null;
}): CampaignCouponDecision {
  const siteBaseCents = Math.max(0, input.siteSubtotalCents - input.siteOfferDiscountCents);
  const siteCommercialCents = couponDiscountOn(input.commercial, siteBaseCents);
  const sitePartnerBaseCents = siteBaseCents - siteCommercialCents;
  const sitePartnerCents = partnerDiscountOn(input.partnerDiscountPercent, sitePartnerBaseCents);

  const site: CampaignCouponDecision = {
    campaignApplied: false,
    promotionDiscountCents: 0,
    offerDiscountCents: input.siteOfferDiscountCents,
    commercialBaseCents: siteBaseCents,
    commercialCouponCents: siteCommercialCents,
    partnerBaseCents: sitePartnerBaseCents,
    partnerCouponCents: sitePartnerCents,
    partnerDiscountOverridden: false,
    merchandiseCents: sitePartnerBaseCents - sitePartnerCents,
  };

  if (input.campaignSubtotalCents === null || input.campaignOfferDiscountCents === null) return site;

  const campaignOfferDiscountCents = input.campaignOfferDiscountCents;
  const campaignBaseCents = Math.max(0, input.campaignSubtotalCents - campaignOfferDiscountCents);
  const campaignCommercialCents = couponDiscountOn(input.commercial, campaignBaseCents);
  const campaignPartnerBaseCents = campaignBaseCents - campaignCommercialCents;

  // Cupom da criadora (Academia) SOMA com a campanha (Luis, 23/11): percentual sobre o preço já promocional (depois do comercial).
  const campaignPartnerCents = partnerDiscountOn(input.partnerDiscountPercent, campaignPartnerBaseCents);

  return {
    campaignApplied: true,
    promotionDiscountCents: input.siteSubtotalCents - input.campaignSubtotalCents,
    offerDiscountCents: campaignOfferDiscountCents,
    commercialBaseCents: campaignBaseCents,
    commercialCouponCents: campaignCommercialCents,
    partnerBaseCents: campaignPartnerBaseCents,
    partnerCouponCents: campaignPartnerCents,
    partnerDiscountOverridden: false,
    merchandiseCents: campaignPartnerBaseCents - campaignPartnerCents,
  };
}
