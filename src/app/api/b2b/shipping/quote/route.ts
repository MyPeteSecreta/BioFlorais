/**
 * BIO FLORAIS B2B — cotação exibida no checkout (não grava nada).
 * Mesma computeB2BQuote usada por /api/b2b/orders/create.
 */

import { NextRequest, NextResponse } from "next/server";

import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { computeB2BQuote } from "@/lib/b2b/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuoteBody = {
  b2bToken?: string;
  cep?: string;
  state?: string;
  couponCode?: string | null;
  items?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as QuoteBody;

    const resolution = await loadPublicB2BOfferContext(body.b2bToken ?? "");

    if (!resolution.ok) {
      return NextResponse.json(
        { error: "Este link de oferta não é mais válido." },
        { status: 403 }
      );
    }

    const result = await computeB2BQuote({
      context: resolution.context,
      items: body.items,
      cep: body.cep,
      state: body.state,
      couponCode: body.couponCode,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { quote } = result;

    // Só valores finais: o percentual de desconto por método nunca sai daqui.
    return NextResponse.json({
      couponCode: quote.couponCode,
      subtotalCents: quote.subtotalCents,
      couponDiscountCents: quote.couponDiscountCents,
      subtotalAfterCouponCents: quote.subtotalAfterCouponCents,
      bonusLines: quote.bonusLines.map((bonus) => ({
        productId: bonus.productId,
        qty: bonus.qty,
      })),
      // C3: preço B2B riscado x preço com desconto % por produto (o servidor é a fonte).
      discountLines: quote.lines
        .filter((line) => line.discountPercent)
        .map((line) => ({
          productId: line.productId,
          percent: line.discountPercent,
          listUnitPriceCents: line.listUnitPriceCents,
          unitPriceCents: line.unitPriceCents,
        })),
      options: quote.options.map((option) => ({
        serviceName: option.serviceName,
        etaDays: option.etaDays,
        priceCents: option.priceCents,
        totalsByPaymentMethod: option.totalsByPaymentMethod,
      })),
    });
  } catch (error) {
    console.error("[b2b/shipping/quote]", error);

    return NextResponse.json(
      { error: "Não foi possível cotar o frete agora. Tente novamente." },
      { status: 500 }
    );
  }
}
