import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import GlobalCartButton from "@/components/cart/GlobalCartButton";
import SiteFooter from "@/components/layout/SiteFooter";
import UgcFloatingButton from "@/components/ugc/UgcFloatingButton";

export const metadata: Metadata = {
  title: "Bio Florais | Equilíbrio para viver melhor",
  description:
    "Bio Florais. Flores frescas brasileiras, fórmulas sem álcool e cuidado para diferentes momentos da vida.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <CartProvider>
          {children}
          <GlobalCartButton />
          <SiteFooter />
          <UgcFloatingButton />
        </CartProvider>
      </body>
    </html>
  );
}



