/**
 * Preço em reais ("R$ 35,90"). Fica fora do catálogo (src/lib/catalog/bio-products.ts, que re-exporta) para os componentes do
 * navegador não carregarem o catálogo inteiro só para formatar um preço (14/11: página de produto mais leve).
 */
export function formatBRL(cents: number | null) {
  if (cents === null) return "Preço em atualização";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
