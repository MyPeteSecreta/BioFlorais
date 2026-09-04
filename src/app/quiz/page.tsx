import { bioProducts } from "@/lib/catalog/bio-products";
import { getProductMainImage } from "@/lib/catalog/product-images.server";

import BioQuizClient from "./BioQuizClient";

export const runtime = "nodejs";

export default function BioQuizPage() {
  const productImages = Object.fromEntries(
    bioProducts.map((product) => [
      product.slug,
      getProductMainImage(product),
    ])
  );

  return (
    <BioQuizClient productImages={productImages} />
  );
}
