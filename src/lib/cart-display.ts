/**
 * Sacola, checkout e confirmação: NOME COMPLETO do produto ("<Tipo> <Nome> · <Linha> · <volume>",
 * ex.: "Condicionador Filhotes · Cosméticos Pet · 500 ml"), resolvido pelo catálogo a partir do slug.
 * A foto real vem de /api/catalog/images (useCartImages); o caminho do catálogo não é confiável.
 * O nome curto guardado na sacola/cotação ("Filhotes") só serve de reserva. Pura (roda no
 * navegador); não altera preço nem o que é gravado no pedido.
 */

import { b2bProductLabel } from "@/lib/b2b/product-label";
import { getProduct } from "@/lib/catalog/bio-products";

export function cartItemDisplay(input: { slug: string; name?: string | null; image?: string | null }) {
  const product = getProduct(input.slug);

  if (!product) {
    return { name: input.name?.trim() || input.slug, image: input.image ?? null };
  }

  return {
    name: b2bProductLabel({ slug: product.slug, name: product.name, category: product.category, lineSlug: product.lineSlug }).full,
    image: input.image || null,
  };
}
