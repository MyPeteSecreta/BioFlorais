/*
 * BIO FLORAIS B2B — MOSTRUÁRIO do vendedor/RCA.
 *
 * O vendedor compra amostras para si numa loja interna: só entram os itens liberados pelo admin
 * (grupos em b2b_showcase_groups), no preço de mostruário (% do preço B2C, mesmo arredondamento
 * "reais + 0,90" do B2B), só no MENOR volume, com limite por grupo (ou por linha) numa janela móvel
 * de dias. O servidor revalida tudo; a tela só mostra.
 *
 * Regras fixas (decisão 13/10): CONDICIONADOR fica fora em todas as linhas (inclusive combo);
 * item que não está em nenhum grupo ativo é indisponível; linha nova nunca entra sozinha.
 *
 * Este arquivo é puro + consultas sobre SqlRunner (testável em PGlite, sem Next/db).
 */

import { roundB2BUnitPriceCents } from "@/lib/b2b/pricing";
import type { SqlRunner } from "@/lib/b2b/ownership";

/** Valor de orders.origin (SQL 37b) que marca o pedido de mostruário. */
export const SHOWCASE_ORIGIN = "mostruario";
export const SHOWCASE_DEFAULT_PERCENT = 15;
export const SHOWCASE_DEFAULT_WINDOW_DAYS = 45;
/** Pedido Pix/cartão ainda não pago segura a cota por este tempo (evita burlar o limite abrindo vários). */
export const SHOWCASE_PENDING_HOLD_MINUTES = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ShowcaseGroup = {
  id: string;
  name: string;
  lineSlugs: string[];
  categories: string[];
  nameIncludes: string[];
  nameExcludes: string[];
  limitQty: number;
  perLine: boolean;
  lowestVolumeOnly: boolean;
  active: boolean;
  sortOrder: number;
};

/** Produto candidato (catálogo + preço do banco). */
export type ShowcaseCandidate = {
  id: string;
  slug: string;
  name: string;
  category: string;
  lineSlug: string;
  /** Volume do catálogo: "500 ml", "5 L", "140g". */
  content: string;
  /** Preço B2C do banco (centavos). */
  b2cPriceCents: number;
};

export type ShowcaseUsageRow = { productId: string; qty: number; createdAt: Date };

const strip = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Percentual com até 2 casas, entre 1 e 100. */
export function parseShowcasePercent(value: unknown): number | null {
  const number = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(number) || number < 1 || number > 100) return null;
  return Math.round(number * 100) / 100;
}

export function parseShowcaseWindowDays(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 365) return null;
  return number;
}

/** Preço de mostruário: % do B2C, arredondado com a regra "reais + 0,90" do preço B2B. */
export function showcasePriceCents(b2cPriceCents: number, percent: number): number {
  const hundredths = Math.round(percent * 100); // 15% -> 1500
  return roundB2BUnitPriceCents((Math.max(0, b2cPriceCents) * hundredths) / 10_000);
}

/** Condicionador está FORA de tudo (inclusive combo shampoo + condicionador). */
export function isShowcaseExcludedProduct(product: Pick<ShowcaseCandidate, "name" | "category" | "slug">): boolean {
  return /condicionador|combo/.test(`${strip(product.category)} ${strip(product.name)} ${strip(product.slug)}`);
}

/** "500 ml" -> 500; "5 L" -> 5000; "140g" -> 140; "1 kg" -> 1000. Sem número = null. */
export function parseShowcaseVolume(content: unknown): number | null {
  const match = String(content ?? "")
    .replace(",", ".")
    .match(/(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === "l" || unit === "kg" ? value * 1000 : value;
}

function groupMatches(group: ShowcaseGroup, product: ShowcaseCandidate): boolean {
  // Sem linha e sem categoria o grupo não casa com nada (nunca "tudo").
  if (group.lineSlugs.length === 0 && group.categories.length === 0) return false;

  const line = strip(product.lineSlug);
  const category = strip(product.category);
  const name = strip(`${product.name} ${product.category}`);

  if (group.lineSlugs.length > 0 && !group.lineSlugs.map(strip).includes(line)) return false;
  if (group.categories.length > 0 && !group.categories.map(strip).includes(category)) return false;
  if (group.nameIncludes.length > 0 && !group.nameIncludes.some((part) => strip(part) && name.includes(strip(part)))) return false;
  if (group.nameExcludes.some((part) => strip(part) && name.includes(strip(part)))) return false;

  return true;
}

export type ShowcaseCatalogEntry = {
  product: ShowcaseCandidate;
  group: ShowcaseGroup;
  /** Chave da cota: grupo (ou grupo + linha, nos grupos "por linha"). */
  key: string;
  lineSlug: string;
  priceCents: number;
};

/**
 * Itens liberados: cada produto cai no PRIMEIRO grupo ativo (por sort_order) que o aceita;
 * condicionador sai; nos grupos "só menor volume" só fica a variação de menor volume
 * (irmãos = mesma linha + categoria + nome).
 */
export function buildShowcaseCatalog(
  groups: readonly ShowcaseGroup[],
  candidates: readonly ShowcaseCandidate[],
  percent: number
): Map<string, ShowcaseCatalogEntry> {
  const active = groups
    .filter((group) => group.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const assigned: Array<{ product: ShowcaseCandidate; group: ShowcaseGroup }> = [];

  for (const product of candidates) {
    if (isShowcaseExcludedProduct(product)) continue;
    const group = active.find((candidate) => groupMatches(candidate, product));
    if (group) assigned.push({ product, group });
  }

  const minVolume = new Map<string, number>();
  const siblingKey = (product: ShowcaseCandidate) => `${strip(product.lineSlug)}|${strip(product.category)}|${strip(product.name)}`;

  for (const { product, group } of assigned) {
    if (!group.lowestVolumeOnly) continue;
    const volume = parseShowcaseVolume(product.content);
    if (volume === null) continue;
    const key = `${group.id}|${siblingKey(product)}`;
    minVolume.set(key, Math.min(minVolume.get(key) ?? Infinity, volume));
  }

  const catalog = new Map<string, ShowcaseCatalogEntry>();

  for (const { product, group } of assigned) {
    if (group.lowestVolumeOnly) {
      const volume = parseShowcaseVolume(product.content);
      const lowest = minVolume.get(`${group.id}|${siblingKey(product)}`);
      if (volume !== null && lowest !== undefined && volume > lowest) continue;
    }

    catalog.set(product.id, {
      product,
      group,
      key: group.perLine ? `${group.id}:${strip(product.lineSlug)}` : group.id,
      lineSlug: product.lineSlug,
      priceCents: showcasePriceCents(product.b2cPriceCents, percent),
    });
  }

  return catalog;
}

export type ShowcaseQuota = {
  key: string;
  groupId: string;
  groupName: string;
  lineSlug: string | null;
  limit: number;
  used: number;
  remaining: number;
  /** Quando a compra mais antiga da janela sai e libera de novo (null = nada usado). */
  releasesAt: Date | null;
};

/** Uso na janela por cota. `usage` já vem filtrado pela janela e pelos pedidos que contam. */
export function buildShowcaseQuotas(
  catalog: ReadonlyMap<string, ShowcaseCatalogEntry>,
  usage: readonly ShowcaseUsageRow[],
  windowDays: number,
  now: Date = new Date()
): Map<string, ShowcaseQuota> {
  const quotas = new Map<string, ShowcaseQuota>();

  for (const entry of catalog.values()) {
    if (quotas.has(entry.key)) continue;
    quotas.set(entry.key, {
      key: entry.key,
      groupId: entry.group.id,
      groupName: entry.group.name,
      lineSlug: entry.group.perLine ? entry.lineSlug : null,
      limit: entry.group.limitQty,
      used: 0,
      remaining: entry.group.limitQty,
      releasesAt: null,
    });
  }

  const windowStart = now.getTime() - windowDays * DAY_MS;

  for (const row of usage) {
    if (row.createdAt.getTime() <= windowStart) continue;
    const entry = catalog.get(row.productId);
    const quota = entry ? quotas.get(entry.key) : undefined;
    if (!quota) continue;

    quota.used += row.qty;
    const releases = new Date(row.createdAt.getTime() + windowDays * DAY_MS);
    if (!quota.releasesAt || releases.getTime() < quota.releasesAt.getTime()) quota.releasesAt = releases;
  }

  for (const quota of quotas.values()) {
    quota.remaining = Math.max(0, quota.limit - quota.used);
  }

  return quotas;
}

export type ShowcaseLineQuota = {
  lineSlug: string;
  /** Teto de UNIDADES da linha na janela (override do admin ou, por padrão, a soma dos limites dos grupos da linha). */
  cap: number;
  /** true = o admin definiu o teto (difere do padrão). */
  custom: boolean;
  defaultCap: number;
  used: number;
  remaining: number;
  releasesAt: Date | null;
};

/**
 * TETO POR LINHA (adendo 15/10): máximo de unidades somando TODOS os itens da linha na janela.
 * Padrão = soma dos limites dos grupos/cotas que têm produto da linha; o admin pode sobrescrever.
 */
export function buildShowcaseLineQuotas(
  catalog: ReadonlyMap<string, ShowcaseCatalogEntry>,
  usage: readonly ShowcaseUsageRow[],
  windowDays: number,
  overrides: Readonly<Record<string, number>> = {},
  now: Date = new Date()
): Map<string, ShowcaseLineQuota> {
  const defaults = new Map<string, number>();
  const seen = new Set<string>();

  for (const entry of catalog.values()) {
    const line = strip(entry.lineSlug);
    const mark = `${entry.key}|${line}`;
    if (seen.has(mark)) continue;
    seen.add(mark);
    defaults.set(line, (defaults.get(line) ?? 0) + entry.group.limitQty);
  }

  const lines = new Map<string, ShowcaseLineQuota>();

  for (const [line, defaultCap] of defaults) {
    const override = overrides[line];
    const custom = Number.isInteger(override) && override >= 0 && override !== defaultCap;
    const cap = Number.isInteger(override) && override >= 0 ? override : defaultCap;
    lines.set(line, { lineSlug: line, cap, custom, defaultCap, used: 0, remaining: cap, releasesAt: null });
  }

  const windowStart = now.getTime() - windowDays * DAY_MS;

  for (const row of usage) {
    if (row.createdAt.getTime() <= windowStart) continue;
    const entry = catalog.get(row.productId);
    const quota = entry ? lines.get(strip(entry.lineSlug)) : undefined;
    if (!quota) continue;

    quota.used += row.qty;
    const releases = new Date(row.createdAt.getTime() + windowDays * DAY_MS);
    if (!quota.releasesAt || releases.getTime() < quota.releasesAt.getTime()) quota.releasesAt = releases;
  }

  for (const quota of lines.values()) quota.remaining = Math.max(0, quota.cap - quota.used);

  return lines;
}

/** Excedeu algum limite de grupo OU teto de linha? (reconferência depois de gravar o pedido) */
export function findShowcaseOverLimit(
  quotas: ReadonlyMap<string, ShowcaseQuota>,
  lineQuotas: ReadonlyMap<string, ShowcaseLineQuota>
): boolean {
  return (
    Array.from(quotas.values()).some((quota) => quota.used > quota.limit) ||
    Array.from(lineQuotas.values()).some((quota) => quota.used > quota.cap)
  );
}

export type ShowcaseCartLine = {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineSlug: string;
};

/** Valida o carrinho contra o catálogo liberado e as cotas. Nunca confia no preço da tela. */
export function validateShowcaseCart(
  items: unknown,
  catalog: ReadonlyMap<string, ShowcaseCatalogEntry>,
  quotas: ReadonlyMap<string, ShowcaseQuota>,
  lineQuotas?: ReadonlyMap<string, ShowcaseLineQuota>
): { ok: true; lines: ShowcaseCartLine[]; subtotalCents: number } | { ok: false; error: string; status: number } {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Escolha ao menos um item do mostruário.", status: 400 };
  }

  const qtyByProduct = new Map<string, number>();

  for (const raw of items) {
    const item = raw as { productId?: unknown; qty?: unknown };
    const productId = String(item?.productId ?? "");
    const qty = Number(item?.qty);

    if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "Quantidade inválida no mostruário.", status: 400 };
    }

    qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + qty);
  }

  const usedByKey = new Map<string, number>();
  const lines: ShowcaseCartLine[] = [];

  for (const [productId, qty] of qtyByProduct) {
    const entry = catalog.get(productId);

    if (!entry) {
      return { ok: false, error: "Um dos itens não está disponível para mostruário.", status: 400 };
    }

    usedByKey.set(entry.key, (usedByKey.get(entry.key) ?? 0) + qty);
    lines.push({
      productId,
      slug: entry.product.slug,
      name: entry.product.name,
      qty,
      unitPriceCents: entry.priceCents,
      lineSlug: entry.lineSlug,
    });
  }

  for (const [key, qty] of usedByKey) {
    const quota = quotas.get(key);
    if (!quota || qty > quota.remaining) {
      const left = quota?.remaining ?? 0;
      const label = quota ? `${quota.groupName}${quota.lineSlug ? ` (${quota.lineSlug})` : ""}` : "este grupo";
      return {
        ok: false,
        error:
          left > 0
            ? `Limite do mostruário: ${label} — você ainda pode pegar ${left}.`
            : `Limite do mostruário atingido em ${label}. Aguarde a liberação para pedir de novo.`,
        status: 409,
      };
    }
  }

  // Teto da linha: soma de TODAS as unidades da linha (qualquer grupo) no carrinho + o já usado na janela.
  if (lineQuotas) {
    const usedByLine = new Map<string, number>();

    for (const line of lines) {
      const key = strip(line.lineSlug);
      usedByLine.set(key, (usedByLine.get(key) ?? 0) + line.qty);
    }

    for (const [key, qty] of usedByLine) {
      const quota = lineQuotas.get(key);
      if (!quota || qty > quota.remaining) {
        const left = quota?.remaining ?? 0;
        return {
          ok: false,
          error:
            left > 0
              ? `Teto da linha no mostruário: você ainda pode pedir ${left} desta linha.`
              : "Teto da linha no mostruário atingido. Aguarde a liberação para pedir de novo.",
          status: 409,
        };
      }
    }
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
  return { ok: true, lines, subtotalCents };
}

/**
 * Frete do mostruário: SEMPRE a tarifa regional especial, qualquer que seja o valor do pedido.
 * Usa a modalidade mais barata cotada (o custo real fica preservado em realPriceCents).
 */
export function applyShowcaseFreight(
  options: readonly { serviceName: string; priceCents: number; etaDays: number }[],
  regionalFlatCents: number
): Array<{ serviceName: string; etaDays: number; priceCents: number; realPriceCents: number }> {
  if (options.length === 0) return [];
  const cheapest = options.reduce((best, option) => (option.priceCents < best.priceCents ? option : best), options[0]);

  return [
    {
      serviceName: cheapest.serviceName,
      etaDays: cheapest.etaDays,
      priceCents: regionalFlatCents,
      realPriceCents: cheapest.priceCents,
    },
  ];
}

/** Quem pode pedir: cadastro COMPLETO (documento e endereço) e fora do teste/demonstração. */
export type ShowcaseEligibility = { ok: true } | { ok: false; reason: "demo" | "trial" | "incomplete"; message: string };

export function showcaseEligibility(input: {
  isDemo: boolean;
  accessState: "complete" | "trial" | "expired";
  cpf: string | null;
  cnpj: string | null;
  postalCode: string | null;
  street: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}): ShowcaseEligibility {
  if (input.isDemo) {
    return { ok: false, reason: "demo", message: "O mostruário não está disponível na demonstração." };
  }

  if (input.accessState !== "complete") {
    return { ok: false, reason: "trial", message: "Complete seu cadastro para solicitar o mostruário." };
  }

  const has = (value: string | null) => Boolean(value && value.trim());
  const document = has(input.cpf) || has(input.cnpj);
  const address =
    has(input.postalCode) && has(input.street) && has(input.addressNumber) && has(input.neighborhood) && has(input.city) && has(input.state);

  if (!document || !address) {
    return { ok: false, reason: "incomplete", message: "Complete seu cadastro (CPF/CNPJ e endereço) para solicitar o mostruário." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const textArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];

export type ShowcaseConfig = {
  /** false = SQL 39b ainda não aplicado. */
  available: boolean;
  percent: number;
  windowDays: number;
  groups: ShowcaseGroup[];
  /** Tetos por linha definidos no admin (linha -> unidades). Sem entrada = padrão (soma dos grupos). */
  lineCaps: Record<string, number>;
};

export async function loadShowcaseConfig(run: SqlRunner): Promise<ShowcaseConfig> {
  try {
    const [groupRows, settingRows] = await Promise.all([
      run(
        `SELECT id, name, line_slugs, categories, name_includes, name_excludes, limit_qty, per_line,
                lowest_volume_only, active, sort_order
           FROM b2b_showcase_groups ORDER BY sort_order, name`
      ),
      run(`SELECT key, value FROM b2b_settings WHERE key IN ('showcase_price_percent', 'showcase_window_days')`).catch(() => []),
    ]);
    const setting = (key: string) => settingRows.find((row) => String(row.key) === key)?.value;
    // Tetos por linha (SQL 40b). Sem a tabela: só o padrão (soma dos limites dos grupos).
    const capRows = await run(`SELECT line_slug, cap_qty FROM b2b_showcase_line_caps`).catch(() => []);
    const lineCaps: Record<string, number> = {};
    for (const row of capRows) lineCaps[strip(row.line_slug)] = Number(row.cap_qty);

    return {
      available: true,
      percent: parseShowcasePercent(setting("showcase_price_percent")) ?? SHOWCASE_DEFAULT_PERCENT,
      windowDays: parseShowcaseWindowDays(setting("showcase_window_days")) ?? SHOWCASE_DEFAULT_WINDOW_DAYS,
      lineCaps,
      groups: groupRows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        lineSlugs: textArray(row.line_slugs),
        categories: textArray(row.categories),
        nameIncludes: textArray(row.name_includes),
        nameExcludes: textArray(row.name_excludes),
        limitQty: Number(row.limit_qty ?? 0),
        perLine: Boolean(row.per_line),
        lowestVolumeOnly: Boolean(row.lowest_volume_only),
        active: Boolean(row.active),
        sortOrder: Number(row.sort_order ?? 0),
      })),
    };
  } catch {
    return { available: false, percent: SHOWCASE_DEFAULT_PERCENT, windowDays: SHOWCASE_DEFAULT_WINDOW_DAYS, groups: [], lineCaps: {} };
  }
}

/**
 * Itens pedidos pelo vendedor na janela: pedidos de mostruário pagos, ou ainda pendentes há menos de
 * SHOWCASE_PENDING_HOLD_MINUTES (cota reservada). Cancelados/expirados não contam.
 */
export async function loadShowcaseUsage(
  run: SqlRunner,
  responsibleId: string,
  windowDays: number
): Promise<ShowcaseUsageRow[]> {
  try {
    const rows = await run(
      `SELECT i.product_id, i.qty,
              to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' AS created_at
         FROM orders o
         JOIN order_items i ON i.order_id = o.id
        WHERE o.b2b_responsible_id = $1::uuid
          AND to_jsonb(o) ->> 'origin' = $2
          AND o.created_at > now() - ($3::int * interval '1 day')
          AND (
            o.status IN ('paid', 'approved')
            OR (o.status = 'pending' AND o.created_at > now() - ($4::int * interval '1 minute'))
          )`,
      [responsibleId, SHOWCASE_ORIGIN, windowDays, SHOWCASE_PENDING_HOLD_MINUTES]
    );

    return rows.map((row) => ({
      productId: String(row.product_id),
      qty: Number(row.qty ?? 0),
      createdAt: new Date(String(row.created_at)),
    }));
  } catch {
    return [];
  }
}

/** Ids dos pedidos de mostruário (selo no admin de pedidos). Sem o SQL 37b: nenhum. */
export async function loadShowcaseOrderIds(run: SqlRunner): Promise<Set<string>> {
  try {
    const rows = await run(`SELECT id FROM orders WHERE to_jsonb(orders) ->> 'origin' = $1`, [SHOWCASE_ORIGIN]);
    return new Set(rows.map((row) => String(row.id)));
  } catch {
    return new Set();
  }
}
