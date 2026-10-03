/**
 * BIO FLORAIS B2B — criação do pedido a partir do link de oferta.
 *
 * Separado de /api/orders/create (B2C, intocado nas regras). O servidor
 * recalcula tudo com computeB2BQuote (a mesma função da cotação do
 * checkout): preço B2B, mínimo, cupom b2b, promoção, frete real + regra
 * regional, e o total da forma de pagamento escolhida, que fica gravado
 * em orders.total_cents junto com orders.payment_method (trava).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  addresses,
  b2bOfferPromotions,
  b2bPromotions,
  couponRedemptions,
  coupons,
  customers,
  orderItems,
  orders,
} from "@/lib/db/schema";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { computeB2BQuote } from "@/lib/b2b/quote";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { buildOrderItemSnapshots } from "@/lib/b2b/order-commission";
import { commissionWindowForItem, loadClientPurchases, loadReconquistaMonths } from "@/lib/b2b/purchase-history";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import {
  isB2BInstallmentCountValid,
  isB2BPaymentMethod,
  resolveB2BPaymentMethodDiscountCents,
} from "@/lib/b2b/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateB2BOrderBody = {
  b2bToken?: string;
  customer?: {
    personType?: string;
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string;
    cnpj?: string;
    stateRegistration?: string;
  };
  address?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
  };
  items?: unknown;
  couponCode?: string | null;
  paymentMethod?: string;
  installments?: number;
  shipping?: { serviceName?: string };
};

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as CreateB2BOrderBody;

    const resolution = await loadPublicB2BOfferContext(body.b2bToken ?? "");

    if (!resolution.ok) {
      return badRequest("Este link de oferta não é mais válido.", 403);
    }

    const context = resolution.context;

    // ---- Comprador
    const personType = body.customer?.personType === "pj" ? "pj" : "pf";
    const name = text(body.customer?.name);
    const email = text(body.customer?.email).toLowerCase();
    const phone = onlyDigits(body.customer?.phone);
    const cpf = onlyDigits(body.customer?.cpf);
    const cnpj = onlyDigits(body.customer?.cnpj);
    const stateRegistration = text(body.customer?.stateRegistration);

    if (!name) return badRequest("Informe o nome/razão social.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Informe um e-mail válido.");
    if (phone.length < 10) return badRequest("Informe um celular válido.");
    if (personType === "pf" && cpf.length !== 11) return badRequest("Informe um CPF válido.");
    if (personType === "pj" && (cnpj.length !== 14 || !stateRegistration)) {
      return badRequest("Informe CNPJ e Inscrição Estadual válidos.");
    }

    // ---- Endereço
    const cep = onlyDigits(body.address?.cep);
    const street = text(body.address?.street);
    const number = text(body.address?.number);
    const complement = text(body.address?.complement) || null;
    const district = text(body.address?.district);
    const city = text(body.address?.city);
    const state = text(body.address?.state).toUpperCase();

    if (cep.length !== 8 || !street || !number || !district || !city || state.length !== 2) {
      return badRequest("Preencha corretamente o endereço de entrega.");
    }

    // ---- Forma de pagamento (trava do pedido)
    if (!isB2BPaymentMethod(body.paymentMethod)) {
      return badRequest("Escolha a forma de pagamento.");
    }

    const paymentMethod = body.paymentMethod;

    // Regra B2B: pessoa física paga só com Pix ou cartão.
    if (personType === "pf" && paymentMethod === "boleto") {
      return badRequest("Boleto disponível apenas para pessoa jurídica. Escolha Pix ou cartão.");
    }

    const chosenServiceName = text(body.shipping?.serviceName);

    if (!chosenServiceName) {
      return badRequest("Escolha uma opção de entrega antes de continuar.");
    }

    // ---- Recalcula tudo no servidor
    const result = await computeB2BQuote({
      context,
      items: body.items,
      cep,
      state,
      couponCode: body.couponCode,
      customerEmail: email,
    });

    if (!result.ok) {
      return badRequest(result.error, result.status);
    }

    const { quote } = result;

    const option = quote.options.find((item) => item.serviceName === chosenServiceName);

    if (!option) {
      return badRequest(
        "A opção de frete escolhida não é mais válida. Atualize a cotação e tente novamente.",
        409
      );
    }

    const totalCents = option.totalsByPaymentMethod[paymentMethod];
    const paymentMethodDiscountCents = resolveB2BPaymentMethodDiscountCents(
      quote.subtotalAfterCouponCents,
      paymentMethod
    );

    const installments = Number(body.installments ?? 1);

    if (
      paymentMethod !== "pix" &&
      !isB2BInstallmentCountValid(totalCents, installments)
    ) {
      return badRequest(
        "Número de parcelas inválido para este valor (parcela mínima R$ 500,00, máximo 3x)."
      );
    }

    // ---- Persistência
    const [customer] = await db
      .insert(customers)
      .values({
        personType,
        name,
        email,
        phone,
        cpf: personType === "pf" ? cpf : null,
        cnpj: personType === "pj" ? cnpj : null,
        stateRegistration: personType === "pj" ? stateRegistration : null,
      })
      .returning({ id: customers.id });

    const [address] = await db
      .insert(addresses)
      .values({
        customerId: customer.id,
        cep,
        street,
        number,
        complement,
        district,
        city,
        state,
      })
      .returning({ id: addresses.id });

    const commercialAdjustmentsJson = JSON.stringify({
      version: 1,
      storeKey: "bio-b2b",
      paymentMethod,
      installments: paymentMethod === "pix" ? 1 : installments,
      bonusLines: quote.bonusLines,
      shippingRealCents: option.realPriceCents,
    });

    const [order] = await db
      .insert(orders)
      .values({
        customerId: customer.id,
        shippingAddressId: address.id,
        shippingServiceName: option.serviceName,
        status: "pending",
        fulfillmentStatus: "awaiting_payment",
        subtotalCents: quote.subtotalCents,
        discountCents: quote.couponDiscountCents + paymentMethodDiscountCents,
        couponDiscountCents: quote.couponDiscountCents,
        couponCode: quote.couponCode,
        commercialAdjustmentsJson,
        shippingCents: option.priceCents,
        shippingCostCents: option.realPriceCents,
        totalCents,
        b2bClientId: context.clientId,
        b2bOfferId: context.offerId,
        b2bResponsibleId: context.responsibleId,
        b2bResponsibleType: context.responsibleType,
        b2bResponsibleName: context.responsibleName,
        paymentMethod,
        paymentMethodDiscountCents,
      })
      .returning({ id: orders.id });

    // Snapshot imutável por item: promoção aplicada e comissão do vendedor
    // (base + extra = total) congeladas no pedido. O cliente não vê isso.
    const runSql = getAppSqlRunner();
    const productIds = quote.lines.map((line) => line.productId);

    const [matrix, purchases, reconquistaMonths, groupRows, offerPromotionTerms] = await Promise.all([
      loadCommissionMatrix(runSql, context.responsibleId, context.clientId),
      // Janela de 180 dias por CLIENTE e LINHA (R4/R6), avaliada agora e congelada no item.
      loadClientPurchases(runSql, context.clientId),
      loadReconquistaMonths(runSql),
      runSql(
        `SELECT product_id, commercial_group_id FROM b2b_commercial_group_products WHERE product_id = ANY($1::uuid[])`,
        [productIds]
      ),
      db
        .select({
          promotionId: b2bOfferPromotions.promotionId,
          name: b2bPromotions.name,
          buyQuantity: b2bPromotions.buyQuantity,
          freeQuantity: b2bPromotions.freeQuantity,
          eligibilityMode: b2bOfferPromotions.eligibilityMode,
          maxUses: b2bOfferPromotions.maxUses,
          durationDays: b2bOfferPromotions.durationDays,
        })
        .from(b2bOfferPromotions)
        .innerJoin(b2bPromotions, eq(b2bPromotions.id, b2bOfferPromotions.promotionId))
        .where(eq(b2bOfferPromotions.offerId, context.offerId)),
    ]);

    const itemSnapshots = buildOrderItemSnapshots({
      matrix,
      offerPromotions: offerPromotionTerms,
      lines: quote.lines,
      bonusLines: quote.bonusLines,
      discountLines: quote.discountLines,
      window: (productId) => {
        const nowAt = new Date();
        const groups = groupRows
          .filter((row) => String(row.product_id) === productId)
          .map((row) => String(row.commercial_group_id));
        return commissionWindowForItem(purchases, groups, nowAt, reconquistaMonths);
      },
    });

    // Colunas novas são opcionais: se um SQL (13b commission_basis, 17b desconto %) ainda não
    // foi aplicado, o pedido é gravado sem elas em vez de falhar.
    // Nome COMPLETO do produto no item (product_name_snapshot, SQL 21b): é o que a central/Omie leem.
    const nameById = new Map(context.products.map((product) => [product.id, b2bProductLabel(product).full]));
    const withName = (item: (typeof itemSnapshots)[number]) => ({
      ...item,
      productNameSnapshot: nameById.get(item.productId) ?? null,
    });

    const attempts: Array<(item: (typeof itemSnapshots)[number]) => Record<string, unknown>> = [
      (item) => ({ orderId: order.id, ...withName(item) }),
      (item) => ({ orderId: order.id, ...item }),
      ({ promotionType: _t, promotionPercent: _p, promotionDiscountCents: _d, ...item }) => ({ orderId: order.id, ...item }),
      ({ promotionType: _t, promotionPercent: _p, promotionDiscountCents: _d, commissionBasis: _b, ...item }) => ({
        orderId: order.id,
        ...item,
      }),
    ];

    let inserted = false;

    for (const [index, toRow] of attempts.entries()) {
      try {
        await db.insert(orderItems).values(itemSnapshots.map((item) => toRow(item)) as never);
        inserted = true;
        break;
      } catch (error) {
        if (index === attempts.length - 1) throw error;
        console.error("[b2b/orders/create] coluna de snapshot ausente, tentando sem ela", error);
      }
    }

    if (!inserted) throw new Error("não foi possível gravar os itens do pedido");

    // Contador de usos 2x/3x agora é DINÂMICO (purchase-history.ts, R5): conta pedidos
    // que receberam a bonificação e contam como compra, mais a reserva de Pix/cartão
    // pendente < 60 min. Nada é gravado em b2b_offer_promotions.uses_count.

    /*
     * Mesmo momento do B2C (orders/create): o cupom é registrado na
     * criação; o finalizador do Mercado Pago encontra o registro e não
     * duplica.
     */
    if (quote.couponId && quote.couponCode) {
      await db.insert(couponRedemptions).values({
        couponId: quote.couponId,
        customerEmail: email,
        orderId: order.id,
        discountCents: quote.couponDiscountCents,
      });

      await db
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() })
        .where(eq(coupons.id, quote.couponId));
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: "pending",
        paymentMethod,
        installments: paymentMethod === "pix" ? 1 : installments,
        subtotalCents: quote.subtotalCents,
        couponDiscountCents: quote.couponDiscountCents,
        shippingCents: option.priceCents,
        totalCents,
      },
    });
  } catch (error) {
    console.error("[b2b/orders/create]", error);

    return NextResponse.json(
      { error: "Não foi possível criar o pedido neste momento." },
      { status: 500 }
    );
  }
}
