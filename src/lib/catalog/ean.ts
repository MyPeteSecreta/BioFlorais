/**
 * EAN-13 e NCM NOVOS DO SITE DA BIO (22/11/2026; fonte: marketplaces/EAN_NCM_MESTRE_21_11.json, marca "Bio Florais", dígito verificador
 * conferido). Mesma lista do SQL `sql/bio-b2b/ean_ncm_site.sql` (colunas `products.ean` e `products.ncm`, criadas por ele): um teste
 * garante que o código e o SQL têm exatamente os mesmos códigos.
 *
 * O código lê ESTA lista (e não a coluna do banco) de propósito: assim o push nunca depende de o SQL já ter rodado (lição 4: o Drizzle
 * faria `select` de coluna que ainda não existe). A coluna do banco serve ao Omie e aos marketplaces. Vale sobre `gtin-data.ts` (planilha antiga).
 *
 * Sabonete Líquido existe em 2 linhas (Cosméticos e Home Care) e é o MESMO produto de 315 ml: o mesmo EAN vale nas duas. Por isso o
 * índice único do banco é por (linha, EAN), e o feed (só Cosméticos; Home Care não vai ao feed) nunca repete GTIN.
 * PROVISÓRIOS (o Luis troca quando achar o certo): Creme Corpo Hidratante e Creme Corpo S.O.S.
 * Aromatizador Spray = 240 ml e 300 g (não existe 50 g): o volume está em bio-products.ts e o peso no SQL (products.weight_grams).
 */
export type ProductEan = { ean: string; ncm: string };

export const PRODUCT_EAN: Readonly<Record<string, ProductEan>> = {
  "adulto-floral-em-gotas-reequilibrio-dos-chakras": { ean: "7898919557295", ncm: "1302.19.99" },
  "adulto-flormed-ansiedade": { ean: "7898552637040", ncm: "1302.19.99" },
  "adulto-flormed-sono": { ean: "7898552636975", ncm: "1302.19.99" },
  "adulto-flormed-stress": { ean: "7898552636678", ncm: "1302.19.99" },
  "baby-floral-em-gotas-mamae-volta-ao-trabalho": { ean: "7898552630201", ncm: "1302.19.99" },
  "baby-flormed-kolin-k": { ean: "7898552630553", ncm: "1302.19.99" },
  "baby-flormed-ninar": { ean: "7898552630546", ncm: "1302.19.99" },
  "baby-flormed-ninni-chorim": { ean: "7898552630539", ncm: "1302.19.99" },
  "cosmeticos-creme-corpo-ansiedade": { ean: "7898919558919", ncm: "3304.99.10" },
  "cosmeticos-creme-corpo-harmonia-interior": { ean: "7898919558926", ncm: "3304.99.10" },
  "cosmeticos-creme-corpo-hidratante": { ean: "7898552633585", ncm: "3304.99.10" }, // PROVISÓRIO
  "cosmeticos-creme-corpo-reequilibrio-dos-chakras": { ean: "7898919558933", ncm: "3304.99.10" },
  "cosmeticos-creme-corpo-rescue-sos": { ean: "7898552633608", ncm: "3304.99.10" }, // PROVISÓRIO
  "cosmeticos-pet-condicionador-adestramento-5l": { ean: "7898552631161", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-agressividade-5l": { ean: "7898552631109", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-ansiedade-pelos-claros-5l": { ean: "7898552631147", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-ansiedade-pelos-escuros-5l": { ean: "7898552631130", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-filhotes-5l": { ean: "7898552631154", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-lambedura-5l": { ean: "7898552631116", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-rescue-sos": { ean: "7898552630867", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-rescue-sos-5l": { ean: "7898552631178", ncm: "3305.90.00" },
  "cosmeticos-pet-condicionador-tristeza-e-depressao-5l": { ean: "7898552631123", ncm: "3305.90.00" },
  "cosmeticos-pet-floral-de-ambiente-adestramento": { ean: "7898552630973", ncm: "1302.19.99" },
  "cosmeticos-pet-floral-de-ambiente-agressividade": { ean: "7898552630935", ncm: "1302.19.99" },
  "cosmeticos-pet-floral-de-ambiente-filhotes": { ean: "7898552630966", ncm: "1302.19.99" },
  "cosmeticos-pet-floral-de-ambiente-rescue-sos": { ean: "7898552630959", ncm: "1302.19.99" },
  "cosmeticos-pet-floral-de-ambiente-tristeza-e-depressao": { ean: "7898552630928", ncm: "1302.19.99" },
  "cosmeticos-pet-higiene-oral-spray-para-halito-menta": { ean: "7898552630997", ncm: "3306.10.00" },
  "cosmeticos-pet-perfume-spray-agressividade": { ean: "7898552630881", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-agressividade-500ml": { ean: "7898552631192", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-ansiedade": { ean: "7898552630898", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-ansiedade-500ml": { ean: "7898552631208", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-filhotes": { ean: "7898552630911", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-filhotes-500ml": { ean: "7898552631222", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-rescue-sos": { ean: "7898552630904", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-rescue-sos-500ml": { ean: "7898552631215", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-tristeza-e-depressao": { ean: "7898552630874", ncm: "3307.90.00" },
  "cosmeticos-pet-perfume-spray-tristeza-e-depressao-500ml": { ean: "7898552631185", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-adestramento-5l": { ean: "7898552631086", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-agressividade-5l": { ean: "7898552631024", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-ansiedade-pelos-claros-5l": { ean: "7898552631062", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-ansiedade-pelos-escuros-5l": { ean: "7898552631055", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-filhotes-5l": { ean: "7898552631079", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-lambedura-5l": { ean: "7898552631031", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-rescue-sos": { ean: "7898552630782", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-rescue-sos-5l": { ean: "7898552631093", ncm: "3307.90.00" },
  "cosmeticos-pet-shampoo-tristeza-e-depressao-5l": { ean: "7898552631048", ncm: "3307.90.00" },
  "cosmeticos-sabonete-liquido-alegria": { ean: "7898919558551", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-ansiedade": { ean: "7898919558568", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-harmonia-interior": { ean: "7898919558599", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-hidratante": { ean: "7898919558605", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-reequilibrio-dos-chakras": { ean: "7898919558612", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-refrescante": { ean: "7898919558629", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-relaxante": { ean: "7898919558636", ncm: "3401.20.10" },
  "cosmeticos-sabonete-liquido-rescue-sos": { ean: "7898919558643", ncm: "3401.20.10" },
  "cosmeticos-shampoo-masculino-cabelos-grisalhos-premium": { ean: "7898552636616", ncm: "3305.10.00" },
  "home-care-aromatizador-spray-bem-estar": { ean: "7898919558209", ncm: "1302.19.99" },
  "home-care-aromatizador-spray-harmonia": { ean: "7898919558223", ncm: "1302.19.99" },
  "home-care-aromatizador-spray-limpeza-e-protecao": { ean: "7898919558216", ncm: "1302.19.99" },
  "home-care-aromatizador-spray-reequilibrio-do-ambiente": { ean: "7898919558247", ncm: "1302.19.99" },
  "home-care-aromatizador-spray-serenidade": { ean: "7898919558230", ncm: "1302.19.99" },
  "home-care-sabonete-liquido-alegria": { ean: "7898919558551", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-ansiedade": { ean: "7898919558568", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-harmonia-interior": { ean: "7898919558599", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-hidratante": { ean: "7898919558605", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-reequilibrio-dos-chakras": { ean: "7898919558612", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-refrescante": { ean: "7898919558629", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-relaxante": { ean: "7898919558636", ncm: "3401.20.10" },
  "home-care-sabonete-liquido-rescue-sos": { ean: "7898919558643", ncm: "3401.20.10" },
  "pet-floral-em-gotas-s-o-s": { ean: "7898919557349", ncm: "1302.19.99" },
  "pet-floral-em-gotas-viagens": { ean: "7898552633905", ncm: "1302.19.99" },
  "pet-snack-floral-agressividade": { ean: "7898552637583", ncm: "1302.19.99" },
  "pet-snack-floral-ansiedade": { ean: "7898552637576", ncm: "1302.19.99" },
  "pet-snack-floral-filhotes": { ean: "7898552637620", ncm: "1302.19.99" },
  "pet-snack-floral-hiperatividade": { ean: "7898552637590", ncm: "1302.19.99" },
  "pet-snack-floral-lambedura": { ean: "7898552637606", ncm: "1302.19.99" },
  "pet-snack-floral-medo": { ean: "7898552637613", ncm: "1302.19.99" },
  "teen-floral-em-gotas-rescue-s-o-s": { ean: "7898552630423", ncm: "1302.19.99" },
};

/** Categoria que repete o EAN entre as linhas Cosméticos e Home Care de propósito (mesmo sabonete de 315 ml). */
export const EAN_SHARED_ACROSS_LINES_CATEGORY = "Sabonete Líquido";

/** EAN-13 (GTIN-13): 13 dígitos com dígito verificador válido. */
export function isValidGtin13(value: string | null | undefined): boolean {
  const code = String(value ?? "").trim();

  if (!/^[0-9]{13}$/.test(code)) return false;

  let sum = 0;

  for (let i = 0; i < 12; i += 1) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);

  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** EAN válido do produto (ou null). */
export function eanFor(slug: string): string | null {
  const entry = PRODUCT_EAN[slug];

  return entry && isValidGtin13(entry.ean) ? entry.ean : null;
}
