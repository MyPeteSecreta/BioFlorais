"use client";

/**
 * BIO FLORAIS B2B — carrinho isolado do carrinho B2C (chave própria de
 * localStorage). Os preços aqui são só para exibição: o servidor
 * recalcula tudo na cotação e na criação do pedido.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { reconcileDisplayList } from "@/lib/b2b/cart-displays";
import { effectiveUnitPriceCents } from "@/lib/b2b/promotion-engine";

export type B2BCartLine = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  priceCents: number;
  /** C3: percentual da promoção de desconto (só para exibição; o servidor recalcula). */
  discountPercent?: number | null;
  qty: number;
};

/** Preço unitário efetivo exibido (com o desconto %, se houver). */
export function cartLineUnitCents(line: Pick<B2BCartLine, "priceCents" | "discountPercent">) {
  return effectiveUnitPriceCents(line);
}

/**
 * Display do kit (brinde R$ 0,00): grátis só com o kit COMPLETO. Guarda a composição (produto + qtd) para a sacola
 * saber, na hora, se o kit continua completo; o SERVIDOR revalida pelo catálogo.
 */
export type B2BCartDisplay = {
  /** Chave do display (ex.: adulto-compacto). */
  key: string;
  name: string;
  composition: Array<{ productId: string; qty: number }>;
};

type B2BCartState = {
  offerToken: string | null;
  lines: B2BCartLine[];
  displays: B2BCartDisplay[];
};

type InternalState = B2BCartState & { hydrated: boolean; notice: string | null };

export const DISPLAY_REMOVED_NOTICE =
  "O display vem grátis com o kit completo: ele saiu da sacola porque o kit ficou incompleto.";

function reconcileDisplays(state: InternalState): InternalState {
  if (state.displays.length === 0) return state;

  const result = reconcileDisplayList(state.displays, state.lines);

  return result.removed.length === 0 ? state : { ...state, displays: result.displays, notice: DISPLAY_REMOVED_NOTICE };
}

type Action =
  | { type: "SET_OFFER_TOKEN"; token: string }
  | { type: "ADD_ITEM"; item: Omit<B2BCartLine, "qty">; qty: number }
  | { type: "SET_QTY"; productId: string; qty: number }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "ADD_KIT"; display: B2BCartDisplay; items: Array<Omit<B2BCartLine, "qty"> & { qty: number }> }
  | { type: "DISMISS_NOTICE" }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: B2BCartState | null };

const STORAGE_KEY = "bioflorais.b2b.cart.v1";

const initialState: InternalState = { offerToken: null, lines: [], displays: [], hydrated: false, notice: null };

function reducer(state: InternalState, action: Action): InternalState {
  return reconcileDisplays(reduce(state, action));
}

function reduce(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "SET_OFFER_TOKEN":
      if (state.offerToken === action.token) {
        return state;
      }
      // Outra oferta = outro catálogo/preço: esvazia o carrinho. Itens sem
      // dono (token nulo) também não passam para o link novo.
      if (state.offerToken !== action.token) {
        return { ...state, offerToken: action.token, lines: [], displays: [], notice: null };
      }
      return { ...state, offerToken: action.token };
    case "ADD_ITEM": {
      const qty = Math.max(1, Math.floor(action.qty));
      const exists = state.lines.some((line) => line.productId === action.item.productId);
      return {
        ...state,
        lines: exists
          ? state.lines.map((line) =>
              line.productId === action.item.productId
                ? { ...line, ...action.item, qty: line.qty + qty }
                : line
            )
          : [...state.lines, { ...action.item, qty }],
      };
    }
    case "SET_QTY":
      return {
        ...state,
        lines: state.lines
          .map((line) =>
            line.productId === action.productId
              ? { ...line, qty: Math.max(0, Math.floor(action.qty)) }
              : line
          )
          .filter((line) => line.qty > 0),
      };
    case "REMOVE_ITEM":
      return {
        ...state,
        lines: state.lines.filter((line) => line.productId !== action.productId),
      };
    case "ADD_KIT": {
      // A composição FIXA entra na sacola (soma ao que já tem) e o display grátis é registrado.
      let lines = state.lines;

      for (const item of action.items) {
        const { qty, ...line } = item;
        const exists = lines.some((current) => current.productId === line.productId);
        lines = exists
          ? lines.map((current) => (current.productId === line.productId ? { ...current, ...line, qty: current.qty + qty } : current))
          : [...lines, { ...line, qty }];
      }

      return { ...state, lines, displays: [...state.displays, action.display], notice: null };
    }
    case "DISMISS_NOTICE":
      return { ...state, notice: null };
    case "CLEAR":
      return { ...state, lines: [], displays: [], notice: null };
    case "HYDRATE":
      // Sacola gravada sem token de oferta não pertence a nenhum link: descarta.
      return action.state && action.state.offerToken
        ? {
            offerToken: action.state.offerToken,
            lines: action.state.lines,
            displays: Array.isArray(action.state.displays) ? action.state.displays : [],
            hydrated: true,
            notice: null,
          }
        : { ...state, hydrated: true };
    default:
      return state;
  }
}

type B2BCartContextValue = {
  state: B2BCartState;
  hydrated: boolean;
  itemCount: number;
  subtotalCents: number;
  setOfferToken: (token: string) => void;
  addItem: (item: Omit<B2BCartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  /** Kit com display: coloca a composição fixa na sacola e registra o display grátis. */
  addKit: (display: B2BCartDisplay, items: Array<Omit<B2BCartLine, "qty"> & { qty: number }>) => void;
  /** Aviso "o display vem grátis com o kit completo" (quando o kit ficou incompleto). */
  notice: string | null;
  dismissNotice: () => void;
};

const B2BCartContext = createContext<B2BCartContextValue | null>(null);

function isValidState(value: unknown): value is B2BCartState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as B2BCartState;
  return (
    (candidate.offerToken === null || typeof candidate.offerToken === "string") &&
    Array.isArray(candidate.lines) &&
    (candidate.displays === undefined || Array.isArray(candidate.displays))
  );
}

export function B2BCartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      dispatch({ type: "HYDRATE", state: isValidState(parsed) ? parsed : null });
    } catch {
      // Sem localStorage: carrinho só em memória.
      dispatch({ type: "HYDRATE", state: null });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ offerToken: state.offerToken, lines: state.lines, displays: state.displays })
      );
    } catch {
      // Falha silenciosa.
    }
  }, [state]);

  const value = useMemo<B2BCartContextValue>(
    () => ({
      state,
      hydrated: state.hydrated,
      itemCount: state.lines.reduce((sum, line) => sum + line.qty, 0),
      subtotalCents: state.lines.reduce((sum, line) => sum + cartLineUnitCents(line) * line.qty, 0),
      setOfferToken: (token) => dispatch({ type: "SET_OFFER_TOKEN", token }),
      addItem: (item, qty = 1) => dispatch({ type: "ADD_ITEM", item, qty }),
      setQty: (productId, qty) => dispatch({ type: "SET_QTY", productId, qty }),
      removeItem: (productId) => dispatch({ type: "REMOVE_ITEM", productId }),
      clear: () => dispatch({ type: "CLEAR" }),
      addKit: (display, items) => dispatch({ type: "ADD_KIT", display, items }),
      notice: state.notice,
      dismissNotice: () => dispatch({ type: "DISMISS_NOTICE" }),
    }),
    [state]
  );

  return <B2BCartContext.Provider value={value}>{children}</B2BCartContext.Provider>;
}

export function useB2BCart() {
  const context = useContext(B2BCartContext);

  if (!context) {
    throw new Error("useB2BCart precisa estar dentro de <B2BCartProvider>.");
  }

  return context;
}
