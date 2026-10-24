"use client";

/** Ícone da sacola no cabeçalho das páginas /para/*: só aparece quando há item, com a contagem (leva à sacola). */

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";

export default function CampaignCartIcon() {
  const { itemCount } = useCart();

  if (itemCount <= 0) return null;

  return (
    <Link
      href="/carrinho"
      aria-label={itemCount > 0 ? `Abrir a sacola com ${itemCount} ${itemCount === 1 ? "item" : "itens"}` : "Abrir a sacola"}
      data-testid="campanha-sacola"
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfd9] bg-white text-[#55245f] transition hover:bg-[#f6eef7]"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M5 8h14l-1 12H6L5 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>

      {itemCount > 0 ? (
        <span
          data-testid="campanha-sacola-contagem"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6b3375] px-1 text-[11px] font-bold text-white"
          aria-hidden="true"
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
