import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
 * ENDEREÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡OS
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

    /*
     * Dados operacionais de expedição.
     * Mantidos no próprio pedido no Bio Florais.
     */
    shippingServiceName:
      text("shipping_service_name"),

    trackingCode:
      text("tracking_code"),

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

    /*
     * Snapshot imutavel da atribuicao Partner 3B.
     * partnerCouponId e a identidade historica canonica.
     */
    partnerCouponId:
      text("partner_coupon_id"),

    partnerCampaignId:
      text("partner_campaign_id"),

    partnerCampaignName:
      text("partner_campaign_name"),

    partnerDiscountPercent:
      numeric(
        "partner_discount_percent",
        { precision: 10, scale: 4 }
      ),

    /*
     * NULL = comissao ainda nao definida.
     * Zero = comissao explicitamente definida como 0%.
     * Percentuais decimais sao preservados sem float no banco.
     */
    partnerCommissionPercent:
      numeric(
        "partner_commission_percent",
        { precision: 10, scale: 4 }
      ),

    /*
     * Campo legado preservado por compatibilidade.
     * A autoridade financeira da comissao e a Academia.
     */
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

    /*
     * B2B (candidata b2b/bio-limpa-v1). Colunas usadas somente por
     * pedidos B2B; pedidos B2C continuam com NULL / 0.
     * Ver sql/b2b/bio_b2b_candidate.sql (ADD COLUMN IF NOT EXISTS).
     */
    b2bClientId:
      uuid("b2b_client_id"),

    b2bOfferId:
      uuid("b2b_offer_id"),

    b2bResponsibleId:
      uuid("b2b_responsible_id"),

    b2bResponsibleType:
      text("b2b_responsible_type"),

    b2bResponsibleName:
      text("b2b_responsible_name"),

    /*
     * Forma de pagamento com que o pedido B2B foi precificado
     * (pix | card | boleto). Toda rota de pagamento B2B exige
     * igualdade antes de cobrar (trava por metodo).
     */
    paymentMethod:
      text("payment_method"),

    /*
     * Desconto por forma de pagamento ja embutido em total_cents
     * (conciliacao interna; nunca exibido ao comprador).
     */
    paymentMethodDiscountCents:
      integer("payment_method_discount_cents")
        .notNull()
        .default(0),
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
// CUPONS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â COMERCIAL + PARCEIRA / UGC
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

  // B2B: "b2c" (default de todo cupom existente) | "b2b".
  // Cupom B2B nunca vale no B2C e vice-versa.
  scope: text("scope")
    .notNull()
    .default("b2c"),

  // Uso exclusivo de teste interno: cupom percentual que tambem
  // desconta o frete no B2B.
  discountsShipping: boolean("discounts_shipping")
    .notNull()
    .default(false),

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

/*
 * ============================================================
 * PARTNER EVENT OUTBOX
 * ============================================================
 *
 * Entrega duravel dos fatos do ecommerce para a Academia.
 * O payload original e imutavel e deve ser reutilizado em retries.
 */
export const partnerEventOutbox = pgTable(
  "partner_event_outbox",
  {
    id:
      uuid("id")
        .defaultRandom()
        .primaryKey(),

    eventId:
      text("event_id")
        .notNull()
        .unique(),

    eventType:
      text("event_type")
        .notNull(),

    brand:
      text("brand")
        .notNull(),

    externalOrderId:
      text("external_order_id")
        .notNull(),

    partnerCouponId:
      text("partner_coupon_id"),

    payload:
      jsonb("payload")
        .notNull(),

    status:
      text("status")
        .notNull()
        .default("pending"),

    attemptCount:
      integer("attempt_count")
        .notNull()
        .default(0),

    nextAttemptAt:
      timestamp("next_attempt_at"),

    lastAttemptAt:
      timestamp("last_attempt_at"),

    lastErrorCode:
      text("last_error_code"),

    deliveredAt:
      timestamp("delivered_at"),

    createdAt:
      timestamp("created_at")
        .defaultNow()
        .notNull(),
  }
);

/*
 * ============================================================================
 * B2B (candidata b2b/bio-limpa-v1)
 * ============================================================================
 *
 * Declaracao TypeScript das tabelas B2B que ja existem no Neon da Bio
 * (estrutura conferida por introspeccao em 29/09 e pela coleta de 25/09).
 * Nada aqui deve ser aplicado via drizzle-kit push/migrate: o SQL
 * candidato (IF NOT EXISTS) e o preflight somente leitura ficam em
 * sql/b2b/. Nomes de indice/constraint servem apenas para o TypeScript.
 * ============================================================================
 */

export const b2bCommercialGroups = pgTable(
  "b2b_commercial_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    b2cVisible: boolean("b2c_visible").notNull().default(true),
    b2bVisible: boolean("b2b_visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const b2bCommercialGroupProducts = pgTable(
  "b2b_commercial_group_products",
  {
    commercialGroupId: uuid("commercial_group_id")
      .references(() => b2bCommercialGroups.id)
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.commercialGroupId, t.productId] }),
  ]
);

export const b2bResponsibleInvites = pgTable(
  "b2b_responsible_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    responsibleType: text("responsible_type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /*
     * Admin B2B (sql/b2b/03_admin_b2b_candidate.sql):
     * "onboarding" = convite de cadastro; "password_reset" = redefinição
     * de acesso de um responsável já existente (responsible_id).
     */
    purpose: text("purpose").notNull().default("onboarding"),
    responsibleId: uuid("responsible_id"),
  }
);

export const b2bResponsibles = pgTable(
  "b2b_responsibles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviteId: uuid("invite_id")
      .references(() => b2bResponsibleInvites.id)
      .unique(),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    rcaTermsAcceptedAt: timestamp("rca_terms_accepted_at"),
    companyApprovedAt: timestamp("company_approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    login: text("login"),
    passwordHash: text("password_hash"),
    personType: text("person_type").notNull().default("pf"),
    cpf: text("cpf"),
    rg: text("rg"),
    cnpj: text("cnpj"),
    stateRegistration: text("state_registration"),
    pixKey: text("pix_key"),
    bankName: text("bank_name"),
    bankAgency: text("bank_agency"),
    bankAccount: text("bank_account"),
    postalCode: text("postal_code"),
    street: text("street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    state: text("state"),
    // Admin B2B: último login do responsável na área B2B.
    lastLoginAt: timestamp("last_login_at"),
  }
);

export const b2bClients = pgTable(
  "b2b_clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    customerId: uuid("customer_id").references(() => customers.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const b2bClientRelationships = pgTable(
  "b2b_client_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .references(() => b2bClients.id)
      .notNull(),
    responsibleId: uuid("responsible_id")
      .references(() => b2bResponsibles.id)
      .notNull(),
    active: boolean("active").notNull().default(true),
    linkedAt: timestamp("linked_at").defaultNow().notNull(),
    unlinkedAt: timestamp("unlinked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("b2b_relationship_responsible_idx").on(t.responsibleId),
  ]
);

export const b2bPromotions = pgTable(
  "b2b_promotions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    scope: text("scope").notNull(),
    type: text("type").notNull(),
    commercialPurpose: text("commercial_purpose").notNull().default("general"),
    eligibilityScope: text("eligibility_scope").notNull().default("none"),
    eligibilityHistoryKey: text("eligibility_history_key"),
    percentage: numeric("percentage"),
    fixedDiscountCents: integer("fixed_discount_cents"),
    fixedPriceCents: integer("fixed_price_cents"),
    buyQuantity: integer("buy_quantity"),
    freeQuantity: integer("free_quantity"),
    sellerSelectable: boolean("seller_selectable").notNull().default(true),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const b2bPromotionTerms = pgTable(
  "b2b_promotion_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => b2bPromotions.id)
      .notNull(),
    termType: text("term_type").notNull(),
    maxUses: integer("max_uses"),
    durationDays: integer("duration_days"),
    validUntil: timestamp("valid_until"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export const b2bPromotionCommercialGroups = pgTable(
  "b2b_promotion_commercial_groups",
  {
    promotionId: uuid("promotion_id")
      .references(() => b2bPromotions.id)
      .notNull(),
    commercialGroupId: uuid("commercial_group_id")
      .references(() => b2bCommercialGroups.id)
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.promotionId, t.commercialGroupId] }),
  ]
);

export const b2bPromotionProducts = pgTable(
  "b2b_promotion_products",
  {
    promotionId: uuid("promotion_id")
      .references(() => b2bPromotions.id)
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.promotionId, t.productId] }),
  ]
);

export const b2bOffers = pgTable(
  "b2b_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .references(() => b2bClients.id)
      .notNull(),
    responsibleId: uuid("responsible_id")
      .references(() => b2bResponsibles.id)
      .notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    activatedAt: timestamp("activated_at"),
    revokedAt: timestamp("revoked_at"),
  }
);

export const b2bOfferCommercialGroups = pgTable(
  "b2b_offer_commercial_groups",
  {
    offerId: uuid("offer_id")
      .references(() => b2bOffers.id)
      .notNull(),
    commercialGroupId: uuid("commercial_group_id")
      .references(() => b2bCommercialGroups.id)
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.offerId, t.commercialGroupId] }),
  ]
);

export const b2bOfferPromotions = pgTable(
  "b2b_offer_promotions",
  {
    offerId: uuid("offer_id")
      .references(() => b2bOffers.id)
      .notNull(),
    promotionId: uuid("promotion_id")
      .references(() => b2bPromotions.id)
      .notNull(),
    promotionTermId: uuid("promotion_term_id")
      .references(() => b2bPromotionTerms.id),
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.offerId, t.promotionId] }),
  ]
);

export const b2bOfferLinks = pgTable(
  "b2b_offer_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .references(() => b2bOffers.id)
      .notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

/*
 * Solicitacao de boleto B2B: NAO emite boleto real. Uma linha por
 * pedido (indice unico em order_id = idempotencia garantida pelo banco).
 * Composicao exata em centavos: (installments - 1) parcelas de
 * installment_amount_cents + 1 parcela de last_installment_amount_cents
 * = amount_cents = orders.total_cents.
 */
export const b2bBoletoRequests = pgTable(
  "b2b_boleto_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    installments: integer("installments").notNull().default(1),
    installmentAmountCents: integer("installment_amount_cents").notNull(),
    lastInstallmentAmountCents: integer("last_installment_amount_cents").notNull(),
    status: text("status").notNull().default("pending_request"),
    notes: text("notes"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("b2b_boleto_requests_order_unique_idx").on(t.orderId),
  ]
);
