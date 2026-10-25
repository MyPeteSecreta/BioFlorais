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
import { jsonLdString, organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";
import OppRefCapture from "@/components/consent/OppRefCapture";
import AttributionCapture from "@/components/consent/AttributionCapture";
import AnalyticsEvents from "@/components/analytics/AnalyticsEvents";
import CookieBanner from "@/components/consent/CookieBanner";
import GoogleTag from "@/components/measurement/GoogleTag";
import MetaPixel from "@/components/measurement/MetaPixel";

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
        {/* Organization + WebSite (schema.org) em todas as páginas; sameAs só com os perfis publicados no rodapé. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd(getSiteUrl())) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd(getSiteUrl())) }} />
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
        {/* Origem da venda (utm_* e domínio do referrer, first-touch, 30 dias): dado de atribuição sem dado pessoal. */}
        <AttributionCapture />
        {/* Eventos do Vercel Analytics (chegada, ver_produto, sacola, checkout) com origem e campanha; sem dado pessoal. */}
        <AnalyticsEvents />
        {/* Google tag (Consent Mode v2, padrão negado) e pixel da Meta (só com aceite de marketing). IDs em variáveis de ambiente; sem ID, nada carrega. */}
        <GoogleTag />
        <MetaPixel />
      </body>
    </html>
  );
}



