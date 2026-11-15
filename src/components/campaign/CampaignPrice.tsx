"use client";

/**
 * Preço do B2C com a campanha (Esquenta Black / Black): fora dela, o preço do site como sempre; dentro, o preço do site riscado,
 * o preço da campanha e o rótulo ("Preço Esquenta Black" / "Preço Black"). `withPix` mostra o valor no Pix (4% sobre o preço
 * já com desconto). Nunca usar no B2B.
 */

import { campaignUnitPriceCents, offerBeatsCampaign } from "@/lib/campaign/esquenta-black";
import { formatBRL } from "@/lib/format-brl";
import { pixPrice } from "@/lib/product-conversion";

import { useCampaign } from "./useCampaign";

type Props = {
  priceCents: number | null | undefined;
  /** Classe do preço principal (o mesmo visual de antes). */
  className?: string;
  withPix?: boolean;
  testId?: string;
  /** Produto (a Black tem % maior em algumas linhas). */
  slug?: string | null;
};

export default function CampaignPrice({ priceCents, className = "", withPix = false, testId, slug = null }: Props) {
  const phase = useCampaign();

  if (!priceCents) return null;

  const price = campaignUnitPriceCents(priceCents, phase, slug);
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
export function CampaignPriceInline({ priceCents, className = "", slug = null }: { priceCents: number | null | undefined; className?: string; slug?: string | null }) {
  const phase = useCampaign();

  if (!priceCents) return null;

  const price = campaignUnitPriceCents(priceCents, phase, slug);

  return (
    <span className={className}>
      {phase && <s className="mr-1.5 text-[0.8em] font-bold text-[#8d7789]">{formatBRL(priceCents)}</s>}
      {formatBRL(price)}
    </span>
  );
}

/**
 * Preço do KIT (combo) com a campanha (Luis, 15/11): vale o MAIOR desconto, nunca os dois. Fora da campanha: o preço do combo.
 * Na campanha, se o combo não vence (offerBeatsCampaign), o kit sai pela soma dos preços da campanha de cada item, com a soma do site riscada.
 */
export function CampaignKitPriceInline({
  items,
  comboCents,
  comboPercent,
  className = "",
}: {
  items: Array<{ slug: string; priceCents: number }>;
  comboCents: number | null | undefined;
  comboPercent: number;
  className?: string;
}) {
  const phase = useCampaign();

  if (!comboCents) return null;

  const slugs = items.map((item) => item.slug);

  if (!phase || offerBeatsCampaign(comboPercent, phase, slugs)) {
    return <span className={className}>{formatBRL(comboCents)}</span>;
  }

  const siteSum = items.reduce((sum, item) => sum + item.priceCents, 0);
  const campaignSum = items.reduce((sum, item) => sum + campaignUnitPriceCents(item.priceCents, phase, item.slug), 0);

  return (
    <span className={className} data-testid="preco-kit-campanha">
      <s className="mr-1.5 text-[0.8em] font-bold text-[#8d7789]">{formatBRL(siteSum)}</s>
      {formatBRL(campaignSum)}
    </span>
  );
}
