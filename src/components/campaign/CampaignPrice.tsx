"use client";

/**
 * Preço do B2C com a campanha (Esquenta Black / Black): fora dela, o preço do site como sempre; dentro, o preço do site riscado,
 * o preço da campanha e o rótulo ("Preço Esquenta Black" / "Preço Black"). `withPix` mostra o valor no Pix (4% sobre o preço
 * já com desconto). Nunca usar no B2B.
 */

import { campaignUnitPriceCents } from "@/lib/campaign/esquenta-black";
import { formatBRL } from "@/lib/catalog/bio-products";
import { pixPrice } from "@/lib/product-conversion";

import { useCampaign } from "./useCampaign";

type Props = {
  priceCents: number | null | undefined;
  /** Classe do preço principal (o mesmo visual de antes). */
  className?: string;
  withPix?: boolean;
  testId?: string;
};

export default function CampaignPrice({ priceCents, className = "", withPix = false, testId }: Props) {
  const phase = useCampaign();

  if (!priceCents) return null;

  const price = campaignUnitPriceCents(priceCents, phase);
  const pix = withPix ? pixPrice(price) : null;

  return (
    <>
      {phase && (
        <span className="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="preco-campanha">
          <s className="font-bold text-[#8d7789]">{formatBRL(priceCents)}</s>
          <span className="rounded-full bg-[#2f231f] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">{phase.priceLabel}</span>
        </span>
      )}
      <span className={`block ${className}`} data-testid={testId}>
        {formatBRL(price)}
      </span>
      {pix && (
        <span className="mt-1 block text-base font-extrabold text-[#1f6b3a]" data-testid="preco-pix">
          {formatBRL(pix.priceCents)} no Pix
          <span className="ml-2 text-sm font-bold text-[#4d8a62]">({formatBRL(pix.savingCents)} a menos)</span>
        </span>
      )}
    </>
  );
}

/** Preço compacto (listas, sugestões, barra fixa): riscado pequeno + preço da campanha numa linha. */
export function CampaignPriceInline({ priceCents, className = "" }: { priceCents: number | null | undefined; className?: string }) {
  const phase = useCampaign();

  if (!priceCents) return null;

  const price = campaignUnitPriceCents(priceCents, phase);

  return (
    <span className={className}>
      {phase && <s className="mr-1.5 text-[0.8em] font-bold text-[#8d7789]">{formatBRL(priceCents)}</s>}
      {formatBRL(price)}
    </span>
  );
}
