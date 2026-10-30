"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Elementos flutuantes do B2C (carrinho B2C, "Seja uma criadora", barra
 * de linhas) não aparecem na área B2B: lá eles cobriam ações como
 * "Salvar e revisar oferta" e misturavam o carrinho B2C com o B2B.
 */
export default function HideOnB2B({ children, hideOnProductMobile = false }: { children: ReactNode; hideOnProductMobile?: boolean }) {
  const pathname = usePathname();

  // Só o B2C público mostra estes elementos: nem o B2B nem o admin.
  if (
    pathname === "/b2b" ||
    pathname?.startsWith("/b2b/") ||
    pathname === "/parceiros" ||
    pathname === "/admin" ||
    pathname?.startsWith("/admin/")
  ) {
    return null;
  }

  // Página de produto no celular: a barra fixa "Adicionar à sacola" ocupa o rodapé; a barra de linhas e o botão de criadoras saem de lá.
  if (hideOnProductMobile && pathname?.startsWith("/produto/")) {
    return <div className="max-md:hidden">{children}</div>;
  }

  return <>{children}</>;
}
