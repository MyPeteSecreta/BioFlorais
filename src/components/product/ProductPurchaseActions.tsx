"use client";

/**
 * Compra na página de produto (B2C): quantidade, "Adicionar à sacola" / "Comprar agora", frete e prazo para o CEP, "leve N e ganhe
 * frete grátis", selos de confiança e "como usar" curto. No celular o botão "Adicionar à sacola" fica FIXO no rodapé, com o preço.
 * Todas as formas de adicionar passam pelo mesmo addProduct do carrinho (que dispara o evento "sacola").
 */

import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import ProductShippingEstimate from "@/components/product/ProductShippingEstimate";
import { freeShippingKit, pixPrice, type TrustBadge } from "@/lib/product-conversion";

interface Props {
  product: {
    productSlug: string;
    name: string;
    image?: string | null;
  };
  priceCents?: number | null;
  badges?: TrustBadge[];
  howToUse?: string | null;
}

const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function ProductPurchaseActions({ product, priceCents = null, badges = [], howToUse = null }: Props) {
  const { addProduct } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<"single" | "kit" | null>(null);

  const kit = freeShippingKit(priceCents);
  const pix = pixPrice(priceCents);

  function addMany(count: number) {
    addProduct(product, count);
  }

  function flash(kind: "single" | "kit") {
    setAdded(kind);
    window.setTimeout(() => setAdded(null), 1400);
  }

  function handleAdd() {
    addMany(quantity);
    flash("single");
  }

  function handleBuyNow() {
    addMany(quantity);
    window.location.href = "/checkout";
  }

  function handleKit() {
    if (!kit) return;

    addMany(kit.qty);
    flash("kit");
  }

  return (
    <div className="mt-5 lg:mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="frete-gratis-linha">
        <span className="font-semibold text-[#8b6524]">Frete grátis a partir de R$ 100</span>
        <span className="text-[#6c5b69]">· na modalidade econômica</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" data-testid="selos-confianca">
        {badges.map((badge) => (
          <span key={badge.key} className="inline-flex items-center gap-1.5 rounded-full border border-[#e4d6df] bg-white px-3 py-1.5 text-xs font-bold text-[#55245f]">
            <span aria-hidden className="text-[#a0742b]">
              ✓
            </span>
            {badge.label}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center overflow-hidden rounded-full border border-[#d9c7dc] bg-white">
          <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="h-12 w-14 text-xl text-[#63326d] transition hover:bg-[#faf6f8]">
            −
          </button>
          <span className="min-w-12 text-center font-bold text-[#422347]" data-testid="quantidade">
            {quantity}
          </span>
          <button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity((current) => current + 1)} className="h-12 w-14 text-xl text-[#63326d] transition hover:bg-[#faf6f8]">
            +
          </button>
        </div>
        <p className="text-sm font-bold text-[#5d465b]">Quantidade</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={handleAdd} className="rounded-full bg-[#63326d] px-6 py-4 text-sm font-extrabold text-white transition hover:bg-[#55245f]" data-testid="adicionar-sacola">
          {added === "single" ? "Adicionado ✓" : "Adicionar à sacola"}
        </button>
        <button type="button" onClick={handleBuyNow} className="rounded-full border border-[#63326d] bg-white px-6 py-4 text-sm font-extrabold text-[#63326d] transition hover:bg-[#faf6f8]">
          Comprar agora
        </button>
      </div>

      {kit && (
        <button
          type="button"
          onClick={handleKit}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-[#c39745] bg-[#fff8e8] px-4 py-3 text-left"
          data-testid="kit-frete-gratis"
        >
          <span>
            <span className="block text-sm font-extrabold text-[#422347]">Leve {kit.qty} e ganhe frete grátis</span>
            <span className="block text-xs text-[#746471]">
              {kit.qty} unidades por {brl(kit.totalCents)} · frete grátis (modalidade econômica)
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[#a0742b] px-4 py-2 text-xs font-extrabold text-white">{added === "kit" ? "Adicionado ✓" : `Levar ${kit.qty}`}</span>
        </button>
      )}

      {howToUse && (
        <p className="mt-4 rounded-2xl bg-[#f6efe6] px-4 py-3 text-sm leading-6 text-[#422347]" data-testid="como-usar-curto">
          <strong>Como usar:</strong> {howToUse}{" "}
          <a href="#como-usar" className="font-bold text-[#63326d] underline">
            ver mais
          </a>
        </p>
      )}

      <ProductShippingEstimate productSlug={product.productSlug} />

      {/* Celular: barra fixa com preço e o botão principal sempre à vista. */}
      <div
        className="fixed inset-x-0 bottom-0 z-[65] border-t border-[#eadfd9] bg-white/95 px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_24px_rgba(66,35,71,0.12)] backdrop-blur lg:hidden"
        data-testid="barra-compra-fixa"
      >
        <div className="mx-auto flex max-w-[560px] items-center gap-3">
          <div className="min-w-0 flex-1">
            {priceCents ? <p className="text-lg font-extrabold leading-tight text-[#55245f]">{brl(priceCents)}</p> : null}
            {pix && <p className="truncate text-xs font-bold text-[#1f6b3a]">{brl(pix.priceCents)} no Pix</p>}
          </div>
          <button type="button" onClick={handleAdd} className="shrink-0 rounded-full bg-[#63326d] px-6 py-3.5 text-sm font-extrabold text-white active:scale-[0.98]" data-testid="adicionar-sacola-fixo">
            {added === "single" ? "Adicionado ✓" : "Adicionar à sacola"}
          </button>
        </div>
      </div>
    </div>
  );
}
