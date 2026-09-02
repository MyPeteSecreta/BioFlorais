import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * ============================================================
 * PRODUTOS
 * ============================================================
 */

export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    slug: text("slug")
      .notNull()
      .unique(),

    name: text("name")
      .notNull(),

    lineSlug:
      text("line_slug"),

    category:
      text("category"),

    priceCents:
      integer("price_cents")
        .notNull(),

    weightGrams:
      integer("weight_grams"),

    lengthCm:
      integer("length_cm"),

    widthCm:
      integer("width_cm"),

    heightCm:
      integer("height_cm"),

    active:
      boolean("active")
        .notNull()
        .default(true),

    imageUrl:
      text("image_url"),

    createdAt:
      timestamp("created_at")
        .defaultNow(),
  }
);

/*
 * ============================================================
 * CLIENTES
 * ============================================================
 */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    personType:
      text("person_type")
        .notNull()
        .default("pf"),

    name:
      text("name")
        .notNull(),

    email:
      text("email")
        .notNull(),

    phone:
      text("phone"),

    cpf:
      text("cpf"),

    cnpj:
      text("cnpj"),

    stateRegistration:
      text("state_registration"),

    createdAt:
      timestamp("created_at")
        .defaultNow(),
  }
);

/*
 * ============================================================
 * ENDEREÃƒÆ’Ã¢â‚¬Â¡OS
 * ============================================================
 */

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    customerId:
      uuid("customer_id")
        .references(
          () => customers.id
        )
        .notNull(),

    cep:
      text("cep")
        .notNull(),

    street:
      text("street")
        .notNull(),

    number:
      text("number")
        .notNull(),

    complement:
      text("complement"),

    district:
      text("district")
        .notNull(),

    city:
      text("city")
        .notNull(),

    state:
      text("state")
        .notNull(),

    createdAt:
      timestamp("created_at")
        .defaultNow(),
  }
);

/*
 * ============================================================
 * PEDIDOS
 * ============================================================
 */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    customerId:
      uuid("customer_id")
        .references(
          () => customers.id
        )
        .notNull(),

    shippingAddressId:
      uuid("shipping_address_id")
        .references(
          () => addresses.id
        )
        .notNull(),

    status:
      text("status")
        .notNull()
        .default("pending"),

    fulfillmentStatus:
      text("fulfillment_status")
        .notNull()
        .default("awaiting_payment"),

    subtotalCents:
      integer("subtotal_cents")
        .notNull(),

    /*
     * Total agregado mantido por compatibilidade.
     */
    discountCents:
      integer("discount_cents")
        .notNull()
        .default(0),

    /*
     * Componentes comerciais separados.
     */
    offerDiscountCents:
      integer("offer_discount_cents")
        .notNull()
        .default(0),

    promotionDiscountCents:
      integer("promotion_discount_cents")
        .notNull()
        .default(0),

    couponDiscountCents:
      integer("coupon_discount_cents")
        .notNull()
        .default(0),

    creditCents:
      integer("credit_cents")
        .notNull()
        .default(0),

    commercialAdjustmentsJson:
      text("commercial_adjustments_json"),

    couponCode:
      text("coupon_code"),

    /*
     * Cupom de parceira / UGC separado do cupom comercial.
     */
    partnerCouponCode:
      text("partner_coupon_code"),

    partnerCouponDiscountCents:
      integer("partner_coupon_discount_cents")
        .notNull()
        .default(0),

    /*
     * Identificacao da parceira responsavel pela venda.
     * Mantido como text para compatibilidade com o portal
     * central de afiliadas / UGC.
     */
    partnerId:
      text("partner_id"),

    partnerCommissionPercent:
      integer("partner_commission_percent")
        .notNull()
        .default(0),

    partnerCommissionCents:
      integer("partner_commission_cents")
        .notNull()
        .default(0),

    /*
     * A comissao nasce pendente.
     * A liberacao ocorrera posteriormente conforme pagamento,
     * cancelamento, reembolso e prazo comercial aplicavel.
     */
    partnerCommissionStatus:
      text("partner_commission_status"),

    shippingSubsidyCents:
      integer("shipping_subsidy_cents")
        .notNull()
        .default(0),

    freeShippingDiscountCents:
      integer("free_shipping_discount_cents")
        .notNull()
        .default(0),

    shippingCents:
      integer("shipping_cents")
        .notNull()
        .default(0),

    shippingCostCents:
      integer("shipping_cost_cents")
        .notNull()
        .default(0),

    totalCents:
      integer("total_cents")
        .notNull(),

    createdAt:
      timestamp("created_at")
        .defaultNow(),
  }
);

/*
 * ============================================================
 * ITENS DO PEDIDO
 * ============================================================
 */

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    orderId:
      uuid("order_id")
        .references(
          () => orders.id
        )
        .notNull(),

    productId:
      uuid("product_id")
        .references(
          () => products.id
        )
        .notNull(),

    qty:
      integer("qty")
        .notNull(),

    unitPriceCents:
      integer("unit_price_cents")
        .notNull(),
  }
);

/*
 * ============================================================
 * PAGAMENTOS
 * ============================================================
 */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    orderId:
      uuid("order_id")
        .references(
          () => orders.id
        )
        .notNull(),

    provider:
      text("provider")
        .notNull()
        .default("pixgo"),

    externalId:
      text("external_id"),

    method:
      text("method"),

    status:
      text("status")
        .notNull()
        .default("pending"),

    rawPayload:
      jsonb("raw_payload"),

    createdAt:
      timestamp("created_at")
        .defaultNow(),
  }
);

// ---------------------------------------------------------------------------
// Integracao Omie - controle de exportacoes
// ---------------------------------------------------------------------------

export const omieExportBatches = pgTable(
  "omie_export_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    type: text("type").notNull(),

    code: text("code")
      .notNull()
      .unique(),

    status: text("status")
      .notNull()
      .default("generated"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    confirmedAt: timestamp("confirmed_at"),

    cancelledAt: timestamp("cancelled_at"),
  }
);

export const omieExportItems = pgTable(
  "omie_export_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    batchId: uuid("batch_id")
      .references(() => omieExportBatches.id)
      .notNull(),

    entityType: text("entity_type").notNull(),

    entityId: uuid("entity_id").notNull(),

    status: text("status")
      .notNull()
      .default("generated"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    confirmedAt: timestamp("confirmed_at"),

    errorMessage: text("error_message"),
  }
);



/*
 * ============================================================
 * INTEGRACOES EXTERNAS
 * ============================================================
 */

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    provider:
      text("provider")
        .notNull()
        .unique(),

    accessToken:
      text("access_token")
        .notNull(),

    refreshToken:
      text("refresh_token")
        .notNull(),

    accessTokenExpiresAt:
      timestamp("access_token_expires_at")
        .notNull(),

    createdAt:
      timestamp("created_at")
        .defaultNow(),

    updatedAt:
      timestamp("updated_at")
        .defaultNow(),
  }
);

// ============================================================================
// CUPONS Ã¢â‚¬â€ COMERCIAL + PARCEIRA / UGC
// ============================================================================

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),

  code: text("code")
    .notNull()
    .unique(),

  discountType: text("discount_type")
    .notNull(),

  discountValue: integer("discount_value")
    .notNull(),

  // normal = cupom comercial da loja
  // partner = cupom UGC / parceira
  couponType: text("coupon_type")
    .notNull()
    .default("normal"),

  partnerId: text("partner_id"),

  commissionPercent: integer("commission_percent")
    .notNull()
    .default(0),

  minSubtotalCents: integer("min_subtotal_cents")
    .notNull()
    .default(0),

  startsAt: timestamp("starts_at"),

  expiresAt: timestamp("expires_at"),

  maxUses: integer("max_uses"),

  usedCount: integer("used_count")
    .notNull()
    .default(0),

  onePerCustomer: boolean("one_per_customer")
    .notNull()
    .default(false),

  active: boolean("active")
    .notNull()
    .default(true),

  createdAt: timestamp("created_at")
    .defaultNow(),

  updatedAt: timestamp("updated_at")
    .defaultNow(),
});

// ============================================================================
// HISTORICO DE UTILIZACAO DOS CUPONS
// ============================================================================

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  couponId: uuid("coupon_id")
    .references(() => coupons.id)
    .notNull(),

  customerEmail: text("customer_email")
    .notNull(),

  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),

  discountCents: integer("discount_cents")
    .notNull(),

  redeemedAt: timestamp("redeemed_at")
    .defaultNow(),
});
