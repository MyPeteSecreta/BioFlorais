/**
 * Sugestões no carrinho para chegar ao frete grátis (R$ 70), sem pop-up: até 3 produtos para "levar junto".
 *  - quem leva floral HUMANO: outro floral de gotas (mais vendidos, sem repetir), um sabonete líquido e o aromatizador It's Blossom (Home Care);
 *  - quem leva floral PET: outro floral pet, um cosmético pet (shampoo) e o floral de ambiente pet.
 * O tipo vem do ÚLTIMO item adicionado (carrinho misto segue o que a pessoa acabou de escolher). Nunca repete o que já está na sacola e
 * evita nomes de condição sensível (Rescue/S.O.S., Tristeza/Depressão): é sugestão de compra, sem promessa de saúde.
 */

import { bioCommercialOrder, bioProducts, type BioProduct } from "@/lib/catalog/bio-products";

export type CartSuggestion = { slug: string; name: string; fullName: string; priceCents: number; image: string | null; kind: string };

const SENSITIVE = /rescue|\bs\.?o\.?s\b|depress|tristeza/i;
const HUMAN_FLORAL_CATEGORIES = new Set(["Floral em gotas", "Floral dose única", "Virtudes Divinas"]);
const bySlug = new Map(bioProducts.map((product) => [product.slug, product]));

const isPetCartItem = (product: BioProduct) => product.lineSlug === "pet" || product.lineSlug === "cosmeticos-pet";

const ok = (product: BioProduct | undefined, inCart: Set<string>): product is BioProduct =>
  Boolean(product) && !inCart.has((product as BioProduct).slug) && !SENSITIVE.test((product as BioProduct).name) && Number((product as BioProduct).priceCents) > 0;

function firstOf(products: Array<BioProduct | undefined>, inCart: Set<string>): BioProduct | null {
  return products.find((product): product is BioProduct => ok(product, inCart)) ?? null;
}

/** Preferência por nome (neutros primeiro); sem nenhum da lista, o primeiro disponível do catálogo. */
function prefer(pool: BioProduct[], names: string[], inCart: Set<string>, hintWord: string | null = null): BioProduct | null {
  const candidates = pool.filter((product) => ok(product, inCart));

  if (hintWord) {
    const hinted = candidates.find((product) => product.name.toLowerCase().includes(hintWord));

    if (hinted) return hinted;
  }

  for (const name of names) {
    const found = candidates.find((product) => product.name === name);

    if (found) return found;
  }

  return candidates[0] ?? null;
}

const toSuggestion = (product: BioProduct, kind: string): CartSuggestion => ({
  slug: product.slug,
  name: product.name,
  fullName: `${product.category} ${product.name}${product.content ? ` · ${product.content.replace(/(\d)([A-Za-z])/, "$1 $2")}` : ""}`,
  priceCents: product.priceCents ?? 0,
  image: product.image || null,
  kind,
});

/** "pet" se o último item da sacola é pet; senão "humano". Sacola vazia: humano. */
export function suggestionAudience(cartSlugs: readonly string[]): "pet" | "humano" {
  const last = cartSlugs.length > 0 ? bySlug.get(cartSlugs[cartSlugs.length - 1]) : undefined;

  return last && isPetCartItem(last) ? "pet" : "humano";
}

export function buildCartSuggestions(cartSlugs: readonly string[], limit = 3): CartSuggestion[] {
  const inCart = new Set(cartSlugs);
  const out: CartSuggestion[] = [];

  if (suggestionAudience(cartSlugs) === "pet") {
    const petFloral = firstOf(bioCommercialOrder.pet.slugs.map((slug) => bySlug.get(slug)).filter((product) => product?.category === "Floral em gotas"), inCart);
    const hint = cartSlugs.map((slug) => bySlug.get(slug)).find((product) => product && isPetCartItem(product))?.name.split(/[\s-]+/)[0]?.toLowerCase() ?? null;
    const shampoo = prefer(bioProducts.filter((product) => product.lineSlug === "cosmeticos-pet" && product.category === "Shampoo" && product.content === "500 ml"), ["Filhotes", "Adestramento", "Agressividade"], inCart, hint);
    const ambient = prefer(bioProducts.filter((product) => product.lineSlug === "cosmeticos-pet" && product.category === "Floral de Ambiente"), ["Filhotes", "Adestramento", "Agressividade"], inCart, hint);

    if (petFloral) out.push(toSuggestion(petFloral, "Floral pet"));
    if (shampoo) out.push(toSuggestion(shampoo, "Cosmético pet"));
    if (ambient) out.push(toSuggestion(ambient, "Floral de ambiente pet"));
  } else {
    const floral = firstOf(bioCommercialOrder.adulto.slugs.map((slug) => bySlug.get(slug)).filter((product) => product && HUMAN_FLORAL_CATEGORIES.has(product.category)), inCart);
    const soap = prefer(bioProducts.filter((product) => product.lineSlug === "cosmeticos" && product.category === "Sabonete Líquido"), ["Relaxante", "Hidratante", "Refrescante", "Energizante", "Alegria"], inCart);
    const aroma = prefer(bioProducts.filter((product) => product.lineSlug === "home-care" && product.category === "Aromatizador Spray"), ["Harmonia", "Bem Estar", "Serenidade", "Limpeza e Proteção"], inCart);

    if (floral) out.push(toSuggestion(floral, "Floral"));
    if (soap) out.push(toSuggestion(soap, "Sabonete líquido"));
    if (aroma) out.push(toSuggestion(aroma, "Aromatizador It's Blossom"));
  }

  return out.slice(0, limit);
}

/** Quanto falta para o frete grátis e a mensagem do cartão. */
export function shippingGap(baseCents: number, thresholdCents: number): { remainingCents: number; reached: boolean; progress: number } {
  const remaining = Math.max(0, thresholdCents - Math.max(0, baseCents));

  return { remainingCents: remaining, reached: remaining === 0 && baseCents > 0, progress: thresholdCents > 0 ? Math.min(100, Math.max(0, (baseCents / thresholdCents) * 100)) : 0 };
}
