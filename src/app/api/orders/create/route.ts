import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  eq,
  inArray,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db/client";

import { validatePartnerCoupon } from "@/lib/partners/academia";

import {
  melhorEnvioProvider,
} from "@/lib/shipping/melhorenvio";

import {
  calculateSelectedOffers,
  type SelectedOfferInput,
} from "@/lib/commerce/offers";

import {
  addresses,
  couponRedemptions,
  coupons,
  customers,
  orderItems,
  orders,
  products,
} from "@/lib/db/schema";

type RequestBody = {
  customer?: {
    personType?: "pf" | "pj";
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

  items?: Array<{
    productSlug?: string;
    qty?: number;
  }>;

  /*
   * O navegador informa somente a oferta escolhida.
   * Preço e percentual nunca vêm do cliente.
   */
  offers?: SelectedOfferInput[];

  /*
   * O navegador escolhe a modalidade.
   * O preco sera recalculado no servidor.
   */
  shippingServiceId?: string | number | null;
  shippingServiceName?: string | null;

  couponCode?: string | null;
  partnerCouponCode?: string | null;
};

function clean(
  value?: string | null
) {
  return value?.trim() ?? "";
}

function onlyDigits(
  value?: string | null
) {
  return clean(value).replace(/\D/g, "");
}

async function resolveCoupon(
  codeInput: string | null | undefined,
  subtotalCents: number,
  customerEmail: string
) {
  const code =
    clean(codeInput).toUpperCase();

  if (!code) {
    return null;
  }

  const rows =
    await db
      .select()
      .from(coupons)
      .where(
        eq(coupons.code, code)
      )
      .limit(1);

  const coupon = rows[0];

  if (!coupon) {
    throw new Error(
      `Cupom ${code} nao encontrado.`
    );
  }

  const couponType =
    coupon.couponType === "partner"
      ? "partner"
      : "normal";

  if (couponType !== "normal") {
    throw new Error(
      "O cupom informado nao e um cupom comercial."
    );
  }

  if (!coupon.active) {
    throw new Error(
      `Cupom ${code} esta inativo.`
    );
  }

  const now = new Date();

  if (
    coupon.startsAt &&
    coupon.startsAt > now
  ) {
    throw new Error(
      `Cupom ${code} ainda nao esta vigente.`
    );
  }

  if (
    coupon.expiresAt &&
    coupon.expiresAt < now
  ) {
    throw new Error(
      `Cupom ${code} expirou.`
    );
  }

  if (
    coupon.maxUses !== null &&
    coupon.usedCount >= coupon.maxUses
  ) {
    throw new Error(
      `Cupom ${code} atingiu o limite de usos.`
    );
  }

  if (
    subtotalCents <
    coupon.minSubtotalCents
  ) {
    throw new Error(
      `Cupom ${code} exige subtotal minimo maior.`
    );
  }

  if (
    coupon.onePerCustomer &&
    customerEmail
  ) {
    const previousRedemption =
      await db
        .select({
          id:
            couponRedemptions.id,
        })
        .from(couponRedemptions)
        .where(
          and(
            eq(
              couponRedemptions.couponId,
              coupon.id
            ),
            eq(
              couponRedemptions.customerEmail,
              customerEmail
            )
          )
        )
        .limit(1);

    if (previousRedemption.length > 0) {
      throw new Error(
        `Cupom ${code} ja foi utilizado por este cliente.`
      );
    }
  }

  let discountCents = 0;

  if (
    coupon.discountType === "percentage"
  ) {
    discountCents =
      Math.round(
        subtotalCents *
          (coupon.discountValue / 100)
      );
  } else {
    discountCents =
      coupon.discountValue;
  }

  discountCents =
    Math.max(
      0,
      Math.min(
        subtotalCents,
        discountCents
      )
    );

  return {
    id: coupon.id,
    code,
    couponType: "normal" as const,
    discountCents,
  };
}

async function resolvePartnerCoupon(
  codeInput: string | null | undefined,
  subtotalCents: number
) {
  const code =
    clean(codeInput).toUpperCase();

  if (!code) {
    return null;
  }

  const validated =
    await validatePartnerCoupon(
      code,
      subtotalCents
    );

  if (!validated) {
    throw new Error(
      `Cupom UGC/parceira ${code} invalido ou indisponivel.`
    );
  }

  const discountCents =
    Math.max(
      0,
      Math.min(
        subtotalCents,
        Math.round(
          subtotalCents *
            (validated.discountPercent / 100)
        )
      )
    );

  return {
    code: validated.code,
    couponType: "partner" as const,
    partnerId: validated.partnerId,
    commissionPercent:
      validated.commissionPercent,
    campaign:
      validated.campaign,
    startsAt:
      validated.startsAt,
    expiresAt:
      validated.expiresAt,
    discountCents,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as RequestBody;

    const customer =
      body.customer;

    const address =
      body.address;

    const requestedItems =
      body.items ?? [];

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "Dados do cliente não informados.",
        },
        { status: 400 }
      );
    }

    const personType =
      customer.personType === "pj"
        ? "pj"
        : "pf";

    const name =
      clean(customer.name);

    const email =
      clean(customer.email)
        .toLowerCase();

    const phone =
      onlyDigits(customer.phone);

    const cpf =
      onlyDigits(customer.cpf);

    const cnpj =
      onlyDigits(customer.cnpj);

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Informe o nome do cliente.",
        },
        { status: 400 }
      );
    }

    if (
      !email ||
      !email.includes("@")
    ) {
      return NextResponse.json(
        {
          error:
            "Informe um e-mail válido.",
        },
        { status: 400 }
      );
    }

    if (
      personType === "pf" &&
      cpf.length !== 11
    ) {
      return NextResponse.json(
        {
          error:
            "Informe um CPF válido.",
        },
        { status: 400 }
      );
    }

    if (
      personType === "pj" &&
      cnpj.length !== 14
    ) {
      return NextResponse.json(
        {
          error:
            "Informe um CNPJ válido.",
        },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        {
          error:
            "Endereço não informado.",
        },
        { status: 400 }
      );
    }

    const cep =
      onlyDigits(address.cep);

    const street =
      clean(address.street);

    const number =
      clean(address.number);

    const district =
      clean(address.district);

    const city =
      clean(address.city);

    const state =
      clean(address.state)
        .toUpperCase();

    if (
      cep.length !== 8 ||
      !street ||
      !number ||
      !district ||
      !city ||
      state.length !== 2
    ) {
      return NextResponse.json(
        {
          error:
            "Preencha corretamente o endereço de entrega.",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(requestedItems) ||
      requestedItems.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "O pedido não possui produtos.",
        },
        { status: 400 }
      );
    }

    const normalizedItems =
      requestedItems.map(
        (item) => ({
          productSlug:
            clean(item.productSlug),

          qty:
            Number.isInteger(
              item.qty
            ) &&
            Number(item.qty) > 0
              ? Number(item.qty)
              : 0,
        })
      );

    if (
      normalizedItems.some(
        (item) =>
          !item.productSlug ||
          item.qty <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Há produtos inválidos no pedido.",
        },
        { status: 400 }
      );
    }

    const slugs =
      [
        ...new Set(
          normalizedItems.map(
            (item) =>
              item.productSlug
          )
        ),
      ];

    const dbProducts =
      await db
        .select()
        .from(products)
        .where(
          inArray(
            products.slug,
            slugs
          )
        );

    if (
      dbProducts.length !==
      slugs.length
    ) {
      return NextResponse.json(
        {
          error:
            "Um ou mais produtos não foram encontrados.",
        },
        { status: 400 }
      );
    }

    const productMap =
      new Map(
        dbProducts.map(
          (product) => [
            product.slug,
            product,
          ]
        )
      );

    const finalItems =
      normalizedItems.map(
        (item) => {
          const product =
            productMap.get(
              item.productSlug
            );

          if (
            !product ||
            !product.active
          ) {
            throw new Error(
              `Produto indisponível: ${item.productSlug}`
            );
          }

          return {
            product,
            qty:
              item.qty,
          };
        }
      );

    /*
     * ======================================================
     * ORDEM COMERCIAL BIO
     *
     * 1. preços-base Neon
     * 2. ofertas/combos
     * 3. promoções
     * 4. cupom
     * 5. crédito UGC
     * 6. frete
     * 7. pagamento
     * ======================================================
     */

    const selectedOffers =
      Array.isArray(body.offers)
        ? body.offers
        : [];

    const offerResult =
      calculateSelectedOffers(
        finalItems.map(
          ({ product, qty }) => ({
            productSlug:
              product.slug,

            name:
              product.name,

            category:
              product.category,

            qty,

            unitPriceCents:
              product.priceCents,
          })
        ),

        selectedOffers
      );

    /*
     * SUBTOTAL É SEMPRE BRUTO.
     */
    const subtotalCents =
      offerResult
        .grossSubtotalCents;

    const offerDiscountCents =
      offerResult
        .offerDiscountCents;

    /*
     * Camadas preparadas.
     * Ainda sem regra ativa nesta etapa.
     */
    const promotionDiscountCents = 0;
    const creditCents = 0;

    /*
     * ======================================================
     * FRETE AUTORITATIVO BIO
     *
     * O navegador NAO informa preco.
     * O servidor consulta novamente o Melhor Envio.
     * ======================================================
     */

    const shippingItems =
      finalItems.map(
        ({ product, qty }) => {

          if (
            !product.weightGrams ||
            !product.lengthCm ||
            !product.widthCm ||
            !product.heightCm
          ) {
            throw new Error(
              `Peso ou dimensoes nao cadastrados para ${product.slug}.`
            );
          }

          return {
            productSlug:
              product.slug,

            qty,

            weightGrams:
              product.weightGrams,

            lengthCm:
              product.lengthCm,

            widthCm:
              product.widthCm,

            heightCm:
              product.heightCm,
          };
        }
      );

    const shippingOptions =
      await melhorEnvioProvider.calculate(
        cep,
        shippingItems
      );

    if (
      !Array.isArray(shippingOptions) ||
      shippingOptions.length === 0
    ) {
      throw new Error(
        "Nenhuma modalidade de frete disponivel para este CEP."
      );
    }

    const requestedShippingId =
      clean(
        body.shippingServiceId === null ||
        body.shippingServiceId === undefined
          ? ""
          : String(body.shippingServiceId)
      );

    const requestedShippingName =
      clean(
        body.shippingServiceName
      ).toLowerCase();

    if (
      !requestedShippingId &&
      !requestedShippingName
    ) {
      throw new Error(
        "Selecione uma modalidade de entrega."
      );
    }

    /*
     * O provider pode representar a modalidade por id
     * ou pelo nome. Comparamos ambos sem confiar em preco.
     */
    const selectedShipping =
      shippingOptions.find(
        (option) => {

          const optionRecord =
            option as unknown as Record<
              string,
              unknown
            >;

          const optionId =
            clean(
              optionRecord.id === null ||
              optionRecord.id === undefined
                ? ""
                : String(optionRecord.id)
            );

          const optionName =
            clean(
              optionRecord.name === null ||
              optionRecord.name === undefined
                ? ""
                : String(optionRecord.name)
            ).toLowerCase();

          const optionServiceName =
            clean(
              optionRecord.serviceName === null ||
              optionRecord.serviceName === undefined
                ? ""
                : String(optionRecord.serviceName)
            ).toLowerCase();

          return (
            (
              requestedShippingId &&
              optionId === requestedShippingId
            ) ||
            (
              requestedShippingName &&
              (
                optionName === requestedShippingName ||
                optionServiceName === requestedShippingName
              )
            )
          );
        }
      );

    if (!selectedShipping) {
      throw new Error(
        "A modalidade de frete selecionada nao esta mais disponivel."
      );
    }

    function readShippingPriceCents(
      option: unknown
    ) {
      const record =
        option as Record<
          string,
          unknown
        >;

      /*
       * O provider Bio pode devolver preco ja em centavos
       * ou valor decimal. Primeiro priorizamos priceCents.
       */
      const centsCandidate =
        Number(
          record.priceCents
        );

      if (
        Number.isInteger(centsCandidate) &&
        centsCandidate >= 0
      ) {
        return centsCandidate;
      }

      const raw =
        record.price ??
        record.customPrice ??
        record.value;

      const numeric =
        typeof raw === "string"
          ? Number(
              raw
                .replace(",", ".")
            )
          : Number(raw);

      if (
        !Number.isFinite(numeric) ||
        numeric < 0
      ) {
        throw new Error(
          "O Melhor Envio retornou uma modalidade sem preco valido."
        );
      }

      return Math.round(
        numeric * 100
      );
    }

    const pricedShippingOptions =
      shippingOptions.map(
        (option) => ({
          option,
          fullPriceCents:
            readShippingPriceCents(
              option
            ),
        })
      );

    const cheapestShippingCents =
      Math.min(
        ...pricedShippingOptions.map(
          (item) =>
            item.fullPriceCents
        )
      );

    const shippingCostCents =
      readShippingPriceCents(
        selectedShipping
      );

    /*
     * Regra comercial Bio aprovada:
     *
     * abaixo de R$ 100:
     * beneficio = 25% do frete escolhido.
     *
     * R$ 100 ou mais:
     * - modalidade mais barata = gratis;
     * - demais modalidades recebem beneficio
     *   de 50% do valor cheio da mais barata.
     *
     * O limite usa o valor da mercadoria antes
     * dos cupons, preservando a regra atual.
     */
    const qualifiesForFreeShipping =
      subtotalCents >= 10000;

    let shippingSubsidyCents = 0;
    let freeShippingDiscountCents = 0;
    let shippingCents = 0;

    if (!qualifiesForFreeShipping) {

      shippingSubsidyCents =
        Math.round(
          shippingCostCents * 0.25
        );

      shippingCents =
        Math.max(
          0,
          shippingCostCents -
            shippingSubsidyCents
        );

    } else if (
      shippingCostCents ===
      cheapestShippingCents
    ) {

      freeShippingDiscountCents =
        shippingCostCents;

      shippingCents = 0;

    } else {

      shippingSubsidyCents =
        Math.round(
          cheapestShippingCents * 0.5
        );

      shippingCents =
        Math.max(
          0,
          shippingCostCents -
            shippingSubsidyCents
        );
    }

    const couponBaseCents =
      Math.max(
        0,
        subtotalCents -
          offerDiscountCents -
          promotionDiscountCents
      );

    /*
     * Cupom comercial primeiro.
     */
    const commercialCoupon =
      await resolveCoupon(
        body.couponCode,
        couponBaseCents,
        email
      );

    const couponDiscountCents =
      commercialCoupon?.discountCents ?? 0;

    /*
     * Cupom UGC depois do comercial.
     */
    const partnerCouponBaseCents =
      Math.max(
        0,
        couponBaseCents -
          couponDiscountCents
      );

    const partnerCoupon =
      await resolvePartnerCoupon(
        body.partnerCouponCode,
        partnerCouponBaseCents
      );

    const partnerCouponDiscountCents =
      partnerCoupon?.discountCents ?? 0;

    const partnerCommissionPercent =
      partnerCoupon?.commissionPercent ?? 0;

    /*
     * Base da comissao:
     * mercadoria liquida dos descontos.
     * Frete nao participa.
     */
    const partnerCommissionBaseCents =
      Math.max(
        0,
        partnerCouponBaseCents -
          partnerCouponDiscountCents
      );

    const partnerCommissionCents =
      partnerCoupon
        ? Math.round(
            partnerCommissionBaseCents *
              (partnerCommissionPercent / 100)
          )
        : 0;

    const discountCents =
      offerDiscountCents +
      promotionDiscountCents +
      couponDiscountCents +
      partnerCouponDiscountCents +
      creditCents;

    const totalCents =
      Math.max(
        0,
        subtotalCents -
          offerDiscountCents -
          promotionDiscountCents -
          couponDiscountCents -
          partnerCouponDiscountCents -
          creditCents +
          shippingCents
      );
const commercialAdjustmentsJson =
      JSON.stringify({
        storeKey: "bio",

        offers:
          offerResult.breakdown,

        promotionDiscountCents,

        couponCode:
          commercialCoupon?.code ?? null,
        couponDiscountCents,

        partnerCouponCode:
          partnerCoupon?.code ?? null,
        partnerCouponDiscountCents,

        partnerId:
          partnerCoupon?.partnerId ?? null,

        partnerCommissionPercent,
        partnerCommissionBaseCents,
        partnerCommissionCents,

        creditCents,

        shippingSubsidyCents,
        freeShippingDiscountCents,
      });

    const customerRows =
      await db
        .insert(customers)
        .values({
          personType,
          name,
          email,
          phone:
            phone || null,

          cpf:
            personType === "pf"
              ? cpf
              : null,

          cnpj:
            personType === "pj"
              ? cnpj
              : null,

          stateRegistration:
            personType === "pj"
              ? clean(
                  customer.stateRegistration
                ) || null
              : null,
        })
        .returning({
          id:
            customers.id,
        });

    const customerId =
      customerRows[0]?.id;

    if (!customerId) {
      throw new Error(
        "Cliente não pôde ser criado."
      );
    }

    const addressRows =
      await db
        .insert(addresses)
        .values({
          customerId,

          cep,
          street,
          number,

          complement:
            clean(
              address.complement
            ) || null,

          district,
          city,
          state,
        })
        .returning({
          id:
            addresses.id,
        });

    const shippingAddressId =
      addressRows[0]?.id;

    if (!shippingAddressId) {
      throw new Error(
        "Endereço não pôde ser criado."
      );
    }

    const orderRows =
      await db
        .insert(orders)
        .values({
          customerId,
          shippingAddressId,

          status:
            "pending",

          fulfillmentStatus:
            "awaiting_payment",

          subtotalCents,

          discountCents,

          offerDiscountCents,
          promotionDiscountCents,

          couponDiscountCents,

          couponCode:
            commercialCoupon?.code ?? null,

          partnerCouponDiscountCents,

          partnerCouponCode:
            partnerCoupon?.code ?? null,

          partnerId:
            partnerCoupon?.partnerId ?? null,

          partnerCommissionPercent,
          partnerCommissionCents,

          partnerCommissionStatus:
            partnerCoupon
              ? "pending_payment"
              : null,

          creditCents,

          commercialAdjustmentsJson,

          shippingSubsidyCents,
          freeShippingDiscountCents,

          shippingCents,
          shippingCostCents,

          totalCents,
        })
        .returning({
          id:
            orders.id,

          status:
            orders.status,

          totalCents:
            orders.totalCents,
        });

    const order =
      orderRows[0];

    if (!order) {
      throw new Error(
        "Pedido não pôde ser criado."
      );
    }

    await db
      .insert(orderItems)
      .values(
        finalItems.map(
          ({
            product,
            qty,
          }) => ({
            orderId:
              order.id,

            productId:
              product.id,

            qty,

            unitPriceCents:
              product.priceCents,
          })
        )
      );

    /*
     * Persistencia do uso dos cupons.
     */
    if (commercialCoupon) {

      await db
        .insert(couponRedemptions)
        .values({
          couponId:
            commercialCoupon.id,

          customerEmail:
            email,

          orderId:
            order.id,

          discountCents:
            couponDiscountCents,
        });

      await db
        .update(coupons)
        .set({
          usedCount:
            sql`${coupons.usedCount} + 1`,
        })
        .where(
          eq(
            coupons.id,
            commercialCoupon.id
          )
        );
    }


    return NextResponse.json({
      success: true,

      order: {
        id:
          order.id,

        status:
          order.status,

        subtotalCents,

        offerDiscountCents,
        promotionDiscountCents,

        couponCode:
          commercialCoupon?.code ?? null,
        couponDiscountCents,

        partnerCouponCode:
          partnerCoupon?.code ?? null,
        partnerCouponDiscountCents,

        partnerId:
          partnerCoupon?.partnerId ?? null,

        partnerCommissionPercent,
        partnerCommissionBaseCents,
        partnerCommissionCents,

        creditCents,

        discountCents,

        offerBreakdown:
          offerResult.breakdown,

        shippingSubsidyCents,
        freeShippingDiscountCents,

        shippingCents,
        shippingCostCents,

        totalCents:
          order.totalCents,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao criar pedido Bio Florais:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o pedido.",
      },
      { status: 500 }
    );
  }
}


