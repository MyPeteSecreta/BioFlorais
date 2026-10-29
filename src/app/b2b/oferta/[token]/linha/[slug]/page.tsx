/**
 * BIO FLORAIS B2B — produtos de UMA linha, aberta pelo cliente a partir do
 * link da oferta.
 *
 * - Linha da oferta: preço B2B + selo "Compre X e leve +Y grátis" só nos
 *   produtos elegíveis (o desconto real é calculado no servidor).
 * - Linha fora da oferta: preço B2B NORMAL, sem promoção (decisão do Luis,
 *   01/10). A visita é registrada por <RecordLineView/> (POST depois de
 *   montar) e o botão de WhatsApp pede ao vendedor uma oferta com a linha.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildKitCards, loadDisabledDisplays } from "@/lib/b2b/displays-server";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { findOtherB2BLine, loadOtherLineProducts } from "@/lib/b2b/line-views";
import { buildWhatsAppUrl } from "@/lib/b2b/invite-links";
import { b2bProductContent, bonusLabel, percentText, productPromotionRule, productPromotionText } from "@/lib/b2b/offer-notices";
import { resolveB2BUnitPriceCents } from "@/lib/b2b/pricing";
import { listOfferPromotionNotices } from "@/lib/b2b/promotion-resolver";
import { loadPublicB2BOfferContext, type PublicB2BProduct } from "@/lib/b2b/public-offer-context";
import { getProduct } from "@/lib/catalog/bio-products";
import { b2bProductLabel, describeScope } from "@/lib/b2b/product-label";
import { getProductMainImage } from "@/lib/catalog/product-images.server";
import B2BHero from "@/components/b2b/B2BHero";
import B2BOfferCatalog, { type B2BCatalogProduct } from "@/components/b2b/B2BOfferCatalog";
import RecordLineView from "./RecordLineView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toCatalogProduct(
  product: PublicB2BProduct,
  promotionText: string | null,
  promotion: { buyQuantity: number; freeQuantity: number; percent: number | null } | null = null
): B2BCatalogProduct {
  const catalogProduct = getProduct(product.slug);
  const label = b2bProductLabel({ slug: product.slug, name: product.name, category: product.category });

  return {
    id: product.id,
    slug: product.slug,
    name: label.title,
    typeLabel: label.type || null,
    lineLabel: label.line || null,
    fullName: label.full,
    content: label.volume || b2bProductContent(catalogProduct),
    image: catalogProduct ? getProductMainImage(catalogProduct) || null : null,
    priceCents: resolveB2BUnitPriceCents(product.b2cPriceCents, product.category),
    promotionText,
    promotion,
  };
}

export default async function B2BLinePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; slug: string }>;
  searchParams: Promise<{ kit?: string }>;
}) {
  const { token, slug } = await params;
  const { kit: focusKit } = await searchParams;
  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) {
    // Promoção do link vencida: abre a loja normal com o aviso.
    if (resolution.error === "promo_link_ended" && resolution.promoRedirect) redirect(resolution.promoRedirect);

    notFound();
  }

  const { context } = resolution;
  const offerHref = `/b2b/oferta/${encodeURIComponent(token)}`;
  const offerLine = context.commercialGroups.find((group) => group.slug === slug) ?? null;
  const otherLine = offerLine ? null : await findOtherB2BLine(context, slug);
  const line = offerLine ?? otherLine;

  if (!line) {
    // Linha inexistente, inativa ou oculta.
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Esta linha não está disponível.</p>
        <Link href={offerHref} className="mt-4 inline-block text-sm font-bold text-[#63326d] underline">
          Voltar às linhas
        </Link>
      </main>
    );
  }

  let catalogProducts: B2BCatalogProduct[];
  let promotionNote: string | null = null;
  // Produtos da linha (para montar a composição fixa dos kits com display).
  let kitSourceProducts: PublicB2BProduct[] = [];

  if (offerLine) {
    const notices = await listOfferPromotionNotices(context.offerId, context.clientId);

    kitSourceProducts = context.products.filter((product) => product.commercialGroupIds.includes(offerLine.id));

    catalogProducts = kitSourceProducts
      .map((product) =>
        toCatalogProduct(
          product,
          productPromotionText(notices, offerLine.id, product.id),
          productPromotionRule(notices, offerLine.id, product.id)
        )
      );

    const wide = notices.find((item) => item.commercialGroupId === offerLine.id && item.productIds.length === 0);
    promotionNote = wide
      ? wide.percent !== null
        ? `Promoção nesta linha: ${percentText(wide.percent)}% de desconto.`
        : `Promoção nesta linha: ${bonusLabel(wide.buyQuantity, wide.freeQuantity)} do mesmo produto.`
      : null;

    // Promoção pontual: só os SKUs dela.
    const pointed = notices.filter((item) => item.commercialGroupId === offerLine.id && item.productIds.length > 0);
    if (!promotionNote && pointed.length > 0) {
      const names = catalogProducts.filter((product) => product.promotionText).map((product) => product.name);
      promotionNote = `Oferta válida para ${
        describeScope(
          context.products.filter((product) => pointed.some((item) => item.productIds.includes(product.id)) && product.commercialGroupIds.includes(offerLine.id))
        ) ?? names.join(", ")
      }.`;
    }
  } else {
    const lineProducts = await loadOtherLineProducts(context, line.id);
    kitSourceProducts = lineProducts;
    catalogProducts = lineProducts.map((product) => toCatalogProduct(product, null));
  }

  // Kits com display (ligados no admin): PRIMEIROS cards da linha, só desta linha.
  const kits = buildKitCards(
    line.slug,
    kitSourceProducts.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      b2cPriceCents: product.b2cPriceCents,
    })),
    await loadDisabledDisplays(getAppSqlRunner())
  );

  const whatsappUrl = otherLine
    ? buildWhatsAppUrl(
        context.responsiblePhone,
        `Olá, ${context.responsibleName}! Aqui é ${context.clientDisplayName}. Vi a linha ${line.name} da Bio Florais e gostaria de uma oferta com ela.`
      )
    : null;

  return (
    <main className="min-h-screen bg-[#fffaf6] pb-32 text-[#422347]">
      {otherLine && <RecordLineView token={token} lineSlug={line.slug} />}

      <B2BHero title={line.name} compact>
        <Link href={offerHref} className="text-sm font-bold text-[#63326d] underline underline-offset-4">
          ← Voltar às linhas
        </Link>
        {otherLine && whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#1f9d55] px-5 py-2 text-sm font-extrabold text-white"
          >
            Pedir oferta desta linha ao representante
          </a>
        )}
        {!otherLine && promotionNote && (
          <p className="rounded-2xl border-2 border-blue-500 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-900">{promotionNote}</p>
        )}
      </B2BHero>

      {catalogProducts.length === 0 && kits.length === 0 ? (
        <p className="mx-auto max-w-[1180px] px-5 py-10 text-[#746471] lg:px-10">
          Nenhum produto disponível nesta linha no momento.
        </p>
      ) : (
        <B2BOfferCatalog token={token} groups={[{ id: line.id, name: line.name, products: catalogProducts }]} kits={kits} focusKit={focusKit} />
      )}
    </main>
  );
}
