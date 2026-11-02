/**
 * Itens dos feeds com a imagem resolvida no disco (servidor). Adulto: recorte do frasco em public/feeds/adulto (as fotos do Adulto
 * são cenas com frases de benefício; o recorte só mostra o frasco). Cosméticos Pet: foto da pasta do tipo do produto (a busca geral do site
 * acha primeiro a pasta do condicionador e mostrava condicionador no shampoo, no perfume e no floral de ambiente). Demais linhas: foto
 * principal do produto (frasco limpo).
 */

import fs from "node:fs";
import path from "node:path";

import { bioProducts, type BioProduct } from "@/lib/catalog/bio-products";
import { getProductMainImage, imageExists } from "@/lib/catalog/product-images.server";
import { buildFeedItem, type FeedItem } from "@/lib/feeds/products";
import { getSiteUrl } from "@/lib/seo/site-url";

/** Pasta de cada tipo de Cosméticos Pet em public/products/cosmeticos-pet (o slug traz o mesmo prefixo). */
export const PET_COSMETIC_FOLDERS: Readonly<Record<string, string>> = {
  Shampoo: "shampoo",
  Condicionador: "condicionador",
  "Perfume Spray": "perfume-spray",
  "Floral de Ambiente": "floral-de-ambiente",
};

function petCosmeticImage(product: BioProduct): string | null {
  const folder = PET_COSMETIC_FOLDERS[product.category];
  if (!folder) return null;

  // 500 ml e 5 L usam a foto da mesma versão
  const name = product.slug.replace(`cosmeticos-pet-${folder}-`, "").replace(/-(5l|500ml)$/, "");
  const directory = path.join(process.cwd(), "public", "products", "cosmeticos-pet", folder, name);
  if (!fs.existsSync(directory)) return null;

  const file = fs
    .readdirSync(directory)
    .filter((entry) => /\.(jpg|jpeg|png|webp)$/i.test(entry))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))[0];

  return file ? `/products/cosmeticos-pet/${folder}/${name}/${file}` : null;
}

export function feedImageFor(product: BioProduct): string | null {
  if (product.lineSlug === "cosmeticos-pet") {
    const image = petCosmeticImage(product);
    if (image) return image;
  }

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
