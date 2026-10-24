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
