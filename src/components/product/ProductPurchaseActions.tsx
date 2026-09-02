"use client";

import {
  useState,
} from "react";


import {
  useCart,
} from "@/components/cart/CartProvider";

interface Props {
  product: {
    productSlug: string;
    name: string;
    image?: string | null;
  };
}

export default function ProductPurchaseActions({
  product,
}: Props) {

  const {
    addProduct,
  } =
    useCart();

  const [
    quantity,
    setQuantity,
  ] =
    useState(1);

  const [
    added,
    setAdded,
  ] =
    useState(false);

  function addQuantity() {
    for (
      let i = 0;
      i < quantity;
      i++
    ) {
      addProduct(product);
    }
  }

  function handleAdd() {
    addQuantity();

    setAdded(true);

    window.setTimeout(
      () =>
        setAdded(false),
      1200
    );
  }

  function handleBuyNow() {
    addQuantity();
    window.location.href = "/checkout";
  }

  return (
    <div
      className="
        mt-8
      "
    >
      <p
        className="
          mb-2
          text-sm
          font-bold
          text-[#5d465b]
        "
      >
        Quantidade
      </p>

      <div
        className="
          inline-flex
          items-center
          overflow-hidden
          rounded-full
          border
          border-[#d9c7dc]
          bg-white
        "
      >
        <button
          type="button"
          aria-label="Diminuir quantidade"
          onClick={() =>
            setQuantity(
              (current) =>
                Math.max(
                  1,
                  current - 1
                )
            )
          }
          className="
            h-12
            w-14
            text-xl
            text-[#63326d]
            transition
            hover:bg-[#faf6f8]
          "
        >
          −
        </button>

        <span
          className="
            min-w-12
            text-center
            font-bold
            text-[#422347]
          "
        >
          {quantity}
        </span>

        <button
          type="button"
          aria-label="Aumentar quantidade"
          onClick={() =>
            setQuantity(
              (current) =>
                current + 1
            )
          }
          className="
            h-12
            w-14
            text-xl
            text-[#63326d]
            transition
            hover:bg-[#faf6f8]
          "
        >
          +
        </button>
      </div>

      <div
        className="
          mt-5
          grid
          gap-3
          sm:grid-cols-2
        "
      >
        <button
          type="button"
          onClick={
            handleAdd
          }
          className="
            rounded-full
            bg-[#63326d]
            px-6
            py-4
            text-sm
            font-extrabold
            text-white
            transition
            hover:bg-[#55245f]
          "
        >
          {added
            ? "Adicionado ✓"
            : "Adicionar à sacola"}
        </button>

        <button
          type="button"
          onClick={
            handleBuyNow
          }
          className="
            rounded-full
            border
            border-[#63326d]
            bg-white
            px-6
            py-4
            text-sm
            font-extrabold
            text-[#63326d]
            transition
            hover:bg-[#faf6f8]
          "
        >
          Comprar agora
        </button>
      </div>
    </div>
  );
}



