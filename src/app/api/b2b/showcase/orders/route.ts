/**
 * BIO FLORAIS B2B — cria o pedido de MOSTRUÁRIO do vendedor/RCA.
 *
 * O pedido é do próprio vendedor: comprador = dados do cadastro dele, entrega em endereço editável.
 * Nasce marcado (orders.origin = 'mostruario'), sem oferta/cliente B2B, logo FORA de comissões,
 * relatórios de venda B2B e acompanhamento. Sem mínimo, sem cupom, sem promoção, sem desconto
 * por forma de pagamento (Pix ou cartão). O servidor revalida tudo (showcase-state/showcase-quote).
 */

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { addresses, customers, orderItems } from "@/lib/db/schema";
import { ensureOmieVendorDefault } from "@/lib/b2b/omie-vendor";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { isB2BInstallmentCountValid } from "@/lib/b2b/pricing";
import { requireResponsible } from "@/lib/b2b/require-responsible";
import { SHOWCASE_ORIGIN, buildShowcaseQuotas, loadShowcaseUsage } from "@/lib/b2b/showcase";
import { computeShowcaseQuote } from "@/lib/b2b/showcase-quote";
import { loadShowcaseState } from "@/lib/b2b/showcase-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  items?: unknown;
  address?: { cep?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string };
  shipping?: { serviceName?: string };
  paymentMethod?: string;
  installments?: number;
};

const text = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  try {
    const responsible = await requireResponsible(request);

    if (!responsible) return fail("Sua sessão expirou. Entre de novo.", 401);

    const body = (await request.json().catch(() => ({}))) as Body;
    const run = getAppSqlRunner();
    const state = await loadShowcaseState(run, responsible.id);

    if (!state.config.available) return fail("O mostruário ainda não está disponível.", 503);
    if (!state.eligibility.ok) return fail(state.eligibility.message, 403);

    const vendor = state.vendor!;

    if (vendor.phone.length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.email)) {
      return fail("Atualize o WhatsApp e o e-mail do seu cadastro para solicitar o mostruário.", 403);
    }

    const paymentMethod = body.paymentMethod === "card" ? "card" : body.paymentMethod === "pix" ? "pix" : null;

    if (!paymentMethod) return fail("Escolha Pix ou cartão.");

    const cep = digits(body.address?.cep);
    const street = text(body.address?.street);
    const number = text(body.address?.number);
    const complement = text(body.address?.complement) || null;
    const district = text(body.address?.district);
    const city = text(body.address?.city);
    const uf = text(body.address?.state).toUpperCase();

    if (cep.length !== 8 || !street || !number || !district || !city || uf.length !== 2) {
      return fail("Preencha corretamente o endereço de entrega.");
    }

    const chosenServiceName = text(body.shipping?.serviceName);

    if (!chosenServiceName) return fail("Escolha a opção de entrega antes de continuar.");

    const result = await computeShowcaseQuote(run, state, { items: body.items, cep, state: uf });

    if (!result.ok) return fail(result.error, result.status);

    const { quote } = result;
    const option = quote.options.find((item) => item.serviceName === chosenServiceName);

    if (!option) return fail("A opção de frete escolhida não é mais válida. Atualize e tente novamente.", 409);

    const totalCents = option.totalCents;
    const installments = paymentMethod === "pix" ? 1 : Number(body.installments ?? 1);

    if (paymentMethod === "card" && !isB2BInstallmentCountValid(totalCents, installments)) {
      return fail("Número de parcelas inválido para este valor.");
    }

    // ---- Persistência: comprador = o próprio vendedor
    const isCompany = Boolean(vendor.cnpj);
    const [customer] = await db
      .insert(customers)
      .values({
        personType: isCompany ? "pj" : "pf",
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        cpf: isCompany ? null : vendor.cpf,
        cnpj: isCompany ? vendor.cnpj : null,
        stateRegistration: isCompany ? vendor.stateRegistration : null,
      })
      .returning({ id: customers.id });

    const [address] = await db
      .insert(addresses)
      .values({ customerId: customer.id, cep, street, number, complement, district, city, state: quote.state })
      .returning({ id: addresses.id });

    const observation = `PEDIDO DE MOSTRUÁRIO – vendedor ${vendor.name}`;
    const adjustments = JSON.stringify({
      version: 1,
      storeKey: "bio-b2b",
      showcase: true,
      observation,
      paymentMethod,
      installments,
      shippingRealCents: option.realPriceCents,
    });

    const [order] = await run(
      `INSERT INTO orders (customer_id, shipping_address_id, shipping_service_name, status, fulfillment_status,
                           subtotal_cents, discount_cents, shipping_cents, shipping_cost_cents, total_cents,
                           b2b_responsible_id, b2b_responsible_type, b2b_responsible_name,
                           payment_method, payment_method_discount_cents, commercial_adjustments_json, origin)
       VALUES ($1::uuid, $2::uuid, $3, 'pending', 'awaiting_payment', $4, 0, $5, $6, $7,
               $8::uuid, $9, $10, $11, 0, $12, $13)
       RETURNING id`,
      [
        customer.id,
        address.id,
        option.serviceName,
        quote.subtotalCents,
        option.priceCents,
        option.realPriceCents,
        totalCents,
        vendor.id,
        vendor.type,
        vendor.name,
        paymentMethod,
        adjustments,
        SHOWCASE_ORIGIN,
      ]
    ).catch((error) => {
      console.error("[b2b/showcase/orders] sem orders.origin (SQL 37b)", error);
      return [];
    });

    if (!order) return fail("Não foi possível registrar o pedido de mostruário agora.", 503);

    const orderId = String(order.id);
    const nameByProduct = new Map(
      Array.from(state.catalog.values()).map((entry) => [
        entry.product.id,
        b2bProductLabel({
          slug: entry.product.slug,
          name: entry.product.name,
          category: entry.product.category,
          lineSlug: entry.product.lineSlug,
        }).full,
      ])
    );

    const itemRows = quote.lines.map((line) => ({
      orderId,
      productId: line.productId,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      paidQty: line.qty,
      bonusQty: 0,
      physicalQty: line.qty,
      productNameSnapshot: nameByProduct.get(line.productId) ?? null,
    }));

    try {
      await db.insert(orderItems).values(itemRows as never);
    } catch (error) {
      // 21b (nome completo no item) ainda não aplicado: grava sem o snapshot.
      console.error("[b2b/showcase/orders] tentando itens sem product_name_snapshot", error);
      await db.insert(orderItems).values(itemRows.map(({ productNameSnapshot: _name, ...rest }) => rest) as never);
    }

    // Corrida: dois pedidos simultâneos podem passar na cota. Reconfere já com este pedido gravado.
    const usage = await loadShowcaseUsage(run, vendor.id, state.config.windowDays);
    const quotas = buildShowcaseQuotas(state.catalog, usage, state.config.windowDays);
    const overLimit = Array.from(quotas.values()).some((quota) => quota.used > quota.limit);

    if (overLimit) {
      await run(`UPDATE orders SET status = 'cancelled', fulfillment_status = 'cancelled' WHERE id = $1::uuid`, [orderId]).catch(() => null);
      return fail("Limite do mostruário atingido. Atualize a página e confira o que ainda pode pedir.", 409);
    }

    await ensureOmieVendorDefault(run, vendor.id);

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        status: "pending",
        paymentMethod,
        installments,
        subtotalCents: quote.subtotalCents,
        shippingCents: option.priceCents,
        totalCents,
        payerEmail: vendor.email,
      },
    });
  } catch (error) {
    console.error("[b2b/showcase/orders]", error);
    return fail("Não foi possível criar o pedido de mostruário neste momento.", 500);
  }
}
