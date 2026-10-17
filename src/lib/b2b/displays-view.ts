/** Tipos (só tipos) dos cards de kit/display enviados do servidor para a loja do link. */

export type KitCartItem = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  priceCents: number;
  qty: number;
};

export type KitOption = {
  /** Chave do display (= arquivo da foto). */
  key: string;
  /** "Compacto", "Médio", "Grande", "12", "30", "44", "Único". */
  label: string;
  /** Nome do brinde: "Display compacto Florais Adulto". */
  displayName: string;
  units: number;
  skus: number;
  totalCents: number;
  items: KitCartItem[];
  /** Foto própria do display (null = usa a imagem da linha + selo "Display"). */
  photo: string | null;
  summary: string;
};

export type KitCardView = {
  id: string;
  title: string;
  /** Uma opção = "Kit com display"; várias = "Escolha seu display" (variações). */
  options: KitOption[];
  featured: boolean;
  lineImage: string | null;
};
