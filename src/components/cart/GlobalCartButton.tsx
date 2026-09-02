"use client";

import Link from "next/link";

import {
  useCart,
} from "@/components/cart/CartProvider";

export default function GlobalCartButton() {
  const {
    itemCount,
  } = useCart();

  if (itemCount <= 0) {
    return null;
  }

  return (
    <Link
      href="/checkout"
      aria-label={`Ver carrinho com ${itemCount} ${
        itemCount === 1
          ? "item"
          : "itens"
      }`}
      title="Ver carrinho"
      className="fixed right-6 top-24 z-[70] flex h-14 min-w-14 items-center justify-center gap-2 rounded-full border border-[#eadfd9] bg-white px-4 text-[#4b2354] shadow-[0_10px_35px_rgba(60,35,45,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(60,35,45,0.18)]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path
          d="M3 4H5L7.4 15.2C7.5 15.7 7.8 16.1 8.2 16.4C8.6 16.7 9.1 16.8 9.6 16.8H17.8C18.3 16.8 18.8 16.6 19.2 16.3C19.6 16 19.8 15.5 19.9 15L21 8H6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 21C10.55 21 11 20.55 11 20C11 19.45 10.55 19 10 19C9.45 19 9 19.45 9 20C9 20.55 9.45 21 10 21Z"
          fill="currentColor"
        />
        <path
          d="M18 21C18.55 21 19 20.55 19 20C19 19.45 18.55 19 18 19C17.45 19 17 19.45 17 20C17 20.55 17.45 21 18 21Z"
          fill="currentColor"
        />
      </svg>

      <span className="hidden text-sm font-semibold sm:inline">
        Carrinho
      </span>

      <span
        className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#6b3375] px-1.5 text-xs font-bold text-white"
        aria-hidden="true"
      >
        {itemCount > 99
          ? "99+"
          : itemCount}
      </span>
    </Link>
  );
}