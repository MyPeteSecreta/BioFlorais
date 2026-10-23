/**
 * Folha do pedido para IMPRIMIR / salvar em PDF (Rodada 19c): a mesma folha serve ao "Lançar pedido" (vendedor), à revisão do
 * checkout B2B, ao orçamento e ao "Meus pedidos" (lojista). Marca, comprador, itens, quantidades, preços, descontos, frete,
 * total, condição de pagamento e observações. Montagem PURA (sem banco) + um carregador para pedidos já gravados.
 * Nunca mostra comissão, custo real do frete nem dado interno.
 */

import { isUuid } from "@/lib/b2b/admin-input";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { resolveB2BOrderTotalsByPaymentMethod } from "@/lib/b2b/pricing";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { QUOTE_STATUS, isQuoteExpired } from "@/lib/b2b/quote-order";

export type SheetKind = "review" | "order" | "quote";

export type SheetItem = {
  name: string;
  qty: number;
  /** Preço unitário efetivo (já com o desconto %, se houver). */
  unitCents: number;
  /** Preço de tabela B2B antes do desconto %, quando houve desconto. */
  listUnitCents: number | null;
  discountPercent: string | null;
  totalCents: number;
  /** Unidades grátis da promoção (compre X leve +Y). */
  bonusQty: number;
};

export type OrderSheetData = {
  kind: SheetKind;
  brand: string;
  number: string | null;
  dateLabel: string;
  validUntilLabel: string | null;
  seller: string | null;
  buyer: { name: string; document: string | null; email: string | null; phone: string | null };
  addressLines: string[];
  items: SheetItem[];
  displays: string[];
  subtotalCents: number;
  couponLabel: string | null;
  couponDiscountCents: number;
  paymentDiscountCents: number;
  shippingLabel: string | null;
  shippingCents: number | null;
  totalCents: number | null;
  /** Condição de pagamento: "Pix", "Cartão em 2x", "Boleto em 3x" ou "A definir" + valores por forma (orçamento/revisão). */
  paymentLabel: string;
  paymentOptions: Array<{ label: string; totalCents: number }>;
  note: string | null;
};

export const SHEET_BRAND = "Bio Florais";

export const sheetTitle = (kind: SheetKind) => (kind === "quote" ? "Orçamento" : kind === "review" ? "Revisão do pedido" : "Pedido");

const METHOD_LABEL: Record<string, string> = { pix: "Pix", card: "Cartão de crédito", boleto: "Boleto" };

export function paymentConditionLabel(method: string | null | undefined, installments: number | null | undefined = 1): string {
  const label = method ? METHOD_LABEL[method] : null;

  if (!label) return "A definir (escolhida ao fechar o pedido)";

  const parcels = Math.max(1, Math.floor(Number(installments ?? 1)));

  if (method === "pix" || parcels === 1) return method === "pix" ? "Pix" : `${label} à vista`;

  return `${label} em ${parcels}x`;
}

export function formatSheetDocument(digits: string | null | undefined): string | null {
  const d = String(digits ?? "").replace(/\D/g, "");

  if (d.length === 14) return `CNPJ ${d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`;
  if (d.length === 11) return `CPF ${d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;

  return null;
}

export function formatSheetPhone(digits: string | null | undefined): string | null {
  const d = String(digits ?? "").replace(/\D/g, "");

  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");

  return d || null;
}

export function formatSheetAddress(address: { street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null; cep?: string | null } | null | undefined): string[] {
  if (!address) return [];

  const first = [address.street, address.number].map((part) => String(part ?? "").trim()).filter(Boolean).join(", ");
  const second = [address.complement, address.district].map((part) => String(part ?? "").trim()).filter(Boolean).join(" · ");
  const cep = String(address.cep ?? "").replace(/\D/g, "");
  const third = [[address.city, address.state].map((part) => String(part ?? "").trim()).filter(Boolean).join("/"), cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : ""]
    .filter(Boolean)
    .join(" · ");

  return [first, second, third].filter(Boolean);
}

const dateFormat = (value: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(value);

export const formatSheetDate = (value: Date | string | null | undefined) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) ? dateFormat(date) : "";
};

/** Total de uma linha de item e soma, a partir dos itens (usado nos testes e na revisão). */
export const sheetItemsTotalCents = (items: readonly Pick<SheetItem, "totalCents">[]) => items.reduce((sum, item) => sum + item.totalCents, 0);

export type SheetRows = {
  order: Record<string, unknown>;
  customer: Record<string, unknown> | null;
  address: Record<string, unknown> | null;
  items: Array<Record<string, unknown>>;
};

/** Monta a folha de um pedido/orçamento JÁ gravado (linhas cruas do banco). */
export function buildSheetFromRows(rows: SheetRows, now: Date = new Date()): OrderSheetData {
  const { order, customer, address } = rows;
  const status = String(order.status ?? "");
  const isQuote = status === QUOTE_STATUS || status === "quote_converted" || status === "quote_replaced";
  const method = order.payment_method ? String(order.payment_method) : null;
  let installments = 1;

  try {
    const adjustments = order.adjustments ? (JSON.parse(String(order.adjustments)) as { installments?: number; displays?: Array<{ name?: string; count?: number }> }) : null;
    installments = Number(adjustments?.installments ?? 1) || 1;
  } catch {
    installments = 1;
  }

  const displays: string[] = [];

  try {
    const adjustments = order.adjustments ? (JSON.parse(String(order.adjustments)) as { displays?: Array<{ name?: string; count?: number }> }) : null;

    for (const entry of adjustments?.displays ?? []) {
      const count = Math.max(1, Number(entry.count ?? 1));
      if (entry.name) displays.push(`${count}× ${entry.name} (brinde)`);
    }
  } catch {
    // ajuste ilegível: sem display
  }

  const paid = rows.items.filter((item) => Number(item.unit_price_cents ?? 0) > 0);
  const bonusByProduct = new Map<string, number>();

  for (const item of rows.items) {
    if (Number(item.unit_price_cents ?? 0) === 0) bonusByProduct.set(String(item.product_id), (bonusByProduct.get(String(item.product_id)) ?? 0) + Number(item.qty ?? 0));
  }

  const items: SheetItem[] = paid.map((item) => {
    const qty = Number(item.qty ?? 0);
    const unit = Number(item.unit_price_cents ?? 0);
    const discount = Number(item.promotion_discount_cents ?? 0);
    const list = discount > 0 && qty > 0 ? unit + Math.round(discount / qty) : null;
    const name =
      item.snapshot
        ? String(item.snapshot)
        : b2bProductLabel({ slug: String(item.slug ?? ""), name: String(item.name ?? "Produto"), category: (item.category as string | null) ?? null, lineSlug: (item.line_slug as string | null) ?? null }).full;

    return {
      name,
      qty,
      unitCents: unit,
      listUnitCents: list,
      discountPercent: item.promotion_percent ? String(item.promotion_percent).replace(".", ",") : null,
      totalCents: unit * qty,
      bonusQty: bonusByProduct.get(String(item.product_id)) ?? 0,
    };
  });

  const expiresAt = order.expires_at ? String(order.expires_at) : null;
  const total = Number(order.total_cents ?? 0);
  const couponDiscount = Number(order.coupon_discount_cents ?? 0);
  const paymentDiscount = Number(order.payment_method_discount_cents ?? 0);
  // Orçamento: valor de cada forma de pagamento (Pix tem desconto; cartão e boleto, não), recalculado do que foi gravado.
  const totals = isQuote ? resolveB2BOrderTotalsByPaymentMethod(Math.max(0, Number(order.subtotal_cents ?? 0) - couponDiscount), Number(order.shipping_cents ?? 0)) : null;
  const options = totals
    ? [
        { label: METHOD_LABEL.pix, totalCents: totals.pix },
        { label: METHOD_LABEL.card, totalCents: totals.card },
        { label: METHOD_LABEL.boleto, totalCents: totals.boleto },
      ]
    : [];

  return {
    kind: isQuote ? "quote" : "order",
    brand: SHEET_BRAND,
    number: String(order.id ?? "").slice(0, 8).toUpperCase() || null,
    dateLabel: formatSheetDate(order.created_at as string | Date | null),
    validUntilLabel: isQuote && expiresAt ? `${formatSheetDate(expiresAt)}${isQuoteExpired(expiresAt, now) ? " (vencido)" : ""}` : null,
    seller: order.seller ? String(order.seller) : null,
    buyer: {
      name: String(customer?.name ?? "Cliente"),
      document: formatSheetDocument(String(customer?.cnpj ?? "") || String(customer?.cpf ?? "")),
      email: customer?.email ? String(customer.email) : null,
      phone: formatSheetPhone(customer?.phone ? String(customer.phone) : null),
    },
    addressLines: formatSheetAddress(address as never),
    items,
    displays,
    subtotalCents: Number(order.subtotal_cents ?? 0),
    couponLabel: order.coupon_code ? `Cupom ${String(order.coupon_code)}` : null,
    couponDiscountCents: couponDiscount,
    paymentDiscountCents: paymentDiscount,
    shippingLabel: order.shipping_service_name ? String(order.shipping_service_name) : null,
    shippingCents: order.shipping_cents === null || order.shipping_cents === undefined ? null : Number(order.shipping_cents),
    totalCents: total,
    paymentLabel: isQuote ? paymentConditionLabel(null) : paymentConditionLabel(method, installments),
    paymentOptions: options,
    note: order.customer_note ? String(order.customer_note) : null,
  };
}

/**
 * Carrega a folha de UM pedido/orçamento do cliente do link (b2b_client_id do token). Pedido de outro cliente, inexistente ou
 * arquivado = null. Colunas opcionais (customer_note, quote_expires_at) são lidas por to_jsonb: abre antes dos SQL 46b/48b.
 */
export async function loadOrderSheet(run: SqlRunner, orderId: string, clientId: string | null): Promise<OrderSheetData | null> {
  // clientId null = a autorização já foi decidida por quem chama (order-access.ts: link pessoal, link geral ou sessão do vendedor).
  if (!isUuid(orderId) || (clientId !== null && !isUuid(clientId))) return null;

  const [order] = await run(
    `SELECT o.id::text AS id, o.status, o.payment_method, o.subtotal_cents, o.coupon_code, o.coupon_discount_cents, o.payment_method_discount_cents,
            o.shipping_service_name, o.shipping_cents, o.total_cents, o.customer_id::text AS customer_id, o.shipping_address_id::text AS address_id,
            o.b2b_responsible_name AS seller,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_jsonb(o) ->> 'commercial_adjustments_json' AS adjustments,
            to_jsonb(o) ->> 'customer_note' AS customer_note,
            to_jsonb(o) ->> 'quote_expires_at' AS expires_at
       FROM orders o
      WHERE o.id = $1::uuid AND ($2::uuid IS NULL OR o.b2b_client_id = $2::uuid) AND o.b2b_offer_id IS NOT NULL AND to_jsonb(o) ->> 'archived_at' IS NULL`,
    [orderId, clientId]
  );

  if (!order) return null;

  const [customer] = await run(`SELECT name, email, phone, cpf, cnpj FROM customers WHERE id = $1::uuid`, [order.customer_id]);
  const [address] = await run(`SELECT cep, street, number, complement, district, city, state FROM addresses WHERE id = $1::uuid`, [order.address_id]);
  const items = await run(
    `SELECT i.product_id::text AS product_id, i.qty, i.unit_price_cents,
            to_jsonb(i) ->> 'product_name_snapshot' AS snapshot, to_jsonb(i) ->> 'promotion_percent' AS promotion_percent,
            to_jsonb(i) ->> 'promotion_discount_cents' AS promotion_discount_cents,
            p.slug, p.name, p.category, p.line_slug
       FROM order_items i LEFT JOIN products p ON p.id = i.product_id
      WHERE i.order_id = $1::uuid ORDER BY p.name, i.unit_price_cents DESC`,
    [orderId]
  );

  return buildSheetFromRows({ order, customer: customer ?? null, address: address ?? null, items });
}

export type ReviewSheetInput = {
  lines: Array<{ name: string; qty: number; priceCents: number; discountPercent?: number | null }>;
  discountLines?: Array<{ productId: string; percent: number; listUnitPriceCents: number; unitPriceCents: number }>;
  lineIds?: string[];
  bonusByProduct?: Map<string, number>;
  displays: string[];
  buyer: { name: string; document: string; email: string; phone: string };
  address: { street: string; number: string; complement: string; district: string; city: string; state: string; cep: string };
  couponCode: string | null;
  subtotalCents: number;
  couponDiscountCents: number;
  shipping: { serviceName: string; priceCents: number } | null;
  totalsByPaymentMethod: Record<"pix" | "card" | "boleto", number> | null;
  paymentMethod: "pix" | "card" | "boleto";
  installments: number;
  note: string;
  seller?: string | null;
  now?: Date;
};

/**
 * Folha da REVISÃO do checkout (antes de o pedido existir): monta do que está na tela. O servidor recalcula tudo ao
 * confirmar; este documento é a conferência do cliente/vendedor.
 */
export function buildReviewSheet(input: ReviewSheetInput): OrderSheetData {
  const discountByProduct = new Map((input.discountLines ?? []).map((line) => [line.productId, line]));
  const items: SheetItem[] = input.lines.map((line, index) => {
    const id = input.lineIds?.[index] ?? "";
    const discount = discountByProduct.get(id);
    const unit = discount ? discount.unitPriceCents : Math.round(line.priceCents * (1 - (line.discountPercent ?? 0) / 100));

    return {
      name: line.name,
      qty: line.qty,
      unitCents: unit,
      listUnitCents: discount ? discount.listUnitPriceCents : line.discountPercent ? line.priceCents : null,
      discountPercent: discount ? String(discount.percent).replace(".", ",") : line.discountPercent ? String(line.discountPercent).replace(".", ",") : null,
      totalCents: unit * line.qty,
      bonusQty: input.bonusByProduct?.get(id) ?? 0,
    };
  });

  const totals = input.totalsByPaymentMethod;
  const selected = totals ? totals[input.paymentMethod] : null;
  const paymentDiscount = totals && selected !== null ? Math.max(0, totals.card - selected) : 0;
  const note = String(input.note ?? "").trim();

  return {
    kind: "review",
    brand: SHEET_BRAND,
    number: null,
    dateLabel: formatSheetDate(input.now ?? new Date()),
    validUntilLabel: null,
    seller: input.seller ?? null,
    buyer: {
      name: input.buyer.name.trim() || "—",
      document: formatSheetDocument(input.buyer.document),
      email: input.buyer.email.trim() || null,
      phone: formatSheetPhone(input.buyer.phone),
    },
    addressLines: formatSheetAddress(input.address),
    items,
    displays: input.displays,
    subtotalCents: input.subtotalCents,
    couponLabel: input.couponCode ? `Cupom ${input.couponCode}` : null,
    couponDiscountCents: input.couponDiscountCents,
    paymentDiscountCents: paymentDiscount,
    shippingLabel: input.shipping?.serviceName ?? null,
    shippingCents: input.shipping ? input.shipping.priceCents : null,
    totalCents: selected,
    paymentLabel: paymentConditionLabel(input.paymentMethod, input.installments),
    paymentOptions: [],
    note: note || null,
  };
}
