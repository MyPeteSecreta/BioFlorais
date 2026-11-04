"use client";

/**
 * Cartão de sugestões do carrinho (sem pop-up), entre os itens e o total: "Faltam R$ X para o frete grátis — que tal levar junto?",
 * com 3 sugestões e "+ Adicionar" em cada. Ao chegar em R$ 70 vira "Você ganhou frete grátis". Versão compacta no resumo do checkout.
 * Sem promessa de saúde: só nome, tipo e preço do produto. Adicionar dispara o evento "sugestao_adicionada" (origem e campanha).
 */

import { useMemo } from "react";

import { CampaignPriceInline } from "@/components/campaign/CampaignPrice";
import { useCart } from "@/components/cart/CartProvider";
import { buildCartSuggestions, shippingGap } from "@/lib/cart-suggestions";
import { B2C_FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/checkout/benefits";
import { useCartImages } from "@/lib/cart-images";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type Props = {
  /** Valor dos produtos na base da regra de frete (R$ 70). */
  baseCents: number;
  variant?: "full" | "compact";
};

export default function CartShippingSuggestions({ baseCents, variant = "full" }: Props) {
  const { items, addProduct } = useCart();
  const compact = variant === "compact";
  const slugs = items.map((item) => item.productSlug);
  const gap = shippingGap(baseCents, B2C_FREE_SHIPPING_THRESHOLD_CENTS);
  const suggestions = useMemo(() => (gap.reached ? [] : buildCartSuggestions(slugs)), [gap.reached, slugs.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const images = useCartImages(suggestions.map((suggestion) => suggestion.slug));

  if (items.length === 0 || baseCents <= 0) return null;

  if (gap.reached) {
    return (
      <div className={`rounded-[24px] border border-[#46644f]/20 bg-[#f3f6f1] ${compact ? "p-3" : "p-5"} shadow-sm`} data-testid="sugestoes-frete-gratis-ganho">
        <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-[#26352c]`}>
          Você ganhou frete grátis <span aria-hidden="true">✓</span>
        </p>
        <p className="mt-1 text-xs leading-5 text-[#26352c]/55">Na modalidade econômica.</p>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <section className={`rounded-[24px] border border-[#46644f]/15 bg-[#f3f6f1] ${compact ? "p-3" : "p-5"} shadow-sm`} data-testid="sugestoes-carrinho" aria-label="Sugestões para chegar ao frete grátis">
      <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-[#26352c]`} data-testid="sugestoes-faltam">
        Faltam <strong className="font-semibold text-[#46644f]">{brl(gap.remainingCents)}</strong> para o frete grátis{compact ? "." : " — que tal levar junto?"}
      </p>

      <div className={`mt-3 h-1.5 overflow-hidden rounded-full bg-[#46644f]/10`}>
        <div className="h-full rounded-full bg-[#46644f] transition-[width] duration-300 ease-out" style={{ width: `${gap.progress}%` }} />
      </div>

      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.slug} className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-2.5" data-testid="sugestao-item">
            {!compact && (
              // eslint-disable-next-line @next/next/no-img-element
              images[suggestion.slug] ? <img src={images[suggestion.slug] as string} alt="" className="h-14 w-14 shrink-0 rounded-xl object-contain" /> : <span className="h-14 w-14 shrink-0 rounded-xl bg-[#f8f5ee]" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#26352c]/45">{suggestion.kind}</p>
              <p className={`${compact ? "truncate text-xs" : "text-sm leading-tight"} font-medium text-[#26352c]`}>{suggestion.name}</p>
              <p className="text-xs font-semibold text-[#55245f]"><CampaignPriceInline priceCents={suggestion.priceCents} /></p>
            </div>
            <button
              type="button"
              onClick={() => addProduct({ productSlug: suggestion.slug, name: suggestion.name, image: images[suggestion.slug] ?? suggestion.image }, 1, "sugestao")}
              className="shrink-0 rounded-full border border-[#26352c]/25 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#26352c] transition hover:bg-[#26352c] hover:text-white"
              aria-label={`Adicionar ${suggestion.name} à sacola`}
              data-testid="sugestao-adicionar"
            >
              + Adicionar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
