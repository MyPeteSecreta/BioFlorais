/**
 * BIO FLORAIS B2B — Materiais de venda (Fase 2 dos PDFs de linha). Os PDFs-base ficam no repositório, em
 * `src/lib/b2b/materiais/bio/` (NUNCA em /public: a versão REPRESENTANTE é de uso interno). Duas versões por linha:
 *  - LOJISTA (para encaminhar): ao baixar, o servidor carimba na página "Como pedir" o NOME, o WHATSAPP e o QR do link pessoal
 *    (link de captação /parceiros?v=<código>) DAQUELE vendedor, no espaço reservado;
 *  - REPRESENTANTE (uso interno): baixa como está (traz o selo "USO INTERNO — NÃO ENCAMINHAR" em todas as páginas).
 */

export const MATERIALS_DIR = "src/lib/b2b/materiais/bio";

export type MaterialAudience = "lojista" | "representante";

export type SalesMaterial = {
  id: string;
  title: string;
  group: "Florais" | "Cosméticos e Home Care";
  description: string;
  files: Record<MaterialAudience, string>;
};

const pair = (base: string): Record<MaterialAudience, string> => ({ lojista: `${base}_LOJISTA.pdf`, representante: `${base}_REPRESENTANTE.pdf` });

export const SALES_MATERIALS: readonly SalesMaterial[] = [
  { id: "floral-adulto", title: "Floral Adulto", group: "Florais", description: "33 versões · kit display compacto", files: pair("Bio_Floral_Adulto") },
  { id: "florais-infantis", title: "Florais Infantis", group: "Florais", description: "Baby, Infantil, Kids e Teen · 41 versões", files: pair("Bio_Florais_Infantis") },
  { id: "floral-pet", title: "Floral Pet", group: "Florais", description: "25 versões e Snack Floral · 3 displays", files: pair("Bio_Floral_Pet") },
  { id: "virtudes-divinas", title: "Virtudes Divinas", group: "Florais", description: "36 virtudes · display único", files: pair("Bio_Virtudes_Divinas") },
  { id: "dose-unica", title: "Dose Única", group: "Florais", description: "6 versões de 7 ml · display único", files: pair("Bio_Dose_Unica") },
  { id: "cosmeticos", title: "Cosméticos", group: "Cosméticos e Home Care", description: "Shampoos, condicionadores, cremes e sabonetes", files: pair("Bio_Cosmeticos") },
  { id: "home-care", title: "Home Care It's Blossom", group: "Cosméticos e Home Care", description: "Aromatizador e sabonetes líquidos", files: pair("Bio_Home_Care") },
  { id: "cosmeticos-pet", title: "Cosméticos Pet", group: "Cosméticos e Home Care", description: "Shampoos, perfumes, floral de ambiente e cuidados pet", files: pair("Bio_Cosmeticos_Pet") },
];

export function findMaterial(id: string): SalesMaterial | null {
  return SALES_MATERIALS.find((material) => material.id === id) ?? null;
}

export function parseAudience(value: unknown): MaterialAudience | null {
  return value === "lojista" || value === "representante" ? value : null;
}

/** Nome de arquivo seguro: "Bio_Floral_Adulto_LOJISTA_Ana-Souza.pdf" (sem acento, sem espaço). */
export function downloadFileName(baseFile: string, sellerName: string | null): string {
  const slug = String(sellerName ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug ? baseFile.replace(/\.pdf$/i, `_${slug}.pdf`) : baseFile;
}

/** "11999998888" -> "(11) 99999-8888"; aceita +55 e formatos soltos. Sem número válido (10 a 11 dígitos): null. */
export function formatWhatsApp(raw: unknown): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");

  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
