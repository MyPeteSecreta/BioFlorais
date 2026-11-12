"use client";

/** /retomar: remonta a sacola com os itens do pedido não pago e leva ao checkout com o cupom pronto no campo. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BIO_CART_STORAGE_KEY } from "@/components/cart/CartProvider";

type Item = { productSlug: string; name: string; qty: number };

export default function RestoreCart({ items, code, auto = true }: { items: Item[]; code: string | null; auto?: boolean }) {
  const [failed, setFailed] = useState(false);

  const restore = useCallback(() => {
    try {
      window.localStorage.setItem(BIO_CART_STORAGE_KEY, JSON.stringify({ items, offers: [] }));
      window.location.replace(code ? `/checkout?cupom=${encodeURIComponent(code)}` : "/checkout");
    } catch {
      setFailed(true);
    }
  }, [items, code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (auto) restore();
  }, [auto, restore]);

  if (failed) {
    return (
      <p className="text-sm text-[#6c5b69]" role="status">
        Não conseguimos montar a sacola neste navegador. <Link href="/" className="font-bold underline">Voltar à loja</Link>
        {code ? ` e use o cupom ${code} no checkout.` : "."}
      </p>
    );
  }

  if (!auto) {
    return (
      <button type="button" onClick={restore} className="rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white">
        Concluir a compra
      </button>
    );
  }

  return (
    <p className="text-sm text-[#6c5b69]" role="status">
      Montando a sua sacola…
    </p>
  );
}
