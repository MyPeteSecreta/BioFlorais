/**
 * GET /b2b/oferta/<token>/pdf — PDF da oferta do lojista (item 14b, 11/11): página A4 paisagem no padrão aprovado
 * (src/lib/b2b/offer-pdf.ts) que abre a impressão sozinha ("Salvar como PDF", também no celular); os botões do PDF são links
 * para a oferta. Escolha: página imprimível em vez de gerar o PDF no servidor (Chromium na Vercel é pesado e lento).
 * Mesmo acesso do link da oferta: quem tem o link vê a oferta e o PDF dela. Só leitura.
 */

import { NextResponse } from "next/server";

import { lineSlugsWithDisplay, displayPhotoUrl, loadDisabledDisplays } from "@/lib/b2b/displays-server";
import { homeLineImage } from "@/lib/b2b/line-images";
import { buildOfferPdfHtml, type OfferPdfLine } from "@/lib/b2b/offer-pdf";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import {
  B2B_BOLETO_DUE_DAYS,
  B2B_FREIGHT_FLAT_THRESHOLD_CENTS,
  B2B_MAX_INSTALLMENTS,
  B2B_MIN_INSTALLMENT_CENTS,
  B2B_MIN_ORDER_CENTS,
  B2B_PAYMENT_METHOD_DISCOUNT_PERCENT,
  resolveB2BUnitPriceCents,
} from "@/lib/b2b/pricing";
import { describeScope } from "@/lib/b2b/product-label";
import { listOfferPromotionNotices } from "@/lib/b2b/promotion-resolver";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { getSiteUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISPLAY_BY_LINE: Record<string, string> = { adulto: "adulto-compacto", pet: "pet-12" };

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolution = await loadPublicB2BOfferContext(token);

  if (!resolution.ok) {
    return new NextResponse("Esta oferta não está disponível.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const { context } = resolution;
  const [notices, disabled] = await Promise.all([listOfferPromotionNotices(context.offerId, context.clientId), loadDisabledDisplays(getAppSqlRunner())]);
  const withDisplay = lineSlugsWithDisplay(disabled);
  const siteUrl = getSiteUrl();
  const offerUrl = `${siteUrl}/b2b/oferta/${encodeURIComponent(token)}`;
  const minMax = (values: number[]) => (values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: null, max: null });

  const lines: OfferPdfLine[] = context.commercialGroups
    .map((group) => {
      const products = context.products.filter((product) => product.commercialGroupIds.includes(group.id));
      const b2b = minMax(products.map((product) => resolveB2BUnitPriceCents(product.b2cPriceCents, product.category)));
      const consumer = minMax(products.map((product) => product.b2cPriceCents));
      const notice = notices.find((item) => item.commercialGroupId === group.id) ?? null;
      const covered = notice && notice.productIds.length > 0 ? products.filter((product) => notice.productIds.includes(product.id)) : products;

      return {
        name: group.name,
        slug: group.slug,
        image: homeLineImage(group.slug),
        productCount: products.length,
        b2bMinCents: b2b.min,
        b2bMaxCents: b2b.max,
        consumerMinCents: consumer.min,
        consumerMaxCents: consumer.max,
        hasDisplay: withDisplay.has(group.slug),
        promotion:
          notice && covered.length > 0
            ? {
                buyQuantity: notice.buyQuantity,
                freeQuantity: notice.freeQuantity,
                percent: notice.percent,
                usesRemaining: notice.usesRemaining,
                validUntil: notice.validUntil,
                scopeText: notice.productIds.length > 0 ? describeScope(covered) : null,
                b2bMinCents: Math.min(...covered.map((product) => resolveB2BUnitPriceCents(product.b2cPriceCents, product.category))),
                consumerMinCents: Math.min(...covered.map((product) => product.b2cPriceCents)),
              }
            : null,
      };
    })
    .filter((line) => line.productCount > 0)
    // linhas com promoção primeiro (como no PDF modelo)
    .sort((a, b) => Number(Boolean(b.promotion)) - Number(Boolean(a.promotion)));

  const displayLine = lines.find((line) => line.hasDisplay && DISPLAY_BY_LINE[line.slug]);
  const html = buildOfferPdfHtml(
    {
      brand: "Bio Florais",
      siteUrl,
      offerUrl,
      clientName: context.clientDisplayName,
      sellerName: context.responsibleName,
      lead: "Florais brasileiros em gotas, sem álcool, desde 1997, com preço de lojista e promoções escolhidas para a sua loja.",
      lines,
      displayPhoto: displayLine ? displayPhotoUrl(DISPLAY_BY_LINE[displayLine.slug]) : null,
      conditions: {
        pixPercent: B2B_PAYMENT_METHOD_DISCOUNT_PERCENT.pix * 100,
        cardPercent: B2B_PAYMENT_METHOD_DISCOUNT_PERCENT.card * 100,
        maxInstallments: B2B_MAX_INSTALLMENTS,
        minInstallmentCents: B2B_MIN_INSTALLMENT_CENTS,
        boletoDays: B2B_BOLETO_DUE_DAYS,
        freeFreightCents: B2B_FREIGHT_FLAT_THRESHOLD_CENTS,
        minOrderCents: B2B_MIN_ORDER_CENTS,
      },
    },
    { autoPrint: new URL(request.url).searchParams.get("imprimir") !== "0" }
  );

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
