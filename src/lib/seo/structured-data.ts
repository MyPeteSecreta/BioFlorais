/**
 * Dados estruturados (schema.org) do B2C: BreadcrumbList, Organization/WebSite site-wide e as extensões do Offer
 * (shippingDetails e hasMerchantReturnPolicy). Textos e prazos SÓ os que as páginas de política publicam
 * (/frete-e-entrega e /trocas-e-devolucoes): nenhum prazo em dias de entrega é inventado.
 */

export const FREE_SHIPPING_MIN_CENTS = 10_000; // "Compras a partir de R$ 100,00 em produtos têm frete grátis"
export const RETURN_WINDOW_DAYS = 7; // "desistir da compra em até 7 (sete) dias corridos" (art. 49 do CDC)

/** JSON seguro para <script type="application/ld+json">: "<" escapado (nunca fecha a tag). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bio Florais",
    url: siteUrl,
    // Só os perfis reais publicados no rodapé do site.
    sameAs: ["https://www.instagram.com/bioflorais", "https://www.instagram.com/insta.biofloraispet/"],
  };
}

export function websiteJsonLd(siteUrl: string) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "Bio Florais", url: siteUrl };
}

/** BreadcrumbList: Início -> Linha -> Produto. `path` relativo; vira URL absoluta em www. */
export function breadcrumbJsonLd(siteUrl: string, trail: ReadonlyArray<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path === "/" ? "" : item.path}` || siteUrl,
    })),
  };
}

/**
 * Frete: entrega em todo o Brasil, valor e prazo calculados pelo CEP no carrinho/checkout, frete grátis a partir de
 * R$ 100,00 em produtos. SEM deliveryTime (a política não publica prazo em dias).
 */
export function shippingDetailsJsonLd(priceCents: number | null | undefined) {
  const description =
    "Entrega em todo o Brasil. O valor e o prazo do frete são calculados pelo CEP no carrinho e no checkout. Compras a partir de R$ 100,00 em produtos têm frete grátis na modalidade indicada no checkout.";

  return {
    "@type": "OfferShippingDetails",
    description,
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
    // Só afirma frete zero quando ESTE produto já passa de R$ 100,00 (o pedido do cliente é que define o resto).
    ...(priceCents && priceCents >= FREE_SHIPPING_MIN_CENTS
      ? { shippingRate: { "@type": "MonetaryAmount", value: "0.00", currency: "BRL" } }
      : {}),
  };
}

/** Troca/devolução: 7 dias corridos (arrependimento), devolução do frete por conta da loja nos casos cobertos. */
export function merchantReturnPolicyJsonLd(siteUrl: string) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: RETURN_WINDOW_DAYS,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
    merchantReturnLink: `${siteUrl}/trocas-e-devolucoes`,
  };
}

/** Descrição de imagem sem promessa de saúde: "Floral Bio Florais – <Nome> – <Linha>". */
export function imageAlt(input: { name: string; lineName?: string | null; category?: string | null }): string {
  const floral = !input.category || /^floral|virtudes|dose/i.test(input.category);
  const parts = [`${floral ? "Floral " : ""}Bio Florais`, input.name, input.lineName ?? ""].filter(Boolean);

  return parts.join(" – ");
}
