import { NextResponse } from "next/server";

import {
  bioProducts,
} from "@/lib/catalog/bio-products";

import {
  calculateSelectedOffers,
} from "@/lib/commerce/offers";

interface RequestItem {
  productSlug: string;
  qty: number;
}

interface RequestOffer {
  code: string;
  productSlugs: string[];
  qty: number;
}

interface QuoteRequest {
  items?: RequestItem[];
  offers?: RequestOffer[];
}

function money(value: number) {
  return Math.max(
    0,
    Math.round(value)
  );
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as QuoteRequest;

    const requestedItems =
      Array.isArray(body.items)
        ? body.items
        : [];

    const requestedOffers =
      Array.isArray(body.offers)
        ? body.offers
        : [];

    if (
      requestedItems.length === 0
    ) {
      return NextResponse.json({
        items: [],
        grossSubtotalCents: 0,
        offerDiscountCents: 0,
        promotionDiscountCents: 0,
        couponDiscountCents: 0,
        creditUsedCents: 0,
        shippingOriginalCents: 0,
        shippingSubsidyCents: 0,
        freeShippingDiscountCents: 0,
        totalCents: 0,
        offerBreakdown: [],
      });
    }

    const catalogBySlug =
      new Map(
        bioProducts.map(
          (product) => [
            product.slug,
            product,
          ]
        )
      );

    const resolvedItems =
      requestedItems.map(
        (requested) => {
          const product =
            catalogBySlug.get(
              requested.productSlug
            );

          if (!product) {
            throw new Error(
              `Produto inválido: ${requested.productSlug}`
            );
          }

          if (
            !Number.isInteger(
              requested.qty
            ) ||
            requested.qty <= 0
          ) {
            throw new Error(
              `Quantidade inválida: ${requested.productSlug}`
            );
          }

          if (
            product.priceCents == null
          ) {
            throw new Error(
              `Produto sem preço: ${requested.productSlug}`
            );
          }

          return {
            productSlug:
              product.slug,
            name:
              product.name,
            category:
              product.category ?? "",
            qty:
              requested.qty,
            unitPriceCents:
              product.priceCents,
            image:
              product.image ?? null,
          };
        }
      );

    const grossSubtotalCents =
      resolvedItems.reduce(
        (sum, item) =>
          sum +
          item.unitPriceCents *
            item.qty,
        0
      );

    const offerResult =
      calculateSelectedOffers(
        resolvedItems.map(
          (item) => ({
            productSlug:
              item.productSlug,
            name:
              item.name,
            category:
              item.category,
            qty:
              item.qty,
            unitPriceCents:
              item.unitPriceCents,
          })
        ),
        requestedOffers
      );

    const offerDiscountCents =
      money(
        offerResult.offerDiscountCents
      );

    /*
     * As próximas camadas permanecem
     * explicitamente separadas.
     *
     * Ainda NÃO estamos implantando
     * promoção, cupom, crédito ou frete
     * nesta etapa.
     */

    const promotionDiscountCents = 0;
    const couponDiscountCents = 0;
    const creditUsedCents = 0;

    const shippingOriginalCents = 0;
    const shippingSubsidyCents = 0;
    const freeShippingDiscountCents = 0;

    const totalCents =
      money(
        grossSubtotalCents -
          offerDiscountCents -
          promotionDiscountCents -
          couponDiscountCents -
          creditUsedCents +
          shippingOriginalCents -
          shippingSubsidyCents -
          freeShippingDiscountCents
      );

    return NextResponse.json({
      items:
        resolvedItems,
      grossSubtotalCents,
      offerDiscountCents,
      promotionDiscountCents,
      couponDiscountCents,
      creditUsedCents,
      shippingOriginalCents,
      shippingSubsidyCents,
      freeShippingDiscountCents,
      totalCents,
      offerBreakdown:
        offerResult.breakdown ?? [],
    });
  } catch (error) {
    console.error(
      "[BIO CART QUOTE]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular a sacola.",
      },
      {
        status: 400,
      }
    );
  }
}
