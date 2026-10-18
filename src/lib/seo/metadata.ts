/**
 * SEO do B2C (metadata): títulos/descrições por linha, og:image, descrição de produto e normalização de slug.
 * Só texto de momento/uso: sem promessa de tratamento, cura ou condição. Nomes de produto com condição ficam como estão
 * no catálogo (decisão da mestre). Funções puras (sem fs): testáveis.
 */

export type LineSeo = { title: string; description: string; ogImage: string };

/** og:image: arquivos em public/og (sem rótulo de condição). */
export const OG_IMAGES = {
  home: "/og/og-home.jpg",
  adulto: "/og/og-adulto.jpg",
  infantil: "/og/og-infantil.jpg",
  pet: "/og/og-pet.jpg",
} as const;

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const LINE_SEO: Record<string, LineSeo> = {
  adulto: {
    title: "Florais Adulto sem álcool | Bio Florais",
    description: "Essências florais brasileiras em gotas, sem álcool, para diferentes momentos da rotina. Desde 1997.",
    ogImage: OG_IMAGES.adulto,
  },
  infantil: {
    title: "Florais Infantis sem álcool | Bio Florais",
    description: "Linhas Infantil, Baby, Kids e Teen em gotas sem álcool, para cada fase da infância. Desde 1997.",
    ogImage: OG_IMAGES.infantil,
  },
  pet: {
    title: "Florais para cães e gatos | Bio Florais Pet",
    description: "Florais em gotas sem álcool para a rotina do seu pet: viagens, fogos, mudanças e novidades em casa.",
    ogImage: OG_IMAGES.pet,
  },
  baby: {
    title: "Florais Baby sem álcool | Bio Florais",
    description: "Essências florais brasileiras em gotas, sem álcool, para a rotina dos bebês e de quem cuida deles. Desde 1997.",
    ogImage: OG_IMAGES.infantil,
  },
  kids: {
    title: "Florais Kids sem álcool | Bio Florais",
    description: "Florais em gotas sem álcool para a rotina das crianças, em cada fase do crescimento. Desde 1997.",
    ogImage: OG_IMAGES.infantil,
  },
  teen: {
    title: "Florais Teen sem álcool | Bio Florais",
    description: "Florais em gotas sem álcool para a rotina dos adolescentes e os momentos do dia a dia. Desde 1997.",
    ogImage: OG_IMAGES.infantil,
  },
  "dose-unica": {
    title: "Florais Dose Única sem álcool | Bio Florais",
    description: "Florais em dose única, sem álcool, práticos para levar na bolsa e usar em momentos pontuais. Desde 1997.",
    ogImage: OG_IMAGES.adulto,
  },
  "virtudes-divinas": {
    title: "Florais Virtudes Divinas sem álcool | Bio Florais",
    description: "Linha de florais em gotas inspirada em virtudes como amor, paciência e gratidão, sem álcool, para a rotina. Desde 1997.",
    ogImage: OG_IMAGES.adulto,
  },
  cosmeticos: {
    title: "Cosméticos com essências florais | Bio Florais",
    description: "Shampoos, cremes e sabonetes líquidos com essências florais brasileiras para o cuidado do dia a dia. Desde 1997.",
    ogImage: OG_IMAGES.home,
  },
  "cosmeticos-pet": {
    title: "Cosméticos para cães e gatos | Bio Florais Pet",
    description: "Shampoos, perfumes e sprays com essências florais para o banho e o cuidado diário do seu pet.",
    ogImage: OG_IMAGES.pet,
  },
  "home-care": {
    title: "Home Care com essências florais | Bio Florais",
    description: "Aromatizadores de ambiente e sabonetes líquidos com essências florais para deixar a casa com um aroma agradável.",
    ogImage: OG_IMAGES.home,
  },
};

/** Slugs de apresentação maior de Cosméticos Pet (-5l, perfume -500ml) apontam para a página base (mesma regra do redirect). */
export function normalizeProductSlug(slug: string): string {
  if (slug.startsWith("cosmeticos-pet-") && slug.endsWith("-5l")) return slug.slice(0, -3);
  if (slug.startsWith("cosmeticos-pet-perfume-spray-") && slug.endsWith("-500ml")) return slug.slice(0, -6);
  return slug;
}

const MAX_DESCRIPTION = 155;

/** Primeira(s) frase(s) do texto editorial, até ~155 caracteres, cortando em palavra inteira. */
export function trimDescription(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const firstSentence = clean.match(/^.{40,}?[.!?](\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= max) return firstSentence;

  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length).replace(/[,;:\s]+$/, "")}…`;
}

/** Descrição do produto: texto editorial (prioridade) ou fallback seguro por nome/volume/linha (momento/uso). */
export function productDescription(product: { name: string; content?: string | null; line?: string | null; category?: string | null }, editorialAbout?: string | null): string {
  // O texto editorial costuma começar com o rótulo "Descrição": tira antes de usar como meta description.
  const about = String(editorialAbout ?? "").replace(/^s*descri[çc][ãa]os*[:-–]?s*/i, "").trim();
  if (about) return trimDescription(about);

  const detail = [product.category, product.content].filter(Boolean).join(" · ");
  return trimDescription(`${product.name}${detail ? ` (${detail})` : ""} da linha ${product.line ?? "Bio Florais"}. Essências florais brasileiras, sem álcool. Desde 1997.`);
}
