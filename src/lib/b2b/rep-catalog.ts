/**
 * CATÁLOGO DO REPRESENTANTE (/b2b/painel/catalogo), aprovado pelo Luis em 10/11: tela SÓ DE LEITURA com as linhas, o preço ao
 * lojista, as promoções vigentes (com validade), os PDFs de Materiais de venda e o vídeo "Como funciona em 1 minuto".
 * Nasceu da campanha Hafidme: no modo demonstração os representantes caíam em "Seus clientes" (lista vazia) e não entendiam.
 * Aqui não se cria nada (cliente, oferta ou link); o botão do fim leva ao fluxo que já existe no painel.
 * Funções puras (testáveis sem banco); as linhas e promoções vêm de loadBuilderLines (a mesma fonte do Offer Builder).
 */

import { B2B_FREIGHT_FLAT_THRESHOLD_CENTS, B2B_MIN_ORDER_CENTS } from "@/lib/b2b/pricing";

export const CATALOG_VIDEO_URL = "https://www.youtube.com/watch?v=xSeneSbx3Fo";
export const CATALOG_COMMISSION_SEAL = "Até 25% de comissão, direto da indústria";
/** Leva ao card "Montar oferta para um cliente" do painel (fluxo de criar cliente e testar, sem mudança). */
export const CATALOG_TRY_PATH = "/b2b/painel#montar-oferta-titulo";
export const CATALOG_PROMO_MAX_MONTHS = 6;

export type CatalogGroupKey = "florais" | "pet" | "cosmeticos-home";

export const CATALOG_GROUPS: ReadonlyArray<{ key: CatalogGroupKey; title: string; lines: readonly string[] }> = [
  { key: "florais", title: "Florais", lines: ["adulto", "baby", "infantil", "kids", "teen", "virtudes-divinas", "dose-unica"] },
  { key: "pet", title: "Pet", lines: ["pet", "cosmeticos-pet"] },
  { key: "cosmeticos-home", title: "Cosméticos e Home Care", lines: ["cosmeticos", "home-care"] },
];

/** PDF de Materiais de venda de cada linha (src/lib/b2b/sales-materials.ts). */
export const CATALOG_MATERIAL_BY_LINE: Readonly<Record<string, string>> = {
  adulto: "floral-adulto",
  baby: "florais-infantis",
  infantil: "florais-infantis",
  kids: "florais-infantis",
  teen: "florais-infantis",
  "virtudes-divinas": "virtudes-divinas",
  "dose-unica": "dose-unica",
  pet: "floral-pet",
  "cosmeticos-pet": "cosmeticos-pet",
  cosmeticos: "cosmeticos",
  "home-care": "home-care",
};

/** Agrupa as linhas do Offer Builder; linha nova sem grupo vai para o fim do grupo que a cita ou fica de fora (nunca some calada: vai para "Outras"). */
export function groupCatalogLines<T extends { slug: string }>(lines: readonly T[]): Array<{ key: string; title: string; lines: T[] }> {
  const used = new Set<string>();
  const groups = CATALOG_GROUPS.map((group) => {
    const items = group.lines.flatMap((slug) => lines.filter((line) => line.slug === slug));
    items.forEach((item) => used.add(item.slug));
    return { key: group.key as string, title: group.title, lines: items };
  }).filter((group) => group.lines.length > 0);

  const rest = lines.filter((line) => !used.has(line.slug));

  return rest.length > 0 ? [...groups, { key: "outras", title: "Outras linhas", lines: rest }] : groups;
}

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const CATALOG_CONDITIONS: readonly string[] = [
  `Pedido mínimo de ${brl(B2B_MIN_ORDER_CENTS)}`,
  `Frete grátis acima de ${brl(B2B_FREIGHT_FLAT_THRESHOLD_CENTS)} (na opção econômica)`,
  `Promoções válidas por até ${CATALOG_PROMO_MAX_MONTHS} meses`,
];

/** "Válida até 31/12/2026" (horário de São Paulo) ou "Sem data de término". */
export function promotionValidityText(endsAt: Date | string | null | undefined): string {
  if (!endsAt) return "Sem data de término";

  const date = endsAt instanceof Date ? endsAt : new Date(endsAt);

  if (Number.isNaN(date.getTime())) return "Sem data de término";

  return `Válida até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(date)}`;
}
