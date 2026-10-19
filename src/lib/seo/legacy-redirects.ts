/**
 * Redirects 301 do site antigo (URL-01). Função PURA: recebe o caminho e devolve o destino (ou null = não é URL antiga).
 * O middleware aplica 301 PRESERVANDO a query string inteira (utm_*, oppref). Dados em legacy-redirects.data.ts.
 *
 * Garantias:
 *  - Nunca toca URL atual: /, /linha/*, /produto/<slug válido>, /parceiros, /b2b/*, /acompanhe/*, /checkout, /api/*, /admin/*...
 *  - Nunca faz loop: o destino é sempre uma URL atual (testado: resolver(destino) === null).
 *  - /produto/<slug antigo>: casa pelo NOME do produto; sem casamento seguro -> linha mais próxima pelo prefixo; senão home.
 */

import { bioLines, bioProducts, getProduct } from "@/lib/catalog/bio-products";

import { LEGACY_CATEGORY_KEYWORDS, LEGACY_EXACT_ENTRIES, LEGACY_FA_ALIASES, LEGACY_LINE_PREFIXES } from "./legacy-redirects.data";

const EXACT = new Map<string, string>(LEGACY_EXACT_ENTRIES.map(([from, to]) => [from, to]));

/** Rotas ATUAIS (primeiro segmento) que nunca passam pelas regras genéricas. */
const CURRENT_ROOTS = new Set([
  "api", "admin", "b2b", "parceiros", "acompanhe", "acompanhe-seu-pedido", "checkout", "carrinho", "linha", "atendimento",
  "cookies", "privacidade", "termos-de-compra", "trocas-e-devolucoes", "frete-e-entrega", "sobre", "terapia-floral", "quiz",
  "ugc", "og", "assets", "products", "cardprodutos", "_next", "sitemap.xml", "robots.txt", "favicon.ico",
]);

const LINE_SLUGS = bioLines.map((line) => line.slug).sort((a, b) => b.length - a.length);

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "sensacao", "momento", "fase", "floral", "florais", "linha", "tradicional", "bio", "em", "gotas", "para", "com", "sem"]);
const LINE_WORDS = new Set(["adulto", "infantil", "baby", "kids", "teen", "pet", "dose", "unica", "virtudes", "divinas", "fa", "fk", "fb", "ft", "fv"]);
const VOLUME = /^\d+(ml|g|l|kg)$/;

export function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

const tokens = (slug: string) => slug.toLowerCase().split("-").filter(Boolean);
const meaningful = (list: string[]) => list.filter((token) => !STOP.has(token) && !LINE_WORDS.has(token) && !VOLUME.test(token) && !/^\d+$/.test(token));

/** Linha sugerida pelo próprio slug antigo (palavra de linha, volume típico ou prefixo curto fa/fk/fb/ft/fv). */
function lineHint(parts: string[]): string | null {
  const set = new Set(parts);
  const prefixed = LEGACY_LINE_PREFIXES[parts[0] ?? ""];
  if (prefixed) return prefixed;
  if (set.has("pet") && ["shampoo", "condicionador", "perfume", "spray", "banho"].some((word) => set.has(word))) return "cosmeticos-pet";
  if (set.has("pet") || set.has("37ml")) return "pet";
  if (set.has("infantil")) return "infantil";
  if (set.has("baby")) return "baby";
  if (set.has("kids")) return "kids";
  if (set.has("teen")) return "teen";
  if (set.has("dose") || set.has("7ml")) return "dose-unica";
  if (set.has("virtudes") || set.has("15ml")) return "virtudes-divinas";
  if (set.has("adulto")) return "adulto";
  return null;
}

type Candidate = { slug: string; lineSlug: string; key: string[] };

const CANDIDATES: Candidate[] = bioProducts
  .filter((product) => !product.slug.endsWith("-5l") && !product.slug.endsWith("-500ml"))
  .map((product) => ({
    slug: product.slug,
    lineSlug: product.lineSlug,
    // chave = palavras significativas do NOME do produto (ex.: "Fase da Menopausa" -> [menopausa])
    key: meaningful(tokens(product.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-"))),
  }))
  .filter((candidate) => candidate.key.length > 0);

/**
 * Casa um slug antigo com um produto ATUAL pelo nome. Só devolve se o casamento for seguro: todas as palavras do nome do
 * produto aparecem no slug antigo, na linha sugerida, e há UM melhor candidato (o de mais palavras). Ambíguo = null.
 */
export function matchLegacyProduct(rawSlug: string): string | null {
  const parts = tokens(rawSlug);
  const hint = lineHint(parts);
  const query = new Set(meaningful(parts));

  if (query.size === 0) return null;

  const pool = CANDIDATES.filter((candidate) => {
    if (hint) {
      if (candidate.lineSlug !== hint) return false;
      // linhas de floral: só floral (nome igual de shampoo/perfume não entra no casamento por nome)
      return !/-(shampoo|condicionador|perfume|spray|sabonete|creme|aromatizador|floral-de-ambiente|snack|higiene|finalizador)-/.test(candidate.slug) || hint.startsWith("cosmeticos") || hint === "home-care";
    }
    return /-floral-em-gotas-|dose-unica-floral|virtudes-divinas-virtudes/.test(candidate.slug);
  });

  const matches = pool
    .filter((candidate) => candidate.key.every((token) => query.has(token)))
    .sort((a, b) => b.key.length - a.key.length);

  if (matches.length === 0) return null;

  const best = matches[0];
  const tied = matches.filter((candidate) => candidate.key.length === best.key.length);

  // sem pista de linha, o mesmo nome em linhas diferentes (ex.: "medo") é ambíguo: não chuta
  if (tied.length > 1) return null;

  return best.slug;
}

function categoryTarget(rest: string): string {
  const text = rest.toLowerCase();

  for (const [pattern, destination] of LEGACY_CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return destination;
  }

  return "/";
}

/** Linha mais próxima pelo prefixo do slug antigo (adulto-..., cosmeticos-pet-..., home-care-...). */
function lineByPrefix(slug: string): string | null {
  const line = LINE_SLUGS.find((candidate) => slug === candidate || slug.startsWith(`${candidate}-`));
  return line ? `/linha/${line}` : null;
}

/**
 * Destino do redirect 301 para uma URL antiga, ou null quando a URL não é antiga (ou já é atual).
 * O destino pode terminar em #hash (ex.: /#linhas); a query string é anexada pelo middleware.
 */
export function resolveLegacyRedirect(pathname: string): string | null {
  const path = normalizePath(pathname);

  if (!path.startsWith("/") || path === "/") return null;

  const segments = path.split("/").filter(Boolean);
  const root = segments[0];

  // 1) casos conhecidos, um a um
  const exact = EXACT.get(path);
  if (exact && exact !== path) return exact;

  // 2) URLs ATUAIS válidas nunca são tocadas
  if (CURRENT_ROOTS.has(root) && root !== "produto") return null;

  // 3) bug histórico: /None-* e /categoria/None-* -> home
  if (/^none($|-)/i.test(root) || (root === "categoria" && /^none($|-)/i.test(segments[1] ?? ""))) return "/";

  // 4) categorias e etiquetas antigas -> linha correspondente (ou home)
  if (root === "categoria-produto" || root === "produto-tag" || root === "produto-etiqueta" || root === "categoria") {
    return categoryTarget(segments.slice(1).join("-"));
  }

  // 5) /produto/<slug>
  if (root === "produto") {
    const slug = segments[1];
    if (!slug || segments.length > 2) return null;
    if (getProduct(slug)) return null; // produto atual (inclui -5l/-500ml, tratados pela própria página)

    const matched = matchLegacyProduct(slug);
    if (matched) return `/produto/${matched}`;

    return lineByPrefix(slug) ?? categoryFallback(slug);
  }

  if (segments.length !== 1) return null;

  // 6) /fa-sensacao-de-*, /fk-*, /fb-*, /ft-*, /fv-* (site antigo, uma página por floral)
  const prefix = root.split("-")[0];
  const prefixLine = LEGACY_LINE_PREFIXES[prefix];

  if (prefixLine && root.includes("-")) {
    if (prefix === "fa") {
      const alias = LEGACY_FA_ALIASES[root];
      const aliased = alias ? `adulto-floral-em-gotas-${alias}` : null;
      if (aliased && getProduct(aliased)) return `/produto/${aliased}`;
    }

    const matched = matchLegacyProduct(root);
    return matched ? `/produto/${matched}` : `/linha/${prefixLine}`;
  }

  // 7) Aceitando um novo animal (4 eras do slug) -> produto Pet
  if (/(^|-)aceitando-um-novo-animal(-|$)/.test(root)) return "/produto/pet-floral-em-gotas-aceitando-um-novo-animal";

  // 8) página antiga de produto na raiz com volume no slug (ex.: /ansiedade-floral-pet-31ml, /medo-37ml)
  if (/-\d+(ml|g|l)$/.test(root) || /-floral-(adulto|infantil|baby|kids|teen|pet)(-|$)/.test(root)) {
    const matched = matchLegacyProduct(root);
    if (matched) return `/produto/${matched}`;
    return lineByPrefix(root) ?? categoryFallbackOrNull(root);
  }

  return null;
}

function categoryFallback(slug: string): string {
  const target = categoryTarget(slug);
  return target;
}

function categoryFallbackOrNull(slug: string): string | null {
  const target = categoryTarget(slug);
  return target === "/" ? null : target;
}

/** Junta o destino com a query string (utm_*, oppref e tudo o mais) — usado pelo middleware e pelos testes. */
export function withLegacyQuery(destination: string, search: string): string {
  const hashAt = destination.indexOf("#");
  const base = hashAt >= 0 ? destination.slice(0, hashAt) : destination;
  const hash = hashAt >= 0 ? destination.slice(hashAt) : "";
  const query = search.replace(/^\?/, "");

  return `${base}${query ? `?${query}` : ""}${hash}`;
}
