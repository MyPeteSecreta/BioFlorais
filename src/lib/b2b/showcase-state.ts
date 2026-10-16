/*
 * BIO FLORAIS B2B — estado do mostruário de UM vendedor: configuração do admin, elegibilidade,
 * itens liberados (menor volume, preço de mostruário) e cota restante por grupo/linha.
 * Tudo sobre SqlRunner (sem Next/db): a tela, a cotação e o pedido usam esta MESMA função, então
 * o servidor revalida exatamente o que a tela mostrou.
 */

import { getProduct } from "@/lib/catalog/bio-products";
import { loadDemoState } from "@/lib/b2b/demo";
import type { SqlRunner } from "@/lib/b2b/ownership";
import { b2bProductLabel } from "@/lib/b2b/product-label";
import { loadVendorAccess } from "@/lib/b2b/vendor-profile";
import {
  buildShowcaseCatalog,
  buildShowcaseLineQuotas,
  buildShowcaseQuotas,
  loadShowcaseConfig,
  loadShowcaseUsage,
  showcaseEligibility,
  type ShowcaseCandidate,
  type ShowcaseCatalogEntry,
  type ShowcaseConfig,
  type ShowcaseEligibility,
  type ShowcaseLineQuota,
  type ShowcaseQuota,
} from "@/lib/b2b/showcase";

export type ShowcaseVendor = {
  id: string;
  name: string;
  email: string;
  phone: string;
  personType: "pf" | "pj";
  cpf: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  type: string;
};

export type ShowcaseState = {
  config: ShowcaseConfig;
  vendor: ShowcaseVendor | null;
  eligibility: ShowcaseEligibility;
  catalog: Map<string, ShowcaseCatalogEntry>;
  quotas: Map<string, ShowcaseQuota>;
  /** Teto por linha na janela (chave = código da linha em minúsculas). */
  lineQuotas: Map<string, ShowcaseLineQuota>;
};

const text = (value: unknown) => String(value ?? "").trim();

export async function loadShowcaseVendor(run: SqlRunner, responsibleId: string): Promise<ShowcaseVendor | null> {
  const [row] = await run(
    `SELECT id, type, name, email, phone, person_type, cpf, cnpj, state_registration, postal_code, street,
            address_number, address_complement, neighborhood, city, state
       FROM b2b_responsibles WHERE id = $1::uuid AND status = 'active' LIMIT 1`,
    [responsibleId]
  );

  if (!row) return null;

  return {
    id: String(row.id),
    type: String(row.type ?? ""),
    name: text(row.name),
    email: text(row.email).toLowerCase(),
    phone: text(row.phone).replace(/\D/g, ""),
    personType: row.person_type === "pj" ? "pj" : "pf",
    cpf: text(row.cpf).replace(/\D/g, "") || null,
    cnpj: text(row.cnpj).replace(/\D/g, "") || null,
    stateRegistration: text(row.state_registration) || null,
    postalCode: text(row.postal_code).replace(/\D/g, ""),
    street: text(row.street),
    addressNumber: text(row.address_number),
    addressComplement: text(row.address_complement),
    neighborhood: text(row.neighborhood),
    city: text(row.city),
    state: text(row.state).toUpperCase(),
  };
}

export async function loadCandidates(run: SqlRunner): Promise<ShowcaseCandidate[]> {
  const rows = await run(
    `SELECT id, slug, name, category, line_slug, price_cents FROM products WHERE active = true AND price_cents > 0`
  );

  return rows.map((row) => {
    const slug = String(row.slug);
    const catalog = getProduct(slug);

    return {
      id: String(row.id),
      slug,
      name: String(catalog?.name ?? row.name),
      category: String(catalog?.category ?? row.category ?? ""),
      lineSlug: String(catalog?.lineSlug ?? row.line_slug ?? ""),
      content: String(catalog?.content ?? ""),
      b2cPriceCents: Number(row.price_cents),
    };
  });
}

export async function loadShowcaseState(run: SqlRunner, responsibleId: string, now: Date = new Date()): Promise<ShowcaseState> {
  const [config, vendor, demo, access] = await Promise.all([
    loadShowcaseConfig(run),
    loadShowcaseVendor(run, responsibleId).catch(() => null),
    loadDemoState(run, responsibleId, now),
    loadVendorAccess(run, responsibleId, now),
  ]);

  const eligibility: ShowcaseEligibility = !vendor
    ? { ok: false, reason: "incomplete", message: "Cadastro do vendedor não encontrado." }
    : showcaseEligibility({
        isDemo: demo.isDemo,
        accessState: access.state,
        cpf: vendor.cpf,
        cnpj: vendor.cnpj,
        postalCode: vendor.postalCode,
        street: vendor.street,
        addressNumber: vendor.addressNumber,
        neighborhood: vendor.neighborhood,
        city: vendor.city,
        state: vendor.state,
      });

  if (!config.available || !eligibility.ok) {
    return { config, vendor, eligibility, catalog: new Map(), quotas: new Map(), lineQuotas: new Map() };
  }

  const [candidates, usage] = await Promise.all([
    loadCandidates(run),
    loadShowcaseUsage(run, responsibleId, config.windowDays),
  ]);
  const catalog = buildShowcaseCatalog(config.groups, candidates, config.percent);
  const quotas = buildShowcaseQuotas(catalog, usage, config.windowDays, now);

  const lineQuotas = buildShowcaseLineQuotas(catalog, usage, config.windowDays, config.lineCaps, now);

  return { config, vendor, eligibility, catalog, quotas, lineQuotas };
}

// ---------------------------------------------------------------------------
// Visão para a tela (JSON simples)
// ---------------------------------------------------------------------------

export type ShowcaseViewProduct = {
  id: string;
  slug: string;
  label: string;
  title: string;
  volume: string;
  priceCents: number;
  b2cPriceCents: number;
  /** Linha do produto (chave do teto da linha). */
  lineKey: string;
};

export type ShowcaseViewLine = {
  key: string;
  name: string;
  cap: number;
  used: number;
  remaining: number;
  releasesAt: string | null;
};

export type ShowcaseViewSection = {
  key: string;
  order: number;
  title: string;
  limit: number;
  used: number;
  remaining: number;
  releasesAt: string | null;
  products: ShowcaseViewProduct[];
};

export function buildShowcaseView(state: ShowcaseState): { sections: ShowcaseViewSection[]; lines: ShowcaseViewLine[] } {
  const sections = new Map<string, ShowcaseViewSection>();
  const lineNames = new Map<string, string>();

  for (const entry of state.catalog.values()) {
    const quota = state.quotas.get(entry.key);
    if (!quota) continue;

    const label = b2bProductLabel({
      slug: entry.product.slug,
      name: entry.product.name,
      category: entry.product.category,
      lineSlug: entry.product.lineSlug,
    });

    if (!lineNames.has(entry.lineSlug)) lineNames.set(entry.lineSlug, label.line || entry.lineSlug);

    let section = sections.get(entry.key);

    if (!section) {
      section = {
        key: entry.key,
        order: entry.group.sortOrder,
        title: quota.lineSlug ? `${entry.group.name.replace(/\s*\(.*\)\s*$/, "")} · ${label.line || quota.lineSlug}` : entry.group.name,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        releasesAt: quota.releasesAt ? quota.releasesAt.toISOString() : null,
        products: [],
      };
      sections.set(entry.key, section);
    }

    section.products.push({
      id: entry.product.id,
      slug: entry.product.slug,
      label: label.title,
      title: label.title,
      volume: label.volume,
      priceCents: entry.priceCents,
      b2cPriceCents: entry.product.b2cPriceCents,
      lineKey: entry.lineSlug.toLowerCase(),
    });
  }

  const lines: ShowcaseViewLine[] = Array.from(state.lineQuotas.values())
    .map((quota) => ({
      key: quota.lineSlug,
      name: lineNames.get(quota.lineSlug) ?? Array.from(lineNames.entries()).find(([slug]) => slug.toLowerCase() === quota.lineSlug)?.[1] ?? quota.lineSlug,
      cap: quota.cap,
      used: quota.used,
      remaining: quota.remaining,
      releasesAt: quota.releasesAt ? quota.releasesAt.toISOString() : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const ordered = Array.from(sections.values())
    .map((section) => ({ ...section, products: section.products.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")) }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"));

  return { sections: ordered, lines };
}
