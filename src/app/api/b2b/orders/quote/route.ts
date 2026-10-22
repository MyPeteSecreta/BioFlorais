/**
 * BIO FLORAIS B2B — reabrir um ORÇAMENTO (pedido sem pagamento, status 'quote') no checkout.
 *
 * GET ?b2b=<token>&id=<orderId>[&lancar=1]
 *  - O cliente vem do token da oferta; o orçamento tem de ser DESTE cliente e estar pendente.
 *  - lancar=1: só o vendedor dono da oferta (sessão validada no servidor).
 * Devolve a sacola (com preços atuais, recalculados), os dados do comprador, o endereço, as observações e a validade.
 * Orçamento vencido ainda abre (preços recalculados), mas NÃO é convertido: o checkout salva um orçamento novo.
 */

import { NextRequest, NextResponse } from "next/server";

import { isUuid } from "@/lib/b2b/admin-input";
import { composeKit, displayByKey } from "@/lib/b2b/displays";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { loadPublicB2BOfferContext } from "@/lib/b2b/public-offer-context";
import { computeB2BQuote } from "@/lib/b2b/quote";
import { QUOTE_STATUS, isQuoteExpired } from "@/lib/b2b/quote-order";
import { B2B_SESSION_COOKIE } from "@/lib/b2b/responsible-session";
import { LAUNCH_ORIGIN, verifyLaunchAccess } from "@/lib/b2b/vendor-launch";
import { resolveB2BUnitPriceCents } from "@/lib/b2b/pricing";
import { getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id") ?? "";

  if (!isUuid(id)) return NextResponse.json({ error: "Orçamento inválido." }, { status: 400 });

  const resolution = await loadPublicB2BOfferContext(params.get("b2b") ?? "");

  if (!resolution.ok || resolution.context.isStorefront) {
    return NextResponse.json({ error: "Este link de oferta não é mais válido." }, { status: 403 });
  }

  const context = resolution.context;
  const run = getAppSqlRunner();

  if (params.get("lancar") === "1") {
    const access = await verifyLaunchAccess(run, request.cookies.get(B2B_SESSION_COOKIE)?.value, context.responsibleId);

    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const [order] = await run(
      `SELECT o.id::text AS id, o.status, o.customer_id::text AS customer_id, o.shipping_address_id::text AS address_id,
              o.shipping_service_name, o.coupon_code,
              to_jsonb(o) ->> 'commercial_adjustments_json' AS adjustments,
              to_jsonb(o) ->> 'customer_note' AS customer_note,
              to_jsonb(o) ->> 'origin' AS origin,
              to_char(o.quote_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at
         FROM orders o
        WHERE o.id = $1::uuid AND o.b2b_client_id = $2::uuid AND o.status = $3`,
      [id, context.clientId, QUOTE_STATUS]
    );

    if (!order) return NextResponse.json({ error: "Orçamento não encontrado ou já utilizado." }, { status: 404 });

    const [customer] = await run(`SELECT person_type, name, email, phone, cpf, cnpj, state_registration FROM customers WHERE id = $1::uuid`, [order.customer_id]);
    const [address] = await run(`SELECT cep, street, number, complement, district, city, state FROM addresses WHERE id = $1::uuid`, [order.address_id]);
    const items = await run(
      `SELECT i.product_id::text AS product_id, coalesce(sum(i.qty) FILTER (WHERE i.unit_price_cents > 0), 0)::int AS qty
         FROM order_items i WHERE i.order_id = $1::uuid GROUP BY i.product_id`,
      [id]
    );

    const wanted = items.map((row) => ({ productId: String(row.product_id), qty: Number(row.qty) })).filter((item) => item.qty > 0);

    let adjustments: { displays?: Array<{ key?: string; count?: number }> } = {};

    try {
      adjustments = order.adjustments ? JSON.parse(String(order.adjustments)) : {};
    } catch {
      adjustments = {};
    }

    const displayKeys: string[] = [];

    for (const entry of adjustments.displays ?? []) {
      for (let i = 0; i < Math.max(1, Number(entry.count ?? 1)); i += 1) displayKeys.push(String(entry.key ?? ""));
    }

    // Preços ATUAIS (recalculados): o orçamento guarda o que foi combinado, o pedido usa o preço do dia.
    const recomputed = await computeB2BQuote({
      context,
      items: wanted,
      cep: address?.cep,
      state: address?.state,
      couponCode: order.coupon_code,
      customerEmail: customer?.email ? String(customer.email) : undefined,
      displays: displayKeys,
    });

    const byProduct = new Map(context.products.map((product) => [product.id, product]));

    const lines = wanted
      .map((item) => {
        const product = byProduct.get(item.productId);

        if (!product) return null;

        const quoted = recomputed.ok ? recomputed.quote.lines.find((line) => line.productId === item.productId) : null;
        const catalogProduct = getProduct(product.slug);

        return {
          productId: product.id,
          slug: product.slug,
          name: b2bProductLabel({ slug: product.slug, name: product.name, category: product.category }).full,
          image: catalogProduct ? getProductMainImage(catalogProduct) || null : null,
          priceCents: quoted ? quoted.listUnitPriceCents : resolveB2BUnitPriceCents(product.b2cPriceCents, product.category),
          discountPercent: quoted ? quoted.discountPercent : null,
          qty: item.qty,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const slugToId = new Map(lines.map((line) => [line.slug, line.productId]));
    const displays = displayKeys
      .map((key) => {
        const def = displayByKey(key);
        if (!def) return null;

        const composition = composeKit(def).map((kit) => ({ productId: slugToId.get(kit.slug) ?? "", qty: kit.qty }));

        return composition.every((entry) => entry.productId) ? { key: def.key, name: def.name, composition } : null;
      })
      .filter((display): display is NonNullable<typeof display> => display !== null);

    const expiresAt = order.expires_at ? String(order.expires_at) : null;

    return NextResponse.json({
      quote: {
        id,
        expiresAt,
        expired: isQuoteExpired(expiresAt),
        couponCode: order.coupon_code ? String(order.coupon_code) : null,
        shippingServiceName: order.shipping_service_name ? String(order.shipping_service_name) : null,
        orderNote: order.customer_note ? String(order.customer_note) : "",
        byVendor: order.origin === LAUNCH_ORIGIN,
      },
      customer: customer
        ? {
            personType: customer.cnpj ? "pj" : "pf",
            name: String(customer.name ?? ""),
            email: String(customer.email ?? ""),
            phone: String(customer.phone ?? ""),
            cpf: String(customer.cpf ?? ""),
            cnpj: String(customer.cnpj ?? ""),
            stateRegistration: String(customer.state_registration ?? ""),
          }
        : null,
      address: address
        ? {
            cep: String(address.cep ?? ""),
            street: String(address.street ?? ""),
            number: String(address.number ?? ""),
            complement: String(address.complement ?? ""),
            district: String(address.district ?? ""),
            city: String(address.city ?? ""),
            state: String(address.state ?? ""),
          }
        : null,
      lines,
      displays,
    });
  } catch (error) {
    console.error("[b2b/orders/quote GET]", error);

    return NextResponse.json({ error: "Não foi possível abrir o orçamento." }, { status: 500 });
  }
}
