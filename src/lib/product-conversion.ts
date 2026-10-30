/**
 * Página de produto (B2C): regras PURAS dos blocos que ajudam a decidir a compra, sem nenhuma promessa de saúde.
 *  - preço no Pix: o desconto real do checkout (B2C_PIX_DISCOUNT_PERCENT); só o valor aparece, nunca o percentual;
 *  - kit "leve N e ganhe frete grátis": a menor quantidade que chega ao mínimo de frete grátis do checkout (R$ 100);
 *  - selos de confiança: só afirmações que o site já sustenta (sem álcool e flores brasileiras só nos florais em gotas das linhas
 *    que já usam essa frase; pagamento seguro; troca e devolução);
 *  - "como usar" curto: a primeira frase do texto editorial.
 */

import { B2C_FREE_SHIPPING_THRESHOLD_CENTS, pixDiscountCents } from "@/lib/checkout/benefits";

export const MAX_KIT_UNITS = 6;

export type PixPrice = { priceCents: number; savingCents: number };

/** Preço no Pix e quanto o cliente economiza (só do produto, nunca do frete). null = sem preço. */
export function pixPrice(priceCents: number | null | undefined): PixPrice | null {
  if (!priceCents || priceCents <= 0) return null;

  const savingCents = pixDiscountCents(priceCents);

  return savingCents > 0 ? { priceCents: priceCents - savingCents, savingCents } : null;
}

export type FreeShippingKit = { qty: number; totalCents: number; eachCents: number };

/** Menor quantidade que passa de R$ 100 (frete grátis). null se uma unidade já chega, se o preço é desconhecido ou se exige mais de 6. */
export function freeShippingKit(priceCents: number | null | undefined, thresholdCents: number = B2C_FREE_SHIPPING_THRESHOLD_CENTS): FreeShippingKit | null {
  if (!priceCents || priceCents <= 0 || priceCents >= thresholdCents) return null;

  const qty = Math.ceil(thresholdCents / priceCents);

  if (qty < 2 || qty > MAX_KIT_UNITS) return null;

  return { qty, totalCents: qty * priceCents, eachCents: priceCents };
}

export type TrustBadge = { key: string; label: string };

const ALCOHOL_FREE_LINES = new Set(["adulto", "pet", "infantil", "baby", "kids", "teen"]);

/** Selos de confiança do produto. Nada de promessa de saúde; "sem álcool" e "flores brasileiras" só onde o site já afirma. */
export function trustBadges(product: { lineSlug: string; category: string }): TrustBadge[] {
  const badges: TrustBadge[] = [];

  if (ALCOHOL_FREE_LINES.has(product.lineSlug) && product.category === "Floral em gotas") {
    badges.push({ key: "sem-alcool", label: "100% sem álcool" }, { key: "flores", label: "Flores brasileiras" });
  } else {
    badges.push({ key: "desde-1997", label: "Bio Florais desde 1997" });
  }

  badges.push({ key: "pagamento", label: "Pagamento seguro" }, { key: "troca", label: "Troca e devolução" });

  return badges;
}

/** Primeira frase do "como usar" (até ~120 caracteres), para mostrar junto da compra. null = sem texto. */
export function shortHowToUse(text: string | null | undefined, max = 120): string | null {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();

  if (!clean) return null;

  const first = clean.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? clean;

  if (first.length <= max) return first;

  return `${first.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
