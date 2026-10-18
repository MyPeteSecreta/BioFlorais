/**
 * BIO FLORAIS B2B — DISPLAYS e KITS (Rodada 11). Fonte de verdade: PROMPTS_B2B\DISPLAYS_COMPOSICAO.md.
 *
 * O display é GRÁTIS para o lojista que compra o kit COMPLETO (composição fixa). "Mais vendidos" = a ordem dos
 * cards de produto da linha no site (bioCommercialOrder em Adulto/Pet; nas demais, a ordem do catálogo), lida na
 * hora. O display NÃO vira item do pedido: vai como BRINDE na sacola (R$ 0,00), pesa 200 g (30 × 30 × 3 cm) no frete
 * e segue para o Omie só como OBSERVAÇÃO ("+ 1 Display compacto Florais Adulto (brinde)").
 * Módulo puro (sem db/fs), usado no servidor e no navegador.
 */

import { bioCommercialOrder, getProductsByLine } from "@/lib/catalog/bio-products";

export const DISPLAY_WEIGHT_GRAMS = 200;
export const DISPLAY_DIMENSIONS_CM = { length: 30, width: 30, height: 3 } as const;

/** Faixa de limite do display no mostruário (vendedor): 1 por linha a cada 180 dias, R$ 3,00 cada. */
export const SHOWCASE_DISPLAY_WINDOW_DAYS = 180;
export const SHOWCASE_DISPLAY_PRICE_CENTS = 300;
/** Kit Provador dos florais de ambiente no mostruário: R$ 2,00 fixos (fora do %). */
export const SHOWCASE_PROVADOR_PRICE_CENTS = 200;

type Composition =
  /** Itens e quantidades nomeados (slug = catálogo). */
  | { type: "named"; items: ReadonlyArray<{ slug: string; qty: number }> }
  /** Os `skus` mais vendidos da linha: os `doubleFirst` primeiros levam 2, os demais 1. */
  | { type: "ranked"; skus: number; doubleFirst: number };

export type DisplayDef = {
  /** Chave estável (= nome do arquivo da foto). */
  key: string;
  /** Código interno do display (observação do Omie e produto do mostruário). */
  code: string;
  lineSlug: string;
  /** Texto do card/sacola: "Display compacto Florais Adulto". */
  name: string;
  /** Rótulo curto na escolha de variações: "Compacto", "Médio"... */
  option: string;
  /** Texto curto de unidades: "13 unidades". */
  composition: Composition;
  /** Card próprio de destaque (kit compacto do Adulto). */
  featured?: boolean;
};

const A = (slug: string) => `adulto-floral-em-gotas-${slug}`;
const P = (slug: string) => `pet-floral-em-gotas-${slug}`;

/**
 * Fáceis de mudar (o Luis vai rever Baby): nº de SKUs do display; todos levam 2 de cada.
 * Baby = 11 SKUs x 2 = 22 un.; Dose Única = 6 SKUs x 2 = 12 un.
 */
export const BABY_SKUS = 11;
export const DOSE_UNICA_SKUS = 6;

export const BIO_DISPLAYS: readonly DisplayDef[] = [
  {
    key: "adulto-compacto",
    code: "BIO-DISP-ADULTO-COMPACTO",
    lineSlug: "adulto",
    name: "Display compacto Florais Adulto",
    option: "Compacto",
    featured: true,
    composition: {
      type: "named",
      items: [
        { slug: A("sensacao-de-ansiedade"), qty: 3 },
        { slug: A("rescue"), qty: 2 },
        { slug: A("sono"), qty: 2 },
        { slug: A("tristeza-estado-depressivo"), qty: 2 },
        { slug: A("medo"), qty: 1 },
        { slug: A("fase-da-menopausa"), qty: 1 },
        { slug: A("reducao-de-peso"), qty: 1 },
        { slug: A("stress"), qty: 1 },
      ],
    },
  },
  { key: "adulto-medio", code: "BIO-DISP-ADULTO-MEDIO", lineSlug: "adulto", name: "Display médio Florais Adulto", option: "Médio", composition: { type: "ranked", skus: 24, doubleFirst: 6 } },
  { key: "adulto-grande", code: "BIO-DISP-ADULTO-GRANDE", lineSlug: "adulto", name: "Display grande Florais Adulto", option: "Grande", composition: { type: "ranked", skus: 30, doubleFirst: 30 } },
  {
    key: "pet-12",
    code: "BIO-DISP-PET-12",
    lineSlug: "pet",
    name: "Display 12 Florais Pet",
    option: "12",
    composition: {
      type: "named",
      items: [
        // 2 no display + 1 de reposição para fechar o mínimo (13 un. = R$ 258,70, igual ao Adulto).
        { slug: P("ansiedade"), qty: 3 },
        { slug: P("lambedura-e-automutilacao"), qty: 2 },
        { slug: P("stress"), qty: 2 },
        { slug: P("agressividade"), qty: 1 },
        { slug: P("coprofagia"), qty: 1 },
        { slug: P("hiperatividade"), qty: 1 },
        { slug: P("latido-excessivo"), qty: 1 },
        { slug: P("medo"), qty: 1 },
        { slug: P("s-o-s"), qty: 1 },
      ],
    },
  },
  { key: "pet-30", code: "BIO-DISP-PET-30", lineSlug: "pet", name: "Display 30 Florais Pet", option: "30", composition: { type: "ranked", skus: 24, doubleFirst: 6 } },
  { key: "pet-44", code: "BIO-DISP-PET-44", lineSlug: "pet", name: "Display 44 Florais Pet", option: "44", composition: { type: "ranked", skus: 22, doubleFirst: 22 } },
  { key: "baby", code: "BIO-DISP-BABY", lineSlug: "baby", name: "Display Florais Baby", option: "Único", composition: { type: "ranked", skus: BABY_SKUS, doubleFirst: BABY_SKUS } },
  { key: "kids", code: "BIO-DISP-KIDS", lineSlug: "kids", name: "Display Florais Kids", option: "Único", composition: { type: "ranked", skus: 10, doubleFirst: 10 } },
  { key: "teen", code: "BIO-DISP-TEEN", lineSlug: "teen", name: "Display Florais Teen", option: "Único", composition: { type: "ranked", skus: 10, doubleFirst: 10 } },
  { key: "infantil", code: "BIO-DISP-INFANTIL", lineSlug: "infantil", name: "Display Florais Infantil", option: "Único", composition: { type: "ranked", skus: 10, doubleFirst: 10 } },
  { key: "virtudes-divinas", code: "BIO-DISP-VIRTUDES-DIVINAS", lineSlug: "virtudes-divinas", name: "Display Virtudes Divinas", option: "Único", composition: { type: "ranked", skus: 36, doubleFirst: 0 } },
  { key: "dose-unica", code: "BIO-DISP-DOSE-UNICA", lineSlug: "dose-unica", name: "Display Dose Única", option: "Único", composition: { type: "ranked", skus: DOSE_UNICA_SKUS, doubleFirst: DOSE_UNICA_SKUS } },
];

/** Kit Provador do mostruário (produtos internos, não visíveis no B2C). */
export const BIO_PROVADOR_CODES = [
  { code: "BIO-PROV-ITSBLOSSOM", slug: "bio-prov-itsblossom", name: "Kit Provador Aromatizador It's Blossom", lineSlug: "home-care" },
  { code: "BIO-PROV-AMBPET", slug: "bio-prov-ambpet", name: "Kit Provador floral de ambiente Pet", lineSlug: "cosmeticos-pet" },
] as const;

export function displayByKey(key: string): DisplayDef | undefined {
  return BIO_DISPLAYS.find((display) => display.key === key);
}

/** Slug do produto interno do display no mostruário (vazio, R$ 3,00). */
export const showcaseDisplaySlug = (display: Pick<DisplayDef, "code">) => display.code.toLowerCase();

/**
 * Slugs da linha na ORDEM dos cards do site (mais vendido primeiro). Adulto e Pet seguem bioCommercialOrder; as
 * demais, a ordem do catálogo. Só florais (sem Snack Floral).
 */
export function rankedLineSlugs(lineSlug: string): string[] {
  const inLine = getProductsByLine(lineSlug).filter((product) => !/snack/i.test(product.category));
  const exists = new Set(inLine.map((product) => product.slug));
  const commercial: readonly string[] | null =
    lineSlug === "adulto" ? bioCommercialOrder.adulto.slugs : lineSlug === "pet" ? bioCommercialOrder.pet.slugs : null;

  if (!commercial) return inLine.map((product) => product.slug);

  const ordered = commercial.filter((slug) => exists.has(slug));
  const rest = inLine.map((product) => product.slug).filter((slug) => !ordered.includes(slug));

  return [...ordered, ...rest];
}

export type KitItem = { slug: string; qty: number };

/** Composição FIXA do kit (o lojista não escolhe sabores). */
export function composeKit(display: DisplayDef): KitItem[] {
  if (display.composition.type === "named") return display.composition.items.map((item) => ({ ...item }));

  const { skus, doubleFirst } = display.composition;

  return rankedLineSlugs(display.lineSlug)
    .slice(0, skus)
    .map((slug, index) => ({ slug, qty: index < doubleFirst ? 2 : 1 }));
}

export const kitUnits = (items: readonly KitItem[]) => items.reduce((sum, item) => sum + item.qty, 0);

/** Frase do card: "13 unidades (12 no display + 1 Ansiedade de reposição) · display grátis". */
export function kitSummary(display: DisplayDef, units: number): string {
  // Compacto Adulto e Pet 12: 12 no display + 1 Ansiedade de reposição (fecha o mínimo de R$ 250).
  if (display.key === "adulto-compacto" || display.key === "pet-12") {
    return `${units} unidades (12 no display + 1 Ansiedade de reposição) · display grátis`;
  }

  return `${units} unidades · display grátis`;
}

export const DISPLAY_FREE_RULE_TEXT = "O display vem grátis com o kit completo.";

/** Observação do Pedido de Venda no Omie para cada display do pedido. */
export function displayOmieObservation(display: Pick<DisplayDef, "name">, count = 1): string {
  return `+ ${count} ${display.name} (brinde)`;
}

/**
 * Valida os displays do pedido contra as linhas: cada display exige o kit COMPLETO (qty por slug >= composição × vezes)
 * e estar ligado no admin. Repetir a chave = mais de um kit.
 */
export function validateDisplays(
  keys: unknown,
  qtyBySlug: ReadonlyMap<string, number>,
  disabled: ReadonlySet<string> = new Set()
): { ok: true; displays: Array<{ display: DisplayDef; count: number }> } | { ok: false; error: string } {
  if (keys === undefined || keys === null) return { ok: true, displays: [] };
  if (!Array.isArray(keys) || keys.length > 20) return { ok: false, error: "Displays inválidos." };

  const counts = new Map<string, number>();

  for (const raw of keys) {
    const key = String(raw ?? "");
    if (!displayByKey(key)) return { ok: false, error: "Display inválido." };
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const needed = new Map<string, number>();
  const displays: Array<{ display: DisplayDef; count: number }> = [];

  for (const [key, count] of counts) {
    const display = displayByKey(key)!;

    if (disabled.has(key)) return { ok: false, error: `O ${display.name} não está disponível no momento.` };

    for (const item of composeKit(display)) needed.set(item.slug, (needed.get(item.slug) ?? 0) + item.qty * count);
    displays.push({ display, count });
  }

  for (const [slug, qty] of needed) {
    if ((qtyBySlug.get(slug) ?? 0) < qty) {
      return { ok: false, error: `${DISPLAY_FREE_RULE_TEXT} Complete o kit ou remova o display do pedido.` };
    }
  }

  return { ok: true, displays };
}

/** Quantos displays estão com o kit completo (cliente: o que sobra na sacola; servidor: mesma regra). */
export function completeDisplayCounts(
  keys: readonly string[],
  qtyBySlug: ReadonlyMap<string, number>
): Map<string, number> {
  const result = new Map<string, number>();
  const remaining = new Map(qtyBySlug);

  for (const key of keys) {
    const display = displayByKey(key);
    if (!display) continue;
    const kit = composeKit(display);

    if (kit.every((item) => (remaining.get(item.slug) ?? 0) >= item.qty)) {
      for (const item of kit) remaining.set(item.slug, (remaining.get(item.slug) ?? 0) - item.qty);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
  }

  return result;
}
