"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useB2BCart } from "@/lib/b2b/cart-context";
import { formatB2BCents } from "@/lib/b2b/format";
import { applyB2BPercentDiscount, calculateB2BPromotionBonusQty } from "@/lib/b2b/promotion-engine";

export type B2BCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  content: string | null;
  image: string | null;
  priceCents: number;
  /** Aviso da promoção da oferta (ex.: "Compre 2 e leve +1 grátis"). */
  promotionText?: string | null;
  /** Regra "compre X, leve Y" (só em produto elegível), para a bonificação ao vivo. */
  promotion?: { buyQuantity: number; freeQuantity: number; percent?: number | null } | null;
};

export type B2BCatalogGroup = {
  id: string;
  name: string;
  products: B2BCatalogProduct[];
  promotionNote?: string | null;
};

function ProductCard({
  product,
  inCartQty,
  onAdd,
}: {
  product: B2BCatalogProduct;
  inCartQty: number;
  onAdd: (qty: number) => void;
}) {
  const [qty, setQty] = useState(6);

  return (
    <li className="flex flex-col rounded-[20px] border border-[#eadfd9] bg-white p-4 shadow-sm">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#fbf5f1]">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-[#9c8c98]">Sem imagem</span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-bold leading-snug text-[#422347]">{product.name}</h3>
      {product.content && <p className="mt-1 text-xs text-[#8a7886]">{product.content}</p>}

      {product.promotionText && (
        <p className="mt-2 inline-flex self-start rounded-full bg-blue-600 px-3 py-1 text-[11px] font-extrabold text-white">
          {product.promotionText}
        </p>
      )}

      {product.promotion?.percent ? (
        <p className="mt-2 text-lg font-extrabold text-[#55245f]">
          <span className="mr-2 text-sm font-semibold text-[#8a7886] line-through">{formatB2BCents(product.priceCents)}</span>
          {formatB2BCents(applyB2BPercentDiscount(product.priceCents, product.promotion.percent))}
          <span className="ml-1 text-xs font-semibold text-[#8a7886]">/ un.</span>
          <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
            −{String(product.promotion.percent).replace(".", ",")}%
          </span>
        </p>
      ) : (
        <p className="mt-2 text-lg font-extrabold text-[#55245f]">
          {formatB2BCents(product.priceCents)}
          <span className="ml-1 text-xs font-semibold text-[#8a7886]">/ un.</span>
        </p>
      )}

      <div className="mt-auto pt-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-[#d9c7dc]">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={() => setQty((value) => Math.max(1, value - 1))}
              className="h-9 w-9 text-lg text-[#63326d]"
            >
              −
            </button>
            <input
              aria-label="Quantidade"
              inputMode="numeric"
              value={qty}
              onChange={(event) => {
                const next = Number(event.target.value.replace(/\D/g, ""));
                setQty(Number.isFinite(next) && next > 0 ? Math.min(next, 9999) : 1);
              }}
              className="w-12 bg-transparent text-center text-sm font-bold outline-none"
            />
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={() => setQty((value) => Math.min(9999, value + 1))}
              className="h-9 w-9 text-lg text-[#63326d]"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAdd(qty)}
            className="flex-1 rounded-full bg-[#63326d] px-3 py-2 text-xs font-extrabold text-white"
          >
            Adicionar
          </button>
        </div>
        {product.promotion && !product.promotion.percent && (() => {
          // Mesma função do servidor (promotion-engine): bonificação sobre o total do pedido.
          const total = inCartQty + qty;
          const bonus = calculateB2BPromotionBonusQty(
            total,
            product.promotion.buyQuantity,
            product.promotion.freeQuantity
          );

          return (
            <p
              className={`mt-2 text-xs font-extrabold ${bonus > 0 ? "text-blue-700" : "text-[#8a7886]"}`}
              aria-live="polite"
            >
              {bonus > 0
                ? `${total} pagas + ${bonus} grátis = ${total + bonus} unidades`
                : `Compre ${product.promotion.buyQuantity} para ganhar +${product.promotion.freeQuantity} grátis`}
            </p>
          );
        })()}
        {inCartQty > 0 && (
          <p className="mt-2 text-xs font-semibold text-[#2f7a4a]">{inCartQty} no pedido</p>
        )}
      </div>
    </li>
  );
}

export default function B2BOfferCatalog({
  token,
  groups,
}: {
  token: string;
  groups: B2BCatalogGroup[];
}) {
  const cart = useB2BCart();
  const { setOfferToken, hydrated } = cart;

  useEffect(() => {
    if (hydrated) setOfferToken(token);
  }, [hydrated, setOfferToken, token]);

  const qtyByProduct = new Map(cart.state.lines.map((line) => [line.productId, line.qty]));

  return (
    <>
      <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10">
        {groups.map((group) => (
          <section key={group.id} className="mb-10">
            <h2 className="sr-only">{group.name}</h2>
            {group.promotionNote && (
              <p className="mt-2 rounded-2xl border-2 border-blue-500 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-900">
                {group.promotionNote}
              </p>
            )}
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {group.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inCartQty={qtyByProduct.get(product.id) ?? 0}
                  onAdd={(qty) =>
                    cart.addItem(
                      {
                        productId: product.id,
                        slug: product.slug,
                        name: product.name,
                        image: product.image,
                        priceCents: product.priceCents,
                        discountPercent: product.promotion?.percent ?? null,
                      },
                      qty
                    )
                  }
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-[#eadfd9] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-3 lg:px-10">
          <div className="text-sm">
            <p className="font-bold text-[#422347]">
              {cart.itemCount} {cart.itemCount === 1 ? "item" : "itens"} ·{" "}
              {formatB2BCents(cart.subtotalCents)}
            </p>
            <p className="text-xs text-[#8a7886]">
              Pedido mínimo: R$ 250,00 em produtos · Frete especial B2B a partir de R$ 450
            </p>
          </div>
          <Link
            href={`/b2b/carrinho?b2b=${encodeURIComponent(token)}`}
            className="rounded-full bg-[#55245f] px-5 py-3 text-sm font-extrabold text-white"
          >
            Ver pedido
          </Link>
        </div>
      </div>
    </>
  );
}
