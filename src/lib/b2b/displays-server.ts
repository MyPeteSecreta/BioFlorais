/**
 * BIO FLORAIS B2B — displays no servidor: foto (public/b2b/displays/<nome-fixo>.<ext>), liga/desliga do admin e
 * montagem dos cards de kit de uma linha. A foto SEMPRE é opcional: sem arquivo, o card usa a imagem da linha + selo
 * "Display" (basta colocar o arquivo com o nome certo e publicar; nenhuma mudança de código).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { BIO_DISPLAYS, composeKit, displayByKey, kitSummary, kitUnits, type DisplayDef } from "@/lib/b2b/displays";
import type { KitCardView, KitCartItem, KitOption } from "@/lib/b2b/displays-view";
import { homeLineImage } from "@/lib/b2b/line-images";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { resolveB2BUnitPriceCents } from "@/lib/b2b/pricing";
import { getProduct } from "@/lib/catalog/bio-products";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { getProductMainImage } from "@/lib/catalog/product-images.server";

const PHOTO_EXTENSIONS = ["webp", "jpg", "jpeg", "png"] as const;
const SETTING_KEY = "displays_disabled";

/** URL pública da foto do display, ou null se o arquivo ainda não chegou. */
export function displayPhotoUrl(key: string, root = process.cwd()): string | null {
  for (const extension of PHOTO_EXTENSIONS) {
    if (existsSync(join(root, "public", "b2b", "displays", `${key}.${extension}`))) {
      return `/b2b/displays/${key}.${extension}`;
    }
  }

  return null;
}

/** Displays desligados no admin (padrão: todos ligados; sem a tabela de ajustes, todos ligados). */
export async function loadDisabledDisplays(run: SqlRunner): Promise<Set<string>> {
  try {
    const [row] = await run(`SELECT value FROM b2b_settings WHERE key = $1`, [SETTING_KEY]);
    return new Set(
      String(row?.value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => Boolean(displayByKey(item)))
    );
  } catch {
    return new Set();
  }
}

export async function saveDisabledDisplays(run: SqlRunner, disabled: Iterable<string>): Promise<void> {
  const value = Array.from(new Set(Array.from(disabled).filter((key) => Boolean(displayByKey(key))))).sort().join(",");

  await run(
    `INSERT INTO b2b_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTING_KEY, value]
  );
}

type LineProduct = { id: string; slug: string; name: string; category: string | null; b2cPriceCents: number };

/** Linhas (slug) que têm algum display ligado: selo "Com display" nos cards de linha. */
export function lineSlugsWithDisplay(disabled: ReadonlySet<string>): Set<string> {
  return new Set(BIO_DISPLAYS.filter((display) => !disabled.has(display.key)).map((display) => display.lineSlug));
}

function optionOf(display: DisplayDef, bySlug: ReadonlyMap<string, LineProduct>): KitOption | null {
  const items: KitCartItem[] = [];

  for (const item of composeKit(display)) {
    const product = bySlug.get(item.slug);
    // Produto da composição fora da linha liberada: o kit não pode ser montado inteiro.
    if (!product) return null;

    const catalog = getProduct(product.slug);

    items.push({
      productId: product.id,
      slug: product.slug,
      name: b2bProductLabel({ slug: product.slug, name: product.name, category: product.category }).full,
      image: catalog ? getProductMainImage(catalog) || null : null,
      priceCents: resolveB2BUnitPriceCents(product.b2cPriceCents, product.category),
      qty: item.qty,
    });
  }

  const units = kitUnits(items);

  return {
    key: display.key,
    label: display.option,
    displayName: display.name,
    units,
    skus: items.length,
    totalCents: items.reduce((sum, item) => sum + item.priceCents * item.qty, 0),
    items,
    photo: displayPhotoUrl(display.key),
    summary: kitSummary(display, units),
  };
}

/**
 * Cards de kit da LINHA (nada de outras linhas dentro de uma linha):
 *  - Adulto: "Kit display compacto 15 × 15" (destaque) + "Escolha seu display" (Compacto · Médio · Grande);
 *  - Pet: "Escolha seu display" (12 · 30 · 44);
 *  - Baby, Kids, Teen, Infantil, Virtudes Divinas, Dose Única: UM card "Kit com display".
 */
export function buildKitCards(
  lineSlug: string,
  lineProducts: readonly LineProduct[],
  disabled: ReadonlySet<string>
): KitCardView[] {
  const bySlug = new Map(lineProducts.map((product) => [product.slug, product]));
  const lineImage = homeLineImage(lineSlug);
  const options = BIO_DISPLAYS.filter((display) => display.lineSlug === lineSlug && !disabled.has(display.key))
    .map((display) => ({ display, option: optionOf(display, bySlug) }))
    .filter((entry): entry is { display: DisplayDef; option: KitOption } => entry.option !== null);

  if (options.length === 0) return [];

  const cards: KitCardView[] = [];
  const featured = options.find((entry) => entry.display.featured);

  if (featured) {
    cards.push({
      id: `kit-${featured.display.key}`,
      title: "Kit display compacto 15 × 15",
      options: [featured.option],
      featured: true,
      lineImage,
    });
  }

  if (lineSlug === "adulto" || lineSlug === "pet") {
    cards.push({ id: `escolha-${lineSlug}`, title: "Escolha seu display", options: options.map((entry) => entry.option), featured: false, lineImage });
  } else {
    cards.push({ id: `kit-${lineSlug}`, title: "Kit com display", options: [options[0].option], featured: false, lineImage });
  }

  return cards;
}
