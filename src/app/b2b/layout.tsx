import type { Metadata } from "next";
import type { ReactNode } from "react";

import SessionExpiredGuard from "@/components/SessionExpiredGuard";
import { B2BCartProvider } from "@/lib/b2b/cart-context";

export const metadata: Metadata = {
  title: "Bio Florais | Área B2B",
  robots: { index: false, follow: false },
};

export default function B2BLayout({ children }: { children: ReactNode }) {
  return (
    <B2BCartProvider>
      {/*
        C6: o rodapé institucional do layout raiz leva ao site B2C. Dentro do B2B ele fica oculto
        (só nesta área; o layout raiz e o B2C não mudam). Logo, menu e "continuar comprando" do
        B2B apontam sempre para o link (token).
      */}
      <style>{"body > footer { display: none !important; }"}</style>
      <SessionExpiredGuard scope="b2b" loginHref="/b2b/login" />
      {children}
    </B2BCartProvider>
  );
}
