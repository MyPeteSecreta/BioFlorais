/**
 * Fotos reais dos produtos para a sacola/checkout (o catálogo guarda caminhos que não existem em
 * public/; as fotos de verdade ficam em public/products/<linha>/...). Só slugs do catálogo.
 */

import { NextRequest, NextResponse } from "next/server";

import { getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const slugs = (request.nextUrl.searchParams.get("slugs") ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 40);

  const images: Record<string, string | null> = {};

  for (const slug of slugs) {
    const product = getProduct(slug);
    const image = product ? getProductMainImage(product) : null;

    // Só vale caminho que existe de verdade (nunca o /assets/... do catálogo).
    images[slug] = image && image.startsWith("/products/") ? image : null;
  }

  return NextResponse.json({ images }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
