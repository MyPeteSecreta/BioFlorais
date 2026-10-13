/*
 * BIO FLORAIS B2B — cotação do pedido de mostruário (servidor).
 *
 * Revalida itens, preço e limites com o MESMO estado da tela (showcase-state), calcula o frete real
 * (Melhor Envio) e aplica SEMPRE a tarifa regional especial. Sem pedido mínimo, sem cupom, sem
 * promoção, sem comissão, sem desconto por forma de pagamento: total = produtos + frete.
 */

import type { SqlRunner } from "@/lib/b2b/ownership";
import { B2B_REGIONAL_FLAT_CENTS, resolveB2BRegion } from "@/lib/b2b/pricing";
import { applyShowcaseFreight, validateShowcaseCart, type ShowcaseCartLine } from "@/lib/b2b/showcase";
import type { ShowcaseState } from "@/lib/b2b/showcase-state";
import { verifyCepMatchesState } from "@/lib/shipping/cep-lookup";
import { melhorEnvioProvider } from "@/lib/shipping/melhorenvio";
import type { ShippingItem } from "@/lib/shipping/types";

export type ShowcaseQuote = {
  cep: string;
  state: string;
  lines: ShowcaseCartLine[];
  subtotalCents: number;
  options: Array<{ serviceName: string; etaDays: number; priceCents: number; realPriceCents: number; totalCents: number }>;
};

export async function computeShowcaseQuote(
  run: SqlRunner,
  state: ShowcaseState,
  input: { items?: unknown; cep?: unknown; state?: unknown }
): Promise<{ ok: true; quote: ShowcaseQuote } | { ok: false; error: string; status: number }> {
  if (!state.eligibility.ok) {
    return { ok: false, error: state.eligibility.message, status: 403 };
  }

  const cart = validateShowcaseCart(input.items, state.catalog, state.quotas);

  if (!cart.ok) return cart;

  const cep = String(input.cep ?? "").replace(/\D/g, "");
  const uf = String(input.state ?? "").trim().toUpperCase();

  if (cep.length !== 8 || uf.length !== 2) {
    return { ok: false, error: "Informe o CEP e a UF de entrega.", status: 400 };
  }

  const cepCheck = await verifyCepMatchesState(cep, uf);

  if (cepCheck.verified && !cepCheck.matches) {
    return { ok: false, error: "O estado informado não corresponde ao CEP. Verifique o endereço de entrega.", status: 400 };
  }

  // Sem conferência do CEP (ViaCEP fora do ar) a tarifa regional não é concedida: tenta de novo.
  if (!cepCheck.verified) {
    return { ok: false, error: "Não foi possível conferir o CEP agora. Tente novamente em instantes.", status: 503 };
  }

  const region = resolveB2BRegion(cepCheck.resolvedUf);

  if (!region) {
    return { ok: false, error: "Não entregamos neste estado pelo mostruário.", status: 400 };
  }

  const dimensionRows = await run(
    `SELECT id, weight_grams, length_cm, width_cm, height_cm FROM products WHERE id = ANY($1::uuid[])`,
    [cart.lines.map((line) => line.productId)]
  );
  const dimensions = new Map(dimensionRows.map((row) => [String(row.id), row]));
  const shippingItems: ShippingItem[] = [];

  for (const line of cart.lines) {
    const dims = dimensions.get(line.productId);

    if (!dims || !dims.weight_grams || !dims.length_cm || !dims.width_cm || !dims.height_cm) {
      return { ok: false, error: "Peso ou dimensões não cadastrados para um dos itens do mostruário.", status: 400 };
    }

    shippingItems.push({
      productSlug: line.slug,
      qty: line.qty,
      weightGrams: Number(dims.weight_grams),
      lengthCm: Number(dims.length_cm),
      widthCm: Number(dims.width_cm),
      heightCm: Number(dims.height_cm),
    });
  }

  const realOptions = await melhorEnvioProvider.calculate(cep, shippingItems);

  if (realOptions.length === 0) {
    return { ok: false, error: "Nenhuma opção de frete disponível para este endereço no momento.", status: 400 };
  }

  const options = applyShowcaseFreight(realOptions, B2B_REGIONAL_FLAT_CENTS[region]).map((option) => ({
    ...option,
    totalCents: cart.subtotalCents + option.priceCents,
  }));

  return { ok: true, quote: { cep, state: cepCheck.resolvedUf, lines: cart.lines, subtotalCents: cart.subtotalCents, options } };
}
