/**
 * BIO FLORAIS B2B — nome COMPLETO do produto em todo o B2B:
 * "<Tipo> <Nome> · <Linha> · <volume>", ex.: "Shampoo Agressividade ·
 * Cosméticos Pet · 500 ml". Só servidor (lê o catálogo do site); o B2C não é
 * alterado: este módulo apenas LÊ o catálogo.
 */

import { getProduct } from "@/lib/catalog/bio-products";

export type ProductLabel = {
  /** Tipo curto para o selo: Shampoo, Condicionador, Floral, Snack... */
  type: string;
  /** Nome base ("Agressividade"). */
  baseName: string;
  /** "<Tipo> <Nome>" ("Shampoo Agressividade"). */
  title: string;
  line: string;
  volume: string;
  /** "<Tipo> <Nome> · <Linha> · <volume>". */
  full: string;
};

const TYPE_SHORT: Record<string, string> = {
  "Floral em gotas": "Floral",
  "Floral dose única": "Floral dose única",
  "Floral de Ambiente": "Floral de ambiente",
};

const LINE_NAMES: Record<string, string> = {
  adulto: "Adulto",
  pet: "Pet",
  infantil: "Infantil",
  baby: "Baby",
  kids: "Kids",
  teen: "Teen",
  "dose-unica": "Dose Única",
  "virtudes-divinas": "Virtudes Divinas",
  cosmeticos: "Cosméticos",
  "cosmeticos-pet": "Cosméticos Pet",
  "home-care": "Home Care",
};

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Volume do catálogo ("500ml" vira "500 ml") — sempre com espaço, para ficar legível. */
function formatVolume(raw: string) {
  const text = raw.trim();
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)$/);
  return match ? `${match[1]} ${match[2]}` : text;
}

export function b2bProductLabel(product: {
  slug: string;
  name: string;
  category?: string | null;
  lineSlug?: string | null;
}): ProductLabel {
  const catalog = getProduct(product.slug);
  const category = catalog?.category ?? product.category ?? "";
  const baseName = (catalog?.name ?? product.name).trim();
  const line = catalog?.line ?? (product.lineSlug ? LINE_NAMES[product.lineSlug] ?? product.lineSlug : "");
  const volume = formatVolume(catalog?.content ?? "");
  const type = TYPE_SHORT[category] ?? category;

  // Não repete o tipo se o nome já o contém ("Shampoo Uso Diário") ou se o tipo é a própria linha.
  const redundant = !type || strip(baseName).startsWith(strip(type)) || strip(type) === strip(line);
  const title = redundant ? baseName : `${type} ${baseName}`;

  return {
    type: redundant && strip(type) === strip(line) ? "" : type,
    baseName,
    title,
    line,
    volume,
    full: [title, line, volume].filter(Boolean).join(" · "),
  };
}

const PLURAL_SCOPE: Record<string, string> = {
  "Sabonete Líquido": "os sabonetes líquidos",
  "Aromatizador Spray": "os aromatizadores de ambiente",
};

/**
 * Aviso ÚNICO do alcance de uma promoção por produtos (B9): em vez de listar item por item,
 * "os sabonetes líquidos", "o Spray para Hálito – Menta", "os aromatizadores de ambiente".
 * Exibido como "Oferta válida para <isto>".
 */
export function describeScope(products: Array<{ slug: string; name: string; category?: string | null; lineSlug?: string | null }>): string | null {
  if (products.length === 0) return null;

  const labels = products.map((product) => b2bProductLabel(product));

  if (products.length === 1) return `o ${labels[0].baseName.replace(" - ", " – ")}`;

  const types = new Set(
    products.map((product, index) => getProduct(product.slug)?.category ?? product.category ?? labels[index].type)
  );

  if (types.size === 1) {
    const category = Array.from(types)[0] ?? "";
    return PLURAL_SCOPE[category] ?? `os produtos da categoria ${category}`;
  }

  return products.length <= 3 ? labels.map((label) => label.title).join(", ") : `${products.length} produtos selecionados`;
}
