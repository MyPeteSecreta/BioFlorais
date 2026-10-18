import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import GlobalCartButton from "@/components/cart/GlobalCartButton";
import SiteFooter from "@/components/layout/SiteFooter";
import MobileLineBar from "@/components/layout/MobileLineBar";
import UgcFloatingButton from "@/components/ugc/UgcFloatingButton";
import HideOnB2B from "@/components/layout/HideOnB2B";
import WebAnalytics from "@/components/analytics/WebAnalytics";
import { OG_IMAGES, OG_IMAGE_SIZE } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site-url";
import OppRefCapture from "@/components/consent/OppRefCapture";
import CookieBanner from "@/components/consent/CookieBanner";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Bio Florais | Equilíbrio para viver melhor",
  description:
    "Bio Florais. Flores frescas brasileiras, fórmulas sem álcool e cuidado para diferentes momentos da vida.",
  openGraph: {
    type: "website",
    siteName: "Bio Florais",
    locale: "pt_BR",
    images: [{ url: OG_IMAGES.home, width: OG_IMAGE_SIZE.width, height: OG_IMAGE_SIZE.height, alt: "Bio Florais" }],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGES.home] },
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
        {/* Cookies: banner (Aceitar/Recusar/Configurar) e captura do oppref (ChatGPT Ads) só com aceite de marketing. */}
        <CookieBanner />
        <OppRefCapture />
      </body>
    </html>
  );
}



