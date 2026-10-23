"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useB2BCart } from "@/lib/b2b/cart-context";
import type { KitCardView, KitOption } from "@/lib/b2b/displays-view";
import { formatB2BCents } from "@/lib/b2b/format";
import { clearQuoteDraft } from "@/lib/b2b/quote-draft";
import { B2B_MIN_ORDER_CENTS } from "@/lib/b2b/pricing";
import { applyB2BPercentDiscount, calculateB2BPromotionBonusQty } from "@/lib/b2b/promotion-engine";

export type B2BCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  content: string | null;
  /** Selo do tipo sobre a imagem (Shampoo, Condicionador, Floral, Snack...). */
  typeLabel?: string | null;
  lineLabel?: string | null;
  /** "<Tipo> <Nome> · <Linha> · <volume>" (sacola, checkout, pedido). */
  fullName?: string | null;
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

/**
 * Card de KIT COM DISPLAY: mesmo componente/tamanho/proporção de foto dos cards de produto. Um kit = a composição
 * FIXA da linha + display GRÁTIS (brinde). Com várias opções ("Escolha seu display") aparecem como variações.
 * Sem foto própria do display, usa a imagem da linha + selo "Display".
 */
function KitCard({
  card,
  focused,
  onAdd,
}: {
  card: KitCardView;
  focused: boolean;
  onAdd: (option: KitOption) => void;
}) {
  const [selected, setSelected] = useState(card.options[0]?.key ?? "");
  const [added, setAdded] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const option = card.options.find((item) => item.key === selected) ?? card.options[0];

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);

  if (!option) return null;

  const image = option.photo ?? card.lineImage;
  const belowMinimum = option.totalCents < B2B_MIN_ORDER_CENTS;

  return (
    <li
      ref={ref}
      data-testid="kit-card"
      className={[
        "flex flex-col rounded-[20px] border bg-white p-4 shadow-sm",
        card.featured || focused ? "border-blue-500 ring-[3px] ring-blue-500 ring-offset-2 ring-offset-[#fffaf6]" : "border-[#eadfd9]",
      ].join(" ")}
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#fbf5f1]">
        <span className="absolute left-2 top-2 z-10 rounded-full bg-[#55245f] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white shadow">
          Display
        </span>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={option.displayName} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-[#9c8c98]">Display</span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-bold leading-snug text-[#422347]">{card.title}</h3>
      <p className="mt-1 text-xs text-[#6c5b69]">
        {card.options.length > 1 ? "Toque para escolher o tamanho do display." : option.summary}
      </p>

      {card.featured && (
        <p className="mt-2 inline-flex self-start rounded-full bg-blue-600 px-3 py-1 text-[11px] font-extrabold text-white">Destaque</p>
      )}

      {card.options.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Escolha seu display">
          {card.options.map((item) => (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={item.key === option.key}
              onClick={() => setSelected(item.key)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-extrabold",
                item.key === option.key ? "border-[#55245f] bg-[#55245f] text-white" : "border-[#d9c7dc] bg-white text-[#55245f]",
              ].join(" ")}
            >
              {item.label} · {item.units} un.
            </button>
          ))}
        </div>
      )}

      {card.options.length > 1 && <p className="mt-2 text-xs text-[#6c5b69]">{option.summary}</p>}

      <p className="mt-2 text-lg font-extrabold text-[#55245f]">
        {formatB2BCents(option.totalCents)}
        <span className="ml-1 text-xs font-semibold text-[#8a7886]">/ kit</span>
      </p>
      <p className="mt-1 text-xs font-semibold text-[#2f7a4a]">{option.displayName} grátis</p>
      {belowMinimum && (
        <p className="mt-1 text-xs font-semibold text-[#8a5a12]">Pedido mínimo de {formatB2BCents(B2B_MIN_ORDER_CENTS)}: complete com outros itens.</p>
      )}

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={() => {
            onAdd(option);
            setAdded(true);
            window.setTimeout(() => setAdded(false), 2500);
          }}
          className="w-full rounded-full bg-[#63326d] px-3 py-2.5 text-xs font-extrabold text-white"
        >
          {added ? "Kit no pedido ✓" : "Adicionar kit"}
        </button>
      </div>
    </li>
  );
}

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
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#fbf5f1]">
        {product.typeLabel && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[#55245f] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white shadow">
            {product.typeLabel}
          </span>
        )}
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-[#9c8c98]">Sem imagem</span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-bold leading-snug text-[#422347]">{product.name}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6c5b69]">
        {product.lineLabel && <span className="font-semibold">{product.lineLabel}</span>}
        {product.content && (
          <span className="rounded-md bg-[#f6eef7] px-2 py-0.5 text-sm font-extrabold text-[#55245f]">{product.content}</span>
        )}
      </p>

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
  kits = [],
  focusKit,
}: {
  token: string;
  groups: B2BCatalogGroup[];
  /** Cards de kit com display da linha (aparecem como PRIMEIROS cards). */
  kits?: KitCardView[];
  /** ?kit=<chave do display>: o card desse kit abre destacado. */
  focusKit?: string;
}) {
  const cart = useB2BCart();
  const { setOfferToken, hydrated } = cart;

  useEffect(() => {
    if (hydrated) setOfferToken(token);
  }, [hydrated, setOfferToken, token]);

  // A sacola é de UM link: enquanto o token da sacola não é o desta loja, nada dela aparece (sem sacola "fantasma").
  const mine = cart.state.offerToken === token;
  const barItems = mine ? cart.itemCount : 0;
  const barSubtotal = mine ? cart.subtotalCents : 0;
  const qtyByProduct = new Map((mine ? cart.state.lines : []).map((line) => [line.productId, line.qty]));
  // ?kit=<chave>: só o PRIMEIRO card que tem esse display abre destacado.
  const focusCardId = focusKit ? kits.find((card) => card.options.some((option) => option.key === focusKit))?.id : undefined;

  return (
    <>
      <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10">
        {cart.notice && (
          <p
            role="alert"
            data-testid="aviso-display"
            className="mb-5 flex items-start justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
          >
            <span>{cart.notice}</span>
            <button type="button" onClick={cart.dismissNotice} className="shrink-0 text-xs font-extrabold underline">
              OK
            </button>
          </p>
        )}
        {groups.map((group) => (
          <section key={group.id} className="mb-10">
            <h2 className="sr-only">{group.name}</h2>
            {group.promotionNote && (
              <p className="mt-2 rounded-2xl border-2 border-blue-500 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-900">
                {group.promotionNote}
              </p>
            )}
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {kits.map((card) => (
                <KitCard
                  key={card.id}
                  card={card}
                  focused={card.id === focusCardId}
                  onAdd={(option) =>
                    cart.addKit(
                      {
                        key: option.key,
                        name: option.displayName,
                        composition: option.items.map((item) => ({ productId: item.productId, qty: item.qty })),
                      },
                      option.items.map((item) => ({
                        productId: item.productId,
                        slug: item.slug,
                        name: item.name,
                        image: item.image,
                        priceCents: item.priceCents,
                        discountPercent: null,
                        qty: item.qty,
                      }))
                    )
                  }
                />
              ))}
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
                        name: product.fullName ?? product.name,
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
              {barItems} {barItems === 1 ? "item" : "itens"} ·{" "}
              {formatB2BCents(barSubtotal)}
              {barItems > 0 && (
                <button
                  type="button"
                  className="ml-3 text-xs font-bold text-[#a33] underline"
                  data-testid="esvaziar-sacola"
                  onClick={() => {
                    cart.clear();
                    try {
                      clearQuoteDraft(window.sessionStorage, token);
                    } catch {
                      // sem armazenamento
                    }
                  }}
                >
                  Esvaziar
                </button>
              )}
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
