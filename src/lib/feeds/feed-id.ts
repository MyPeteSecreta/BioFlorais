/**
 * Id do produto nos feeds (Google Merchant e Meta) e nos eventos de anúncio (purchase, ViewContent, AddToCart...).
 * O Google aceita no máximo 50 caracteres no id: os slugs mais longos ganham um id curto FIXO (não gerar de novo, senão o item
 * perde o histórico no Merchant). Os demais seguem com o próprio slug. O link do produto continua sendo o slug.
 */

export const FEED_ID_MAX_LENGTH = 50;

export const FEED_SHORT_IDS: Readonly<Record<string, string>> = {
  "kids-floral-em-gotas-momento-reequilibrio-alimentar": "kids-floral-momento-reequilibrio-alimentar",
  "infantil-floral-em-gotas-medos-infantis-e-pesadelos": "infantil-floral-medos-infantis-e-pesadelos",
  "infantil-floral-em-gotas-tirando-a-fralda-e-a-chupeta": "infantil-floral-tirando-a-fralda-e-a-chupeta",
  "pet-floral-em-gotas-carencia-e-sindrome-do-abandono": "pet-floral-carencia-e-sindrome-do-abandono",
  "cosmeticos-sabonete-liquido-reequilibrio-dos-chakras": "cosmeticos-sabonete-reequilibrio-dos-chakras",
  "cosmeticos-pet-condicionador-ansiedade-pelos-claros": "cosmeticos-pet-cond-ansiedade-pelos-claros",
  "cosmeticos-pet-condicionador-ansiedade-pelos-escuros": "cosmeticos-pet-cond-ansiedade-pelos-escuros",
  "cosmeticos-pet-condicionador-ansiedade-pelos-claros-5l": "cosmeticos-pet-cond-ansiedade-pelos-claros-5l",
  "cosmeticos-pet-condicionador-ansiedade-pelos-escuros-5l": "cosmeticos-pet-cond-ansiedade-pelos-escuros-5l",
  "cosmeticos-pet-higiene-oral-spray-para-halito-menta": "cosmeticos-pet-spray-para-halito-menta",
};

export const feedItemId = (slug: string) => FEED_SHORT_IDS[slug] ?? slug;
