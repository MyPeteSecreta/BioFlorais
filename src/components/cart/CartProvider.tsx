"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const BIO_CART_STORAGE_KEY =
  "bioflorais-cart-v1";

export const BIO_COMBO_CODE =
  "BIO_SHAMPOO_CONDICIONADOR_10";

export interface CartItem {
  productSlug: string;
  name: string;
  qty: number;
  image?: string | null;
}

export interface CartOffer {
  id: string;
  code: string;
  productSlugs: string[];
  qty: number;
}

interface AddProductInput {
  productSlug: string;
  name: string;
  image?: string | null;
}

interface AddComboInput {
  shampoo: AddProductInput;
  conditioner: AddProductInput;
}

interface CartState {
  items: CartItem[];
  offers: CartOffer[];
}

interface CartContextValue {
  items: CartItem[];
  offers: CartOffer[];
  itemCount: number;
  addProduct: (
    product: AddProductInput
  ) => void;
  addCombo: (
    combo: AddComboInput
  ) => void;
  setQuantity: (
    productSlug: string,
    qty: number
  ) => void;
  removeProduct: (
    productSlug: string
  ) => void;
  clearCart: () => void;
}

const EMPTY_CART: CartState = {
  items: [],
  offers: [],
};

const CartContext =
  createContext<CartContextValue | null>(
    null
  );

function sanitizeState(
  value: unknown
): CartState {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return EMPTY_CART;
  }

  const candidate =
    value as Partial<CartState>;

  const items =
    Array.isArray(candidate.items)
      ? candidate.items.filter(
          (
            item
          ): item is CartItem =>
            Boolean(
              item &&
                typeof item.productSlug ===
                  "string" &&
                typeof item.name ===
                  "string" &&
                Number.isInteger(
                  item.qty
                ) &&
                item.qty > 0
            )
        )
      : [];

  const slugs =
    new Set(
      items.map(
        (item) =>
          item.productSlug
      )
    );

  const offers =
    Array.isArray(candidate.offers)
      ? candidate.offers.filter(
          (
            offer
          ): offer is CartOffer =>
            Boolean(
              offer &&
                typeof offer.id ===
                  "string" &&
                typeof offer.code ===
                  "string" &&
                Array.isArray(
                  offer.productSlugs
                ) &&
                offer.productSlugs
                  .length > 0 &&
                offer.productSlugs.every(
                  (slug) =>
                    typeof slug ===
                      "string" &&
                    slugs.has(slug)
                ) &&
                Number.isInteger(
                  offer.qty
                ) &&
                offer.qty > 0
            )
        )
      : [];

  return {
    items,
    offers,
  };
}

function addOne(
  items: CartItem[],
  product: AddProductInput
) {
  const existing =
    items.find(
      (item) =>
        item.productSlug ===
        product.productSlug
    );

  if (!existing) {
    return [
      ...items,
      {
        productSlug:
          product.productSlug,
        name:
          product.name,
        image:
          product.image ?? null,
        qty: 1,
      },
    ];
  }

  return items.map(
    (item) =>
      item.productSlug ===
      product.productSlug
        ? {
            ...item,
            qty:
              item.qty + 1,
          }
        : item
  );
}

function reconcileOffers(
  state: CartState
): CartState {
  const qtyMap =
    new Map(
      state.items.map(
        (item) => [
          item.productSlug,
          item.qty,
        ]
      )
    );

  const offers =
    state.offers.filter(
      (offer) =>
        offer.productSlugs.every(
          (slug) =>
            (
              qtyMap.get(slug) ??
              0
            ) >= offer.qty
        )
    );

  return {
    ...state,
    offers,
  };
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    state,
    setState,
  ] =
    useState<CartState>(
      EMPTY_CART
    );

  const [
    hydrated,
    setHydrated,
  ] =
    useState(false);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(
          BIO_CART_STORAGE_KEY
        );

      if (raw) {
        setState(
          sanitizeState(
            JSON.parse(raw)
          )
        );
      }
    } catch {
      setState(
        EMPTY_CART
      );
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      BIO_CART_STORAGE_KEY,
      JSON.stringify(state)
    );
  }, [
    hydrated,
    state,
  ]);

  const addProduct =
    useCallback(
      (
        product:
          AddProductInput
      ) => {
        setState(
          (current) =>
            reconcileOffers({
              ...current,
              items:
                addOne(
                  current.items,
                  product
                ),
            })
        );
      },
      []
    );

  const addCombo =
    useCallback(
      (
        combo:
          AddComboInput
      ) => {
        setState(
          (current) => {
            let items =
              addOne(
                current.items,
                combo.shampoo
              );

            items =
              addOne(
                items,
                combo.conditioner
              );

            const id =
              [
                BIO_COMBO_CODE,
                combo.shampoo
                  .productSlug,
                combo.conditioner
                  .productSlug,
              ].join(":");

            const existing =
              current.offers.find(
                (offer) =>
                  offer.id === id
              );

            const offers =
              existing
                ? current.offers.map(
                    (offer) =>
                      offer.id ===
                      id
                        ? {
                            ...offer,
                            qty:
                              offer.qty +
                              1,
                          }
                        : offer
                  )
                : [
                    ...current.offers,
                    {
                      id,
                      code:
                        BIO_COMBO_CODE,
                      productSlugs: [
                        combo.shampoo
                          .productSlug,
                        combo.conditioner
                          .productSlug,
                      ],
                      qty: 1,
                    },
                  ];

            return reconcileOffers({
              items,
              offers,
            });
          }
        );
      },
      []
    );

  const setQuantity =
    useCallback(
      (
        productSlug:
          string,
        qty:
          number
      ) => {
        setState(
          (current) => {
            const items =
              qty <= 0
                ? current.items.filter(
                    (item) =>
                      item.productSlug !==
                      productSlug
                  )
                : current.items.map(
                    (item) =>
                      item.productSlug ===
                      productSlug
                        ? {
                            ...item,
                            qty,
                          }
                        : item
                  );

            return reconcileOffers({
              ...current,
              items,
            });
          }
        );
      },
      []
    );

  const removeProduct =
    useCallback(
      (
        productSlug:
          string
      ) => {
        setState(
          (current) =>
            reconcileOffers({
              ...current,
              items:
                current.items.filter(
                  (item) =>
                    item.productSlug !==
                    productSlug
                ),
            })
        );
      },
      []
    );

  const clearCart =
    useCallback(
      () => {
        setState(
          EMPTY_CART
        );
      },
      []
    );

  const itemCount =
    useMemo(
      () =>
        state.items.reduce(
          (sum, item) =>
            sum + item.qty,
          0
        ),
      [state.items]
    );

  const value =
    useMemo(
      () => ({
        items:
          state.items,
        offers:
          state.offers,
        itemCount,
        addProduct,
        addCombo,
        setQuantity,
        removeProduct,
        clearCart,
      }),
      [
        state,
        itemCount,
        addProduct,
        addCombo,
        setQuantity,
        removeProduct,
        clearCart,
      ]
    );

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(
      CartContext
    );

  if (!context) {
    throw new Error(
      "useCart deve ser usado dentro de CartProvider."
    );
  }

  return context;
}
