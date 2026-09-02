"use client";

import {
  useState,
} from "react";

import {
  useCart,
} from "./CartProvider";

interface ProductPayload {
  productSlug: string;
  name: string;
  image?: string | null;
}

interface Props {
  product?: ProductPayload;
  shampoo?: ProductPayload;
  conditioner?: ProductPayload;
  mode:
    | "product"
    | "combo";
  children: React.ReactNode;
  className?: string;
}

export default function AddToCartButton({
  product,
  shampoo,
  conditioner,
  mode,
  children,
  className,
}: Props) {
  const {
    addProduct,
    addCombo,
  } =
    useCart();

  const [
    added,
    setAdded,
  ] =
    useState(false);

  function handleClick() {
    if (
      mode === "product" &&
      product
    ) {
      addProduct(product);
    }

    if (
      mode === "combo" &&
      shampoo &&
      conditioner
    ) {
      addCombo({
        shampoo,
        conditioner,
      });
    }

    setAdded(true);

    window.setTimeout(
      () =>
        setAdded(false),
      1200
    );
  }

  return (
    <button
      type="button"
      onClick={
        handleClick
      }
      className={
        className
      }
    >
      {added
        ? "Adicionado ✓"
        : children}
    </button>
  );
}
