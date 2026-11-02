/**
 * Feeds de produtos para o Google Merchant Center (/feeds/google.xml) e o catálogo da Meta (/feeds/meta.csv).
 * Regras: título e descrição SEM promessa de saúde (a descrição é montada só com tipo, nome, linha e volume; nunca com
 * texto de benefício), imagem limpa (sem frase de benefício), preço em BRL, marca Bio Florais, GTIN só se existir,
 * nada de "Rescue" (o produto e a foto trazem a palavra: fica de fora até haver o rótulo S.O.S.) e nada de "Depressão".
 * Funções puras (a leitura de arquivos de imagem entra por `imageFor`), testáveis sem servidor.
 */

import type { BioProduct } from "@/lib/catalog/bio-products";
import { GTIN_BY_SLUG } from "@/lib/feeds/gtin-data";

export const FEED_BRAND = "Bio Florais";

/** Linhas cujas fotos de produto são frasco limpo (Adulto usa o recorte de public/feeds/adulto; Snack e Home Care ficam de fora). */
export const FEED_LINES: readonly string[] = ["adulto", "pet", "infantil", "baby", "kids", "teen", "virtudes-divinas", "dose-unica", "cosmeticos", "cosmeticos-pet"];

/** Nomes que nunca vão para os feeds: "Rescue" (usar S.O.S.; o rótulo da foto ainda traz RESCUE) e "Depressão" (termo de saúde). */
export const FEED_EXCLUDED_NAME_PATTERNS: readonly RegExp[] = [/rescue/i, /depress/i];

/** Categorias de arte de marketing (com frases): fora. */
export const FEED_EXCLUDED_CATEGORIES: readonly string[] = ["Snack Floral"];

/** GTIN (EAN-13) por slug: o que a Bio tem na planilha de EAN (ver gtin-data.ts). Quem não tem segue com identifier_exists = no. */
export const FEED_GTIN: Readonly<Record<string, string>> = GTIN_BY_SLUG;

/**
 * Etiqueta de anúncios (custom_label_0 no Google e na Meta): os itens de categoria sensível continuam no site e no feed, mas saem das
 * campanhas por esta etiqueta. Todo item leva um valor, para o filtro funcionar igual nas duas plataformas.
 */
export const FEED_AD_LABEL_EXCLUDED = "excluir_anuncios";
export const FEED_AD_LABEL_ALLOWED = "liberado";

/** Comparado com o slug (sem acento): peso, alimentação, lambedura/automutilação, pânico, parar de fumar e vícios. */
export const FEED_AD_EXCLUDED_SLUGS: readonly RegExp[] = [/reducao-de-peso/, /perda-de-peso/, /reequilibrio-alimentar/, /controle-alimentar/, /lambedura/, /automutilacao/, /panico/, /parar-de-fumar/, /vicios/];

export const feedAdLabel = (slug: string) => (FEED_AD_EXCLUDED_SLUGS.some((pattern) => pattern.test(slug)) ? FEED_AD_LABEL_EXCLUDED : FEED_AD_LABEL_ALLOWED);

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
};

const TYPE_SHORT: Record<string, string> = {
  "Floral em gotas": "Floral",
  "Floral dose única": "Floral dose única",
  "Floral de Ambiente": "Floral de ambiente",
};

export type FeedItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  price: string;
  availability: "in stock";
  condition: "new";
  brand: string;
  gtin: string | null;
  productType: string;
  adLabel: string;
};

export function isFeedEligible(product: Pick<BioProduct, "name" | "slug" | "category" | "lineSlug" | "priceCents">): boolean {
  if (!FEED_LINES.includes(product.lineSlug)) return false;
  if (FEED_EXCLUDED_CATEGORIES.includes(product.category)) return false;
  if (!product.priceCents || product.priceCents <= 0) return false;

  return !FEED_EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(product.name) || pattern.test(product.slug));
}

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export function feedTitle(product: Pick<BioProduct, "name" | "category" | "lineSlug" | "content">): string {
  const type = TYPE_SHORT[product.category] ?? product.category;
  const name = clean(product.name);
  // "Virtudes Divinas Amor" e "Shampoo Cabelos Normais" já dizem o tipo; o resto vira "Floral <nome>".
  const head = product.category === "Virtudes Divinas" ? `Virtudes Divinas ${name}` : `${type} ${name}`;

  return `${head} · Linha ${LINE_NAMES[product.lineSlug] ?? product.lineSlug} · ${clean(product.content)}`;
}

/**
 * Descrição neutra: só tipo, nome, linha e volume; sem promessa de saúde. "Sem álcool, flores frescas brasileiras" só nos florais
 * em gotas (afirmação já usada nos rótulos e no site).
 */
export function feedDescription(product: Pick<BioProduct, "name" | "category" | "lineSlug" | "content">): string {
  const type = TYPE_SHORT[product.category] ?? product.category;
  const line = LINE_NAMES[product.lineSlug] ?? product.lineSlug;
  const base = `${type} ${clean(product.name)} da linha ${line} da ${FEED_BRAND}, ${clean(product.content)}.`;

  if (product.category === "Floral em gotas") return `${base} Fórmula sem álcool, feita com flores frescas brasileiras. Uso conforme a embalagem.`;

  return `${base} Veja detalhes e modo de uso na embalagem e na página do produto.`;
}

export const feedPrice = (priceCents: number) => `${(priceCents / 100).toFixed(2)} BRL`;

/** Monta o item; devolve null se o produto não pode ir ao feed (regras acima ou sem imagem limpa). */
export function buildFeedItem(product: BioProduct, siteUrl: string, imageFor: (product: BioProduct) => string | null): FeedItem | null {
  if (!isFeedEligible(product)) return null;

  const image = imageFor(product);
  if (!image) return null;

  const base = siteUrl.replace(/\/+$/, "");

  return {
    id: product.slug,
    title: feedTitle(product),
    description: feedDescription(product),
    link: `${base}/produto/${product.slug}`,
    imageLink: `${base}${encodeURI(image)}`,
    price: feedPrice(product.priceCents as number),
    availability: "in stock",
    condition: "new",
    brand: FEED_BRAND,
    gtin: FEED_GTIN[product.slug] ?? null,
    productType: `${FEED_BRAND} > ${LINE_NAMES[product.lineSlug] ?? product.lineSlug}`,
    adLabel: feedAdLabel(product.slug),
  };
}

const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function renderGoogleFeedXml(items: FeedItem[], siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, "");

  const entries = items
    .map(
      (item) =>
        [
          "    <item>",
          `      <g:id>${xmlEscape(item.id)}</g:id>`,
          `      <g:title>${xmlEscape(item.title)}</g:title>`,
          `      <g:description>${xmlEscape(item.description)}</g:description>`,
          `      <g:link>${xmlEscape(item.link)}</g:link>`,
          `      <g:image_link>${xmlEscape(item.imageLink)}</g:image_link>`,
          `      <g:availability>${item.availability}</g:availability>`,
          `      <g:condition>${item.condition}</g:condition>`,
          `      <g:price>${item.price}</g:price>`,
          `      <g:brand>${xmlEscape(item.brand)}</g:brand>`,
          item.gtin ? `      <g:gtin>${xmlEscape(item.gtin)}</g:gtin>
      <g:identifier_exists>yes</g:identifier_exists>` : "      <g:identifier_exists>no</g:identifier_exists>",
          `      <g:product_type>${xmlEscape(item.productType)}</g:product_type>`,
          `      <g:custom_label_0>${xmlEscape(item.adLabel)}</g:custom_label_0>`,
          "    </item>",
        ].join("\n")
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>${FEED_BRAND}</title>\n    <link>${xmlEscape(base)}</link>\n    <description>Produtos ${FEED_BRAND}</description>\n${entries}\n  </channel>\n</rss>\n`;
}

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const META_CSV_COLUMNS = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "gtin", "product_type", "custom_label_0"] as const;

export function renderMetaFeedCsv(items: FeedItem[]): string {
  const rows = items.map((item) =>
    [item.id, item.title, item.description, item.availability, item.condition, item.price, item.link, item.imageLink, item.brand, item.gtin ?? "", item.productType, item.adLabel].map(csvCell).join(",")
  );

  return `${META_CSV_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}
