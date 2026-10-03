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

  // Só o B2C público mostra estes elementos: nem o B2B nem o admin.
  if (
    pathname === "/b2b" ||
    pathname?.startsWith("/b2b/") ||
    pathname === "/admin" ||
    pathname?.startsWith("/admin/")
  ) {
    return null;
  }

  return <>{children}</>;
}
