/**
 * Itens dos feeds com a imagem resolvida no disco (servidor). Adulto: recorte do frasco em public/feeds/adulto (as fotos do Adulto
 * são cenas com frases de benefício; o recorte só mostra o frasco). Demais linhas: foto principal do produto (frasco limpo).
 */

import fs from "node:fs";
import path from "node:path";

import { bioProducts, type BioProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage, imageExists } from "@/lib/catalog/product-images.server";
import { buildFeedItem, type FeedItem } from "@/lib/feeds/products";
import { getSiteUrl } from "@/lib/seo/site-url";

export function feedImageFor(product: BioProduct): string | null {
  if (product.lineSlug === "adulto") {
    const publicPath = `/feeds/adulto/${product.slug.replace(/^adulto-floral-em-gotas-/, "")}.jpg`;

    return fs.existsSync(path.join(process.cwd(), "public", publicPath)) ? publicPath : null;
  }

  const image = getProductMainImage(product);

  return image && imageExists(image) ? image : null;
}

export function loadFeedItems(): FeedItem[] {
  const siteUrl = getSiteUrl();

  return bioProducts.flatMap((product) => {
    const item = buildFeedItem(product, siteUrl, feedImageFor);

    return item ? [item] : [];
  });
}
