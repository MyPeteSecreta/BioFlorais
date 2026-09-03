import { NextResponse } from "next/server";

import { getProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();

  if (!slug) {
    return NextResponse.json(
      { image: null },
      { status: 400 }
    );
  }

  const product = getProduct(slug);

  if (!product) {
    return NextResponse.json(
      { image: null },
      { status: 404 }
    );
  }

  const image = getProductMainImage(product);

  return NextResponse.json({
    image,
  });
}
