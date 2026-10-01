"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Elementos flutuantes do B2C (carrinho B2C, "Seja uma criadora", barra
 * de linhas) não aparecem na área B2B: lá eles cobriam ações como
 * "Salvar e revisar oferta" e misturavam o carrinho B2C com o B2B.
 */
export default function HideOnB2B({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/b2b" || pathname?.startsWith("/b2b/")) {
    return null;
  }

  return <>{children}</>;
}
