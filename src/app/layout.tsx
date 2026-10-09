import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import GlobalCartButton from "@/components/cart/GlobalCartButton";
import SiteFooter from "@/components/layout/SiteFooter";
import MobileLineBar from "@/components/layout/MobileLineBar";
import UgcFloatingButton from "@/components/ugc/UgcFloatingButton";
import HideOnB2B from "@/components/layout/HideOnB2B";
import WebAnalytics from "@/components/analytics/WebAnalytics";

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
          <HideOnB2B>
            <GlobalCartButton />
          </HideOnB2B>
          <SiteFooter />
          <HideOnB2B>
            <UgcFloatingButton />
            <MobileLineBar />
          </HideOnB2B>
        </CartProvider>
        <WebAnalytics />
      </body>
    </html>
  );
}



