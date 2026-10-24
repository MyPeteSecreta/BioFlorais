/**
 * Faixa de benefícios do checkout (B2C e B2B). Funções puras, sem dependência do site: a Secreta e a My Pet copiam este
 * arquivo e o componente `CheckoutBenefitsBar` e só trocam a configuração passada em `buildCheckoutBenefits`.
 * Regra: só aparece o que existe de verdade na configuração daquele checkout (nada de cupom específico, nada inventado).
 */

const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** Configuração real do B2C: frete grátis (modalidade econômica) a partir de R$ 100; abaixo disso o frete tem subsídio de 25%. */
export const B2C_FREE_SHIPPING_THRESHOLD_CENTS = 10_000;
export const B2C_SHIPPING_SUBSIDY_PERCENT = 25;

export type CheckoutBenefitIcon = "frete" | "pix" | "cartao";

export type CheckoutBenefit = {
  key: string;
  icon: CheckoutBenefitIcon;
  /** "good" = benefício ativo; "progress" = falta pouco para um benefício. */
  tone: "good" | "progress";
  label: string;
  detail?: string;
};

export type CheckoutBenefitsInput =
  | {
      kind: "b2c";
      /** Valor dos produtos (base da regra de frete do checkout). */
      subtotalCents: number;
      freeShippingThresholdCents: number;
      shippingSubsidyPercent: number;
      /** Descontos por forma de pagamento configurados neste checkout (percentual > 0). O B2C da Bio não tem. */
      paymentDiscountPercent?: { pix?: number; card?: number };
    }
  | {
      kind: "b2b";
      /** Valor dos produtos depois do cupom (base da regra de frete especial). */
      subtotalCents: number;
      specialFreightThresholdCents: number;
      paymentDiscountPercent?: { pix?: number; card?: number };
    };

export function buildCheckoutBenefits(input: CheckoutBenefitsInput): CheckoutBenefit[] {
  const out: CheckoutBenefit[] = [];

  if (input.subtotalCents <= 0) return out;

  if (input.kind === "b2c") {
    const remaining = Math.max(0, input.freeShippingThresholdCents - input.subtotalCents);

    if (remaining === 0) {
      out.push({ key: "frete", icon: "frete", tone: "good", label: "Frete grátis", detail: "na modalidade mais econômica" });
    } else {
      if (input.shippingSubsidyPercent > 0) {
        out.push({ key: "frete", icon: "frete", tone: "good", label: "Frete com desconto", detail: `subsídio de ${input.shippingSubsidyPercent}%` });
      }
      out.push({ key: "falta-frete", icon: "frete", tone: "progress", label: `Faltam ${formatBRL(remaining)} para o frete grátis` });
    }
  } else {
    // B2B nunca fala em "frete grátis": é frete especial.
    const remaining = Math.max(0, input.specialFreightThresholdCents - input.subtotalCents);

    if (remaining === 0) {
      out.push({ key: "frete", icon: "frete", tone: "good", label: "Frete especial", detail: "na modalidade mais econômica" });
    } else {
      out.push({ key: "falta-frete", icon: "frete", tone: "progress", label: `Faltam ${formatBRL(remaining)} para o frete especial` });
    }
  }

  // O percentual não é mostrado ao comprador (regra do B2B): só o fato de haver desconto.
  if ((input.paymentDiscountPercent?.pix ?? 0) > 0) out.push({ key: "pix", icon: "pix", tone: "good", label: "Pix com desconto" });
  if ((input.paymentDiscountPercent?.card ?? 0) > 0) out.push({ key: "cartao", icon: "cartao", tone: "good", label: "Cartão com desconto" });

  return out;
}

/** Pix com desconto no B2C (Bio): 4% sobre os produtos, depois dos cupons; nunca sobre o frete. O percentual não é mostrado ao comprador. */
export const B2C_PIX_DISCOUNT_PERCENT = 4;

/** Desconto do Pix em centavos (arredonda ao centavo). `baseCents` = produtos já com todos os descontos, sem frete. */
export function pixDiscountCents(baseCents: number, percent: number = B2C_PIX_DISCOUNT_PERCENT): number {
  return Math.max(0, Math.round((Math.max(0, baseCents) * percent) / 100));
}

/**
 * Faixa do TOPO do checkout (texto fixo, da configuração real; sem cupom específico).
 *  B2C: "Frete grátis a partir de R$ 100 (abaixo disso, frete subsidiado) · Desconto no Pix" (sem cartão)
 *  B2B: "Frete especial a partir de R$ 450 · Desconto no Pix · Desconto no cartão" (nunca "frete grátis")
 */
export function buildCheckoutTopStrip(input: {
  kind: "b2c" | "b2b";
  freeShippingThresholdCents?: number;
  shippingSubsidyPercent?: number;
  specialFreightThresholdCents?: number;
  paymentDiscountPercent?: { pix?: number; card?: number };
}): string[] {
  const parts: string[] = [];
  const brlWhole = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`;

  if (input.kind === "b2c") {
    if ((input.freeShippingThresholdCents ?? 0) > 0) {
      parts.push(
        `Frete grátis a partir de ${brlWhole(input.freeShippingThresholdCents!)}${(input.shippingSubsidyPercent ?? 0) > 0 ? " (abaixo disso, frete subsidiado)" : ""}`
      );
    }
  } else if ((input.specialFreightThresholdCents ?? 0) > 0) {
    parts.push(`Frete especial a partir de ${brlWhole(input.specialFreightThresholdCents!)}`);
  }

  if ((input.paymentDiscountPercent?.pix ?? 0) > 0) parts.push("Desconto no Pix");
  if ((input.paymentDiscountPercent?.card ?? 0) > 0) parts.push("Desconto no cartão");

  return parts;
}
