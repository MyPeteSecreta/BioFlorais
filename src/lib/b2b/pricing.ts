/**
 * BIO FLORAIS B2B — regras comerciais puras (preço, pedido mínimo,
 * parcelamento, desconto por forma de pagamento, frete).
 *
 * Nenhuma função aqui lê env, banco ou rede: o servidor carrega os
 * dados e chama estas funções (server-authoritative). As mesmas regras
 * valem para os 3 B2B (Secreta, My Pet, Bio); só a tabela de preço
 * muda por marca.
 */

// ---------------------------------------------------------------------------
// Preço unitário B2B
// ---------------------------------------------------------------------------

/**
 * Categorias (products.category) que são floral e recebem preço fixo.
 * Comparação sem acento/caixa, para não depender da grafia exata do
 * banco ("Floral dose única" x "Floral dose unica").
 */
export const B2B_FLORAL_CATEGORIES = [
  "Floral em gotas",
  "Floral dose única",
  "Floral de Ambiente",
  "Snack Floral",
  "Virtudes Divinas",
] as const;

export const B2B_FLORAL_FIXED_PRICE_CENTS = 1990; // R$ 19,90

/**
 * Demais categorias: 55% do preço B2C vigente (products.price_cents),
 * arredondado por roundB2BUnitPriceCents.
 */
export const B2B_DEFAULT_PRICE_PERCENT = 0.55;

function normalizeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

const FLORAL_CATEGORY_KEYS = new Set(
  B2B_FLORAL_CATEGORIES.map(normalizeCategory)
);

export function isB2BFloralCategory(category: string | null | undefined) {
  return Boolean(category) && FLORAL_CATEGORY_KEYS.has(normalizeCategory(category!));
}

/**
 * Arredondamento de PREÇO UNITÁRIO calculado (regra de todos os sites):
 * parte inteira em reais + R$ 0,90. Ex.: 27,00 -> 27,90; 27,50 -> 27,90;
 * 27,95 -> 27,90. Aceita centavos fracionários (resultado do percentual).
 * Nunca usar em totais nem nos descontos Pix/cartão.
 */
export function roundB2BUnitPriceCents(rawCents: number): number {
  const wholeReais = Math.floor(Math.max(0, rawCents) / 100);
  return wholeReais * 100 + 90;
}

export function resolveB2BUnitPriceCents(
  b2cPriceCents: number,
  category: string | null | undefined
): number {
  if (isB2BFloralCategory(category)) {
    return B2B_FLORAL_FIXED_PRICE_CENTS;
  }

  // 55% em aritmética inteira (x * 11 / 20) para evitar erro de float.
  return roundB2BUnitPriceCents((b2cPriceCents * 11) / 20);
}

// ---------------------------------------------------------------------------
// Pedido mínimo
// ---------------------------------------------------------------------------

export const B2B_MIN_ORDER_CENTS = 25_000; // R$ 250,00

export function isB2BOrderAboveMinimum(subtotalCents: number) {
  return subtotalCents >= B2B_MIN_ORDER_CENTS;
}

// ---------------------------------------------------------------------------
// Parcelamento (cartão e boleto): até 3x, parcela mínima R$ 500,00
// ---------------------------------------------------------------------------

export const B2B_MIN_INSTALLMENT_CENTS = 50_000;
export const B2B_MAX_INSTALLMENTS = 3;

export function resolveB2BAllowedInstallments(totalCents: number) {
  return Math.max(
    1,
    Math.min(
      B2B_MAX_INSTALLMENTS,
      Math.floor(totalCents / B2B_MIN_INSTALLMENT_CENTS)
    )
  );
}

export function isB2BInstallmentCountValid(
  totalCents: number,
  installments: number
) {
  return (
    Number.isInteger(installments) &&
    installments >= 1 &&
    installments <= resolveB2BAllowedInstallments(totalCents)
  );
}

/**
 * Composição exata em centavos: parcelas 1..n-1 valem
 * installmentAmountCents; a última absorve o resto do arredondamento.
 * A soma é sempre exatamente totalCents.
 */
export function splitB2BInstallments(totalCents: number, installments: number) {
  const installmentAmountCents = Math.floor(totalCents / installments);
  const lastInstallmentAmountCents =
    totalCents - installmentAmountCents * (installments - 1);

  return { installmentAmountCents, lastInstallmentAmountCents };
}

// ---------------------------------------------------------------------------
// Vencimentos do boleto (igual à My Pet): 28 / 42 / 56 dias da DATA DO
// PEDIDO, no calendário de São Paulo.
// ---------------------------------------------------------------------------

export const B2B_BOLETO_DUE_DAYS = [28, 42, 56] as const;

export type B2BBoletoInstallment = {
  installment: number;
  /** AAAA-MM-DD */
  dueDate: string;
  amountCents: number;
};

function saoPauloCalendarDate(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as { year: number; month: number; day: number };

  return parts;
}

/**
 * Cronograma do boleto: data e valor de cada parcela. A soma dos valores
 * é exatamente totalCents (a última parcela absorve o arredondamento,
 * igual a splitB2BInstallments).
 */
export function buildB2BBoletoSchedule(
  totalCents: number,
  installments: number,
  orderDate: Date
): B2BBoletoInstallment[] {
  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > B2B_BOLETO_DUE_DAYS.length
  ) {
    throw new Error(`Parcelas de boleto inválidas: ${installments}`);
  }

  const { year, month, day } = saoPauloCalendarDate(orderDate);
  const { installmentAmountCents, lastInstallmentAmountCents } = splitB2BInstallments(
    totalCents,
    installments
  );

  return Array.from({ length: installments }, (_, index) => ({
    installment: index + 1,
    dueDate: new Date(Date.UTC(year, month - 1, day + B2B_BOLETO_DUE_DAYS[index]))
      .toISOString()
      .slice(0, 10),
    amountCents: index === installments - 1 ? lastInstallmentAmountCents : installmentAmountCents,
  }));
}

/** "2026-10-29" -> "29/10/2026" (sem passar por fuso). */
export function formatB2BDueDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Desconto por forma de pagamento — SÓ sobre produtos
// ---------------------------------------------------------------------------

/**
 * Pix 7%, cartão 3%, boleto preço cheio. O desconto incide apenas sobre
 * os produtos (subtotal pós-cupom), nunca sobre o frete. O percentual
 * nunca é exibido ao comprador: o checkout mostra só o valor final de
 * cada forma de pagamento.
 */
export const B2B_PAYMENT_METHOD_DISCOUNT_PERCENT = {
  pix: 0.07,
  card: 0.03,
  boleto: 0,
} as const;

export type B2BPaymentMethod = keyof typeof B2B_PAYMENT_METHOD_DISCOUNT_PERCENT;

export const B2B_PAYMENT_METHODS: readonly B2BPaymentMethod[] = [
  "pix",
  "card",
  "boleto",
];

export function isB2BPaymentMethod(value: unknown): value is B2BPaymentMethod {
  return (
    typeof value === "string" &&
    (B2B_PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export function resolveB2BPaymentMethodDiscountCents(
  productsCentsAfterCoupon: number,
  paymentMethod: B2BPaymentMethod
) {
  const percent = B2B_PAYMENT_METHOD_DISCOUNT_PERCENT[paymentMethod];
  return Math.round(Math.max(0, productsCentsAfterCoupon) * percent);
}

/**
 * Total final de UMA forma de pagamento. Única função usada tanto pela
 * cotação exibida no checkout quanto pela criação do pedido.
 */
export function resolveB2BOrderTotalCents(
  productsCentsAfterCoupon: number,
  shippingCents: number,
  paymentMethod: B2BPaymentMethod
) {
  return (
    productsCentsAfterCoupon -
    resolveB2BPaymentMethodDiscountCents(productsCentsAfterCoupon, paymentMethod) +
    shippingCents
  );
}

export function resolveB2BOrderTotalsByPaymentMethod(
  productsCentsAfterCoupon: number,
  shippingCents: number
): Record<B2BPaymentMethod, number> {
  return {
    pix: resolveB2BOrderTotalCents(productsCentsAfterCoupon, shippingCents, "pix"),
    card: resolveB2BOrderTotalCents(productsCentsAfterCoupon, shippingCents, "card"),
    boleto: resolveB2BOrderTotalCents(productsCentsAfterCoupon, shippingCents, "boleto"),
  };
}

// ---------------------------------------------------------------------------
// Frete
// ---------------------------------------------------------------------------

export const B2B_FREIGHT_FLAT_THRESHOLD_CENTS = 45_000; // R$ 450,00

export type B2BRegion = "sul-sudeste" | "co-ne" | "norte-ce";

const UF_TO_REGION: Record<string, B2BRegion> = {
  PR: "sul-sudeste",
  SC: "sul-sudeste",
  RS: "sul-sudeste",
  SP: "sul-sudeste",
  RJ: "sul-sudeste",
  MG: "sul-sudeste",
  ES: "sul-sudeste",

  MT: "co-ne",
  MS: "co-ne",
  GO: "co-ne",
  DF: "co-ne",
  MA: "co-ne",
  PI: "co-ne",
  RN: "co-ne",
  PB: "co-ne",
  PE: "co-ne",
  AL: "co-ne",
  SE: "co-ne",
  BA: "co-ne",

  // CE entra no grupo "Norte + CE" por regra explícita.
  CE: "norte-ce",
  AC: "norte-ce",
  AM: "norte-ce",
  AP: "norte-ce",
  PA: "norte-ce",
  RO: "norte-ce",
  RR: "norte-ce",
  TO: "norte-ce",
};

export const B2B_REGIONAL_FLAT_CENTS: Record<B2BRegion, number> = {
  "sul-sudeste": 990, // R$ 9,90
  "co-ne": 3590, // R$ 35,90
  "norte-ce": 16990, // R$ 169,90
};

export function resolveB2BRegion(state: string): B2BRegion | null {
  return UF_TO_REGION[state.trim().toUpperCase()] ?? null;
}

/** Texto das faixas (aprovado pelo Luis, igual ao da My Pet). */
export const B2B_SPECIAL_FREIGHT_LABEL = "Frete especial na opção econômica · grátis a partir de R$ 450";

/** Sacola: quanto falta para o frete grátis na opção econômica, ou a mensagem de liberado. */
export function b2bFreeFreightProgressText(baseCentsAfterCoupon: number): string {
  const missing = Math.max(0, B2B_FREIGHT_FLAT_THRESHOLD_CENTS - baseCentsAfterCoupon);
  const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  return missing > 0 ? `Faltam ${brl(missing)} para o frete GRÁTIS na opção econômica.` : "Frete GRÁTIS na opção econômica!";
}

/** Depois do CEP, abaixo de R$ 450: "Opção econômica com frete especial: R$ 9,90." (valor da região). null nos demais casos. */
export function b2bEconomyFreightNote(baseCentsAfterCoupon: number, verifiedState: string | null | undefined): string | null {
  if (baseCentsAfterCoupon >= B2B_FREIGHT_FLAT_THRESHOLD_CENTS) return null;

  const region = resolveB2BRegion(String(verifiedState ?? ""));

  if (!region) return null;

  return `Opção econômica com frete especial: R$ ${(B2B_REGIONAL_FLAT_CENTS[region] / 100).toFixed(2).replace(".", ",")}.`;
}

export type B2BShippingOption = {
  serviceName: string;
  etaDays: number;
  /** Valor cobrado do cliente. */
  priceCents: number;
  /** Custo real cotado no Melhor Envio (sempre preservado). */
  realPriceCents: number;
};

/**
 * Regra do Luis (05/11), base = produtos depois da promoção e do cupom (sem frete e sem desconto de pagamento):
 *  - abaixo de R$ 450: a modalidade MAIS BARATA custa Math.min(tarifa regional, preço real)
 *    (R$ 9,90 Sul/Sudeste; R$ 35,90 Centro-Oeste/Nordeste; R$ 169,90 Norte/Ceará);
 *  - a partir de R$ 450: a mais barata é GRÁTIS.
 * As demais mantêm o preço cheio e nenhuma é ocultada. UF não verificada (state vazio ou sem região): todas no preço real.
 * Pedido mínimo (R$ 250) e mostruário não mudam.
 */
export function applyB2BCheapestModalityRule(
  options: readonly { serviceName: string; priceCents: number; etaDays: number }[],
  baseCentsAfterCoupon: number,
  verifiedState: string
): B2BShippingOption[] {
  const base = options.map((option) => ({
    serviceName: option.serviceName,
    etaDays: option.etaDays,
    priceCents: option.priceCents,
    realPriceCents: option.priceCents,
  }));

  if (base.length === 0) {
    return base;
  }

  const region = resolveB2BRegion(verifiedState);

  if (!region) {
    return base;
  }

  let cheapestIndex = 0;
  for (let i = 1; i < base.length; i += 1) {
    if (base[i].realPriceCents < base[cheapestIndex].realPriceCents) {
      cheapestIndex = i;
    }
  }

  const flatCents = baseCentsAfterCoupon >= B2B_FREIGHT_FLAT_THRESHOLD_CENTS ? 0 : B2B_REGIONAL_FLAT_CENTS[region];

  return base.map((option, index) =>
    index === cheapestIndex
      ? { ...option, priceCents: Math.min(flatCents, option.realPriceCents) }
      : option
  );
}

/**
 * CNPJ digitado no campo CPF (14 dígitos, com ou sem pontuação): o checkout passa sozinho para Pessoa jurídica e o boleto
 * volta (aprovado pelo Luis em 09/11; antes, quem digitava o CNPJ em PF perdia o boleto sem entender por quê).
 */
export function cpfFieldHasCnpj(value: string): boolean {
  return value.replace(/\D/g, "").length === 14;
}

export const B2B_SWITCHED_TO_PJ_NOTICE = "Esse número é um CNPJ: mudamos para Pessoa jurídica. O boleto está liberado.";
