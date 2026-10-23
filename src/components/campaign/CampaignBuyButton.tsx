"use client";

/** "Comprar": coloca o produto na sacola e abre o checkout (o GPT10 já está marcado para ser aplicado). */

import { useRouter } from "next/navigation";

import { useCart } from "@/components/cart/CartProvider";

export default function CampaignBuyButton({ productSlug, name, image }: { productSlug: string; name: string; image: string | null }) {
  const { addProduct } = useCart();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        addProduct({ productSlug, name, image });
        router.push("/checkout");
      }}
      className="mt-3 w-full rounded-full bg-[#55245f] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#422347] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55245f]"
      data-testid="campanha-comprar"
      aria-label={`Comprar ${name}`}
    >
      Comprar
    </button>
  );
}
