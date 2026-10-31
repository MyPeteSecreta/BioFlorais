/**
 * Frete do B2C (Bio): regra única, usada pelo servidor (cria o pedido e cobra) e pelo checkout (mostra o mesmo valor).
 *
 *  - a partir de R$ 70 em produtos: a modalidade mais barata é grátis; as demais ganham 50% do valor cheio da mais barata de desconto;
 *  - abaixo de R$ 70: o cliente paga 65% da cotação (subsídio de 35%), e a modalidade MAIS BARATA nunca passa do TETO do estado
 *    (R$ 9,90 ou R$ 15,90), que é o mesmo valor publicado no Google Merchant: o site nunca cobra mais que o teto.
 * As modalidades mais rápidas (SEDEX etc.) são opcionais e seguem a conta de 65%, sem o teto, mas nunca custam menos que a mais barata.
 */

import {
  B2C_FREE_SHIPPING_THRESHOLD_CENTS,
  B2C_SHIPPING_CAP_HIGH_CENTS,
  B2C_SHIPPING_CAP_LOW_CENTS,
  B2C_SHIPPING_HIGH_CAP_STATES,
  B2C_SHIPPING_SUBSIDY_PERCENT,
} from "@/lib/checkout/benefits";

/** Faixas de CEP dos Correios por UF (prefixo de 5 dígitos). */
const CEP_RANGES: ReadonlyArray<readonly [number, number, string]> = [
  [1000, 19999, "SP"],
  [20000, 28999, "RJ"],
  [29000, 29999, "ES"],
  [30000, 39999, "MG"],
  [40000, 48999, "BA"],
  [49000, 49999, "SE"],
  [50000, 56999, "PE"],
  [57000, 57999, "AL"],
  [58000, 58999, "PB"],
  [59000, 59999, "RN"],
  [60000, 63999, "CE"],
  [64000, 64999, "PI"],
  [65000, 65999, "MA"],
  [66000, 68899, "PA"],
  [68900, 68999, "AP"],
  [69000, 69299, "AM"],
  [69300, 69399, "RR"],
  [69400, 69899, "AM"],
  [69900, 69999, "AC"],
  [70000, 72799, "DF"],
  [72800, 72999, "GO"],
  [73000, 73699, "DF"],
  [73700, 76799, "GO"],
  [76800, 76999, "RO"],
  [77000, 77999, "TO"],
  [78000, 78899, "MT"],
  [78900, 78999, "RO"],
  [79000, 79999, "MS"],
  [80000, 87999, "PR"],
  [88000, 89999, "SC"],
  [90000, 99999, "RS"],
];

/** UF do CEP (8 dígitos), pelas faixas dos Correios. null = CEP inválido. */
export function ufFromCep(cep: string | null | undefined): string | null {
  const digits = String(cep ?? "").replace(/\D/g, "");

  if (digits.length !== 8) return null;

  const prefix = Number(digits.slice(0, 5));

  return CEP_RANGES.find(([from, to]) => prefix >= from && prefix <= to)?.[2] ?? null;
}

/** Teto do frete mais barato para a UF. UF desconhecida ou fora da lista alta: teto menor (nunca cobra mais que o publicado). */
export function b2cShippingCapCents(uf: string | null | undefined): number {
  const state = String(uf ?? "").trim().toUpperCase();

  return B2C_SHIPPING_HIGH_CAP_STATES.includes(state) ? B2C_SHIPPING_CAP_HIGH_CENTS : B2C_SHIPPING_CAP_LOW_CENTS;
}

export type B2CShippingInput = {
  /** Valor dos produtos (a mesma base de antes: mercadoria antes dos cupons no servidor). */
  subtotalCents: number;
  /** Cotação cheia da modalidade escolhida. */
  optionCostCents: number;
  /** Cotação cheia da modalidade mais barata. */
  cheapestCostCents: number;
  /** UF de entrega (do CEP). */
  uf: string | null | undefined;
};

export type B2CShipping = {
  /** O que o cliente paga. */
  customerCents: number;
  /** Quanto a loja abate da cotação cheia (subsídio ou frete grátis). */
  benefitCents: number;
  /** Frete grátis (modalidade mais barata, a partir de R$ 70). */
  free: boolean;
  /** O teto do estado foi o que limitou o valor. */
  capped: boolean;
};

/** Parte do cliente na modalidade mais barata ABAIXO do limite: 65% da cotação, nunca acima do teto do estado. */
export function cheapestCustomerCents(cheapestCostCents: number, uf: string | null | undefined): { cents: number; capped: boolean } {
  const subsidized = Math.max(0, Math.round((cheapestCostCents * (100 - B2C_SHIPPING_SUBSIDY_PERCENT)) / 100));
  const cap = b2cShippingCapCents(uf);

  return subsidized > cap ? { cents: cap, capped: true } : { cents: subsidized, capped: false };
}

export function computeB2CShipping(input: B2CShippingInput): B2CShipping {
  const cost = Math.max(0, Math.round(input.optionCostCents));
  const cheapest = Math.max(0, Math.round(input.cheapestCostCents));
  const isCheapest = cost <= cheapest;

  if (input.subtotalCents >= B2C_FREE_SHIPPING_THRESHOLD_CENTS) {
    if (isCheapest) return { customerCents: 0, benefitCents: cost, free: true, capped: false };

    const benefit = Math.round(cheapest * 0.5);

    return { customerCents: Math.max(0, cost - benefit), benefitCents: Math.min(cost, benefit), free: false, capped: false };
  }

  const base = cheapestCustomerCents(cheapest, input.uf);

  if (isCheapest) return { customerCents: base.cents, benefitCents: Math.max(0, cost - base.cents), free: false, capped: base.capped };

  // Modalidade mais rápida: 65% da própria cotação, mas nunca menos que a mais barata.
  const own = Math.round((cost * (100 - B2C_SHIPPING_SUBSIDY_PERCENT)) / 100);
  const customer = Math.max(base.cents, own);

  return { customerCents: customer, benefitCents: Math.max(0, cost - customer), free: false, capped: false };
}
