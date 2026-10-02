/**
 * BIO FLORAIS B2B — cotação autoritativa do carrinho.
 *
 * ÚNICA implementação de preço + mínimo + cupom + promoção + frete,
 * usada por /api/b2b/shipping/quote (o que o checkout mostra) e por
 * /api/b2b/orders/create (o que é gravado e cobrado). O navegador só
 * envia productId/qty, CEP/UF, código do cupom e o nome da modalidade.
 */

import { inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import type { PublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { resolveB2BCouponDiscount } from "@/lib/b2b/coupon-resolver";
import {
  resolveB2BPromotionBonusLines,
  type B2BPromotionBonusLine,
} from "@/lib/b2b/promotion-resolver";
import {
  B2B_MIN_ORDER_CENTS,
  applyB2BCheapestModalityRule,
  isB2BOrderAboveMinimum,
  resolveB2BOrderTotalsByPaymentMethod,
  resolveB2BUnitPriceCents,
  type B2BPaymentMethod,
} from "@/lib/b2b/pricing";
import { verifyCepMatchesState } from "@/lib/shipping/cep-lookup";
import { melhorEnvioProvider } from "@/lib/shipping/melhorenvio";
import { loadOtherLineProducts } from "@/lib/b2b/line-views";
import type { ShippingItem } from "@/lib/shipping/types";

export type B2BQuoteInput = {
  context: PublicB2BOfferContext;
  items: unknown;
  cep: unknown;
  state: unknown;
  couponCode: unknown;
  customerEmail?: string;
};

export type B2BQuoteLine = {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPriceCents: number;
};

export type B2BQuoteShippingOption = {
  serviceName: string;
  etaDays: number;
  /** Valor cobrado (regra regional + eventual cupom de teste). */
  priceCents: number;
  /** Custo real cotado no Melhor Envio. */
  realPriceCents: number;
  totalsByPaymentMethod: Record<B2BPaymentMethod, number>;
};

export type B2BQuote = {
  cep: string;
  state: string;
  lines: B2BQuoteLine[];
  bonusLines: B2BPromotionBonusLine[];
  promotionIdsUsed: string[];
  subtotalCents: number;
  couponId: string | null;
  couponCode: string | null;
  couponDiscountCents: number;
  subtotalAfterCouponCents: number;
  options: B2BQuoteShippingOption[];
};

export type B2BQuoteResult =
  | { ok: true; quote: B2BQuote }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): B2BQuoteResult {
  return { ok: false, status, error };
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatCents(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function computeB2BQuote(input: B2BQuoteInput): Promise<B2BQuoteResult> {
  const { context } = input;

  const cep = onlyDigits(input.cep);
  const state = String(input.state ?? "").trim().toUpperCase();

  if (cep.length !== 8 || !/^[A-Z]{2}$/.test(state)) {
    return fail(400, "Informe um CEP e um estado válidos.");
  }

  // ---- Itens: só produtos da oferta, qty inteira positiva, sem duplicar.
  const rawItems = Array.isArray(input.items) ? input.items : [];

  if (rawItems.length === 0) {
    return fail(400, "O carrinho está vazio.");
  }

  // Produtos da oferta + das outras linhas B2B (preço B2B normal, sem
  // promoção: o motor de promoção abaixo recebe só context.products).
  const otherLineProducts = await loadOtherLineProducts(context);
  const allowed = new Map(
    [...context.products, ...otherLineProducts].map((product) => [product.id, product])
  );
  const qtyByProductId = new Map<string, number>();

  for (const raw of rawItems) {
    const item = (raw ?? {}) as { productId?: unknown; qty?: unknown };
    const productId = String(item.productId ?? "").trim();
    const qty = Number(item.qty);

    if (!productId || !Number.isInteger(qty) || qty <= 0 || qty > 10_000) {
      return fail(400, "Há itens inválidos no carrinho.");
    }

    if (!allowed.has(productId)) {
      return fail(400, "Um ou mais produtos não fazem parte desta oferta B2B.");
    }

    qtyByProductId.set(productId, (qtyByProductId.get(productId) ?? 0) + qty);
  }

  const lines: B2BQuoteLine[] = Array.from(qtyByProductId.entries()).map(
    ([productId, qty]) => {
      const product = allowed.get(productId)!;

      return {
        productId,
        slug: product.slug,
        name: product.name,
        qty,
        unitPriceCents: resolveB2BUnitPriceCents(product.b2cPriceCents, product.category),
      };
    }
  );

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.qty,
    0
  );

  if (!isB2BOrderAboveMinimum(subtotalCents)) {
    return fail(
      400,
      `O pedido mínimo B2B é de R$ ${formatCents(B2B_MIN_ORDER_CENTS)} em produtos.`
    );
  }

  // ---- Cupom B2B (scope='b2b').
  const coupon = await resolveB2BCouponDiscount(
    typeof input.couponCode === "string" ? input.couponCode : null,
    subtotalCents,
    input.customerEmail
  );

  if (!coupon.ok) {
    return fail(coupon.status, coupon.message);
  }

  const subtotalAfterCouponCents = Math.max(0, subtotalCents - coupon.couponDiscountCents);

  // ---- Promoção "leve Y grátis": bônus sem preço, mas pesa no frete.
  const { bonusLines, promotionIdsUsed } = await resolveB2BPromotionBonusLines(
    context.offerId,
    context.products,
    lines,
    context.clientId
  );

  const bonusByProductId = new Map<string, number>();
  for (const bonus of bonusLines) {
    bonusByProductId.set(
      bonus.productId,
      (bonusByProductId.get(bonus.productId) ?? 0) + bonus.qty
    );
  }

  // ---- UF conferida pelo CEP no servidor.
  const cepCheck = await verifyCepMatchesState(cep, state);

  if (cepCheck.verified && !cepCheck.matches) {
    return fail(
      400,
      "O estado informado não corresponde ao CEP. Verifique o endereço de entrega."
    );
  }

  // Sem conferência (ViaCEP fora do ar) a tarifa regional não é concedida.
  const verifiedState = cepCheck.verified ? cepCheck.resolvedUf : "";

  // ---- Frete real (Melhor Envio).
  const dimensionRows = await db
    .select({
      id: products.id,
      weightGrams: products.weightGrams,
      lengthCm: products.lengthCm,
      widthCm: products.widthCm,
      heightCm: products.heightCm,
    })
    .from(products)
    .where(inArray(products.id, lines.map((line) => line.productId)));

  const dimensionsById = new Map(dimensionRows.map((row) => [row.id, row]));
  const shippingItems: ShippingItem[] = [];

  for (const line of lines) {
    const dims = dimensionsById.get(line.productId);

    if (!dims || !dims.weightGrams || !dims.lengthCm || !dims.widthCm || !dims.heightCm) {
      return fail(400, "Peso ou dimensões não cadastrados para um dos produtos desta oferta.");
    }

    shippingItems.push({
      productSlug: line.slug,
      qty: line.qty + (bonusByProductId.get(line.productId) ?? 0),
      weightGrams: dims.weightGrams,
      lengthCm: dims.lengthCm,
      widthCm: dims.widthCm,
      heightCm: dims.heightCm,
    });
  }

  const realOptions = await melhorEnvioProvider.calculate(cep, shippingItems);

  if (realOptions.length === 0) {
    return fail(400, "Nenhuma opção de frete disponível para este endereço no momento.");
  }

  const options = applyB2BCheapestModalityRule(
    realOptions,
    subtotalAfterCouponCents,
    verifiedState
  ).map((option) => {
    const priceCents =
      coupon.shippingDiscountPercent > 0
        ? Math.max(
            0,
            option.priceCents -
              Math.round(option.priceCents * (coupon.shippingDiscountPercent / 100))
          )
        : option.priceCents;

    return {
      serviceName: option.serviceName,
      etaDays: option.etaDays,
      priceCents,
      realPriceCents: option.realPriceCents,
      totalsByPaymentMethod: resolveB2BOrderTotalsByPaymentMethod(
        subtotalAfterCouponCents,
        priceCents
      ),
    };
  });

  return {
    ok: true,
    quote: {
      cep,
      state,
      lines,
      bonusLines,
      promotionIdsUsed,
      subtotalCents,
      couponId: coupon.couponId,
      couponCode: coupon.couponCode,
      couponDiscountCents: coupon.couponDiscountCents,
      subtotalAfterCouponCents,
      options,
    },
  };
}
