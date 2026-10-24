/**
 * Páginas de campanha do ChatGPT Ads (/para/<slug>) — Rodada 20. UM modelo (src/app/para/[slug]/page.tsx) e este arquivo de dados.
 *
 * Regras: noindex, fora do sitemap e do menu; o MESMO conteúdo para todo visitante e para o revisor do anúncio (nada muda por
 * origem, user-agent, referrer ou utm); sem promessa de saúde, sem "única"/"nº 1", nunca "Rescue" (usar S.O.S.); só fotos de
 * frasco (sem artes com frase de benefício).
 *
 * Para trocar a imagem do topo de uma página, edite `hero` (campo src/alt/posição). Para trocar produtos, edite `products`.
 */

import { B2C_FREE_SHIPPING_THRESHOLD_CENTS, B2C_SHIPPING_SUBSIDY_PERCENT } from "@/lib/checkout/benefits";

export const CAMPAIGN_GPT10 = {
  code: "GPT10",
  /** 30/11/2026 23:59:59 em Brasília (= 2026-12-01 02:59:59 UTC), a mesma validade do cupom (SQL 50b). */
  endsAt: "2026-12-01T02:59:59Z",
  bannerText: "GPT10 aplicado: 10% na sua 1ª compra",
  fineprint: "Vale 1 vez por e-mail, até 30/11/2026, e não acumula com outro cupom comercial. Você pode remover o cupom no checkout.",
} as const;

export type CampaignHero = {
  /** Arquivo em /public (a imagem do anúncio da página, ou o banner da linha sem texto). */
  src: string;
  alt: string;
  /** object-position do recorte (ex.: "50% 40%"). */
  position?: string;
  /** Proporção do topo (padrão 16 / 10): as fotos recortadas das artes de produto usam 4 / 3 ou 1 / 1. */
  aspect?: string;
  /** Zoom do recorte (1 = sem zoom) e origem do zoom, para esconder texto do banner. */
  scale?: number;
  origin?: string;
};

/**
 * Recorte do frasco por CSS (fotos do Adulto são cenas com molduras/frases): fração da largura e da altura da imagem que fica
 * visível, o centro horizontal do frasco e o topo do recorte. Só o frasco aparece (bordas suavizadas por máscara).
 */
export type BottleCrop = { width: number; height: number; centerX: number; top: number };

/** Foto do frasco do Adulto (cena 1023x1537). */
export const ADULT_PHOTO = { width: 1023, height: 1537 } as const;

/** Geometria CSS do recorte: proporção do contêiner e posição/tamanho da foto dentro dele (em % do contêiner). */
export function cropGeometry(crop: BottleCrop) {
  return {
    aspect: `${crop.width * ADULT_PHOTO.width} / ${crop.height * ADULT_PHOTO.height}`,
    widthPercent: 100 / crop.width,
    leftPercent: -((crop.centerX - crop.width / 2) / crop.width) * 100,
    topPercent: -(crop.top / crop.height) * 100,
  };
}

export type CampaignProduct = {
  slug: string;
  /** Nome na página (por padrão, o nome do catálogo). */
  label?: string;
  crop?: BottleCrop;
};

export type CampaignFaq = { question: string; answer: string };

export type CampaignPage = {
  slug: string;
  /** Título = título do anúncio. PROVISÓRIO até a mestre confirmar o texto de cada anúncio. */
  title: string;
  titleConfirmed: boolean;
  /** Frase curta abaixo do título. */
  lead: string;
  metaDescription: string;
  hero: CampaignHero;
  lineSlug: string;
  lineLabel: string;
  /** "Como usar" em 1 linha (a partir do conteúdo oficial dos produtos). */
  howToUse: string;
  products: CampaignProduct[];
  faq: CampaignFaq[];
};

// Recorte padrão do frasco nas fotos do Adulto (1023x1537): o frasco ocupa ~36% da largura.
const ADULT_CROP: BottleCrop = { width: 0.4, height: 0.66, centerX: 0.48, top: 0.13 };
// O frasco do "Medo" está mais baixo na foto.
const MEDO_CROP: BottleCrop = { width: 0.4, height: 0.66, centerX: 0.48, top: 0.19 };

const HOW_ADULT = "4 gotas, 3 vezes ao dia, direto na boca ou diluídas em água.";
const HOW_INFANTIL = "4 gotas, 3 vezes ao dia, direto na boca ou diluídas em água.";
const HOW_PET = "Conforme o porte do animal (2, 4 ou 6 gotas, 3 vezes ao dia), direto na boca ou no bebedouro.";
const HOW_BABY = "Siga a orientação da embalagem para a faixa etária do bebê.";

const faqUse = (answer: string): CampaignFaq => ({ question: "Como usar?", answer });
const faqAlcohol: CampaignFaq = { question: "Tem álcool?", answer: "Não. As fórmulas Bio Florais são 100% sem álcool." };
const faqMedicine = (who: string): CampaignFaq => ({
  question: "É um medicamento?",
  answer: `Não. Os florais Bio Florais não são medicamento e não substituem avaliação ou acompanhamento profissional. Em caso de dúvida, consulte ${who}.`,
});

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\u00a0/g, " ");
const faqShipping: CampaignFaq = {
  question: "Como é o frete?",
  answer: `Frete grátis a partir de ${brl(B2C_FREE_SHIPPING_THRESHOLD_CENTS)} em produtos; abaixo disso, a Bio Florais subsidia ${B2C_SHIPPING_SUBSIDY_PERCENT}% do frete.`,
};
const faqPayment: CampaignFaq = { question: "Como posso pagar?", answer: "Pix ou cartão de crédito." };

// Um bloco só de perguntas frequentes (uso, álcool, medicamento, frete e pagamento).
const faqList = (use: CampaignFaq, medicine: CampaignFaq): CampaignFaq[] => [use, faqAlcohol, medicine, faqShipping, faqPayment];

const PET_FAQ = (use: string): CampaignFaq[] => faqList(faqUse(`${use} Detalhes na embalagem de cada produto.`), faqMedicine("o seu veterinário"));

export const campaignPages: readonly CampaignPage[] = [
  {
    slug: "pet-sozinho",
    title: "Pet fica sozinho em casa?",
    titleConfirmed: true,
    lead: "Florais sem álcool para acompanhar o seu cão ou gato nos momentos em que ele fica sozinho.",
    metaDescription: "Florais Bio Florais Pet, sem álcool, para acompanhar cães e gatos nos momentos em que ficam sozinhos em casa.",
    // Recorte (só a foto, sem nenhum texto) da arte de produto "Carência e Síndrome de Abandono".
    hero: { src: "/para/hero-pet-sozinho.jpg", alt: "Cachorro e gato juntos ao lado da janela", position: "50% 50%", aspect: "4 / 3" },
    lineSlug: "pet",
    lineLabel: "Linha Pet",
    howToUse: HOW_PET,
    products: [
      { slug: "pet-floral-em-gotas-ansiedade" },
      { slug: "pet-floral-em-gotas-stress" },
      { slug: "pet-floral-em-gotas-carencia-e-sindrome-do-abandono" },
      { slug: "pet-floral-em-gotas-latido-excessivo" },
    ],
    faq: PET_FAQ(HOW_PET),
  },
  {
    slug: "pet-habitos",
    title: "Reparou nos hábitos do seu pet?",
    titleConfirmed: true,
    lead: "Conheça os florais Bio Florais Pet, sem álcool, para acompanhar a rotina de cães e gatos.",
    metaDescription: "Florais Bio Florais Pet, sem álcool, para acompanhar a rotina e os hábitos de cães e gatos.",
    // Recorte (só a foto, sem nenhum texto) da arte de produto "Lambedura e Automutilação".
    hero: { src: "/para/hero-pet-habitos.jpg", alt: "Cachorro em uma caminha", position: "50% 50%", aspect: "4 / 3" },
    lineSlug: "pet",
    lineLabel: "Linha Pet",
    howToUse: HOW_PET,
    products: [
      { slug: "pet-floral-em-gotas-lambedura-e-automutilacao" },
      { slug: "pet-floral-em-gotas-hiperatividade" },
      { slug: "pet-floral-em-gotas-coprofagia" },
      { slug: "pet-floral-em-gotas-latido-excessivo" },
    ],
    faq: PET_FAQ(HOW_PET),
  },
  {
    slug: "pet-medroso",
    title: "Florais para cães e gatos",
    titleConfirmed: true,
    lead: "Florais sem álcool para acompanhar cães e gatos nos momentos de medo, como fogos e barulhos altos.",
    metaDescription: "Florais Bio Florais Pet, sem álcool, para acompanhar cães e gatos medrosos.",
    hero: { src: "/para/B_pet_ansiedade_sem_rotulo.jpg", alt: "Cachorro e gato abrigados sob uma manta ao lado de um frasco de floral Bio Florais Pet", position: "50% 55%" },
    lineSlug: "pet",
    lineLabel: "Linha Pet",
    howToUse: HOW_PET,
    products: [
      { slug: "pet-floral-em-gotas-ansiedade" },
      { slug: "pet-floral-em-gotas-s-o-s", label: "S.O.S." },
      { slug: "pet-floral-em-gotas-medo-de-fogos" },
      { slug: "pet-floral-em-gotas-medo" },
    ],
    faq: PET_FAQ(HOW_PET),
  },
  {
    slug: "pausa",
    title: "Quando a mente quer pausa",
    titleConfirmed: true,
    lead: "Florais Bio Florais, sem álcool, para os momentos em que você precisa desacelerar.",
    metaDescription: "Florais Bio Florais Adulto, sem álcool, para os momentos de pausa e de desacelerar a rotina.",
    // Recorte (só a foto, sem nenhum texto) da arte de produto "Sensação de Ansiedade": a mulher à esquerda.
    hero: { src: "/para/hero-pausa.jpg", alt: "Mulher de olhos fechados, com as mãos no rosto, em um momento de pausa", position: "50% 50%", aspect: "4 / 3" },
    lineSlug: "adulto",
    lineLabel: "Linha Adulto",
    howToUse: HOW_ADULT,
    products: [
      { slug: "adulto-floral-em-gotas-sensacao-de-ansiedade", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-stress", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-reequilibrio-dos-chakras", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-medo", crop: MEDO_CROP },
    ],
    faq: faqList(faqUse(HOW_ADULT), faqMedicine("o seu médico")),
  },
  {
    slug: "fim-do-dia",
    title: "Seu ritual para encerrar o dia",
    titleConfirmed: true,
    lead: "Florais Bio Florais, sem álcool, para fechar o dia com mais calma.",
    metaDescription: "Florais Bio Florais Adulto, sem álcool, para fechar o dia com mais calma.",
    // Recorte (só a foto, sem nenhum texto) da arte de produto "Sono": a mulher dormindo, à esquerda.
    hero: { src: "/para/hero-fim-do-dia.jpg", alt: "Mulher dormindo tranquila sobre o travesseiro", position: "50% 50%", aspect: "4 / 3" },
    lineSlug: "adulto",
    lineLabel: "Linha Adulto",
    howToUse: HOW_ADULT,
    // "Tristeza e Depressão" saiu: o rótulo do frasco na foto traz "Depressão" (termo de saúde).
    products: [
      { slug: "adulto-floral-em-gotas-sono", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-stress", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-sensacao-de-ansiedade", crop: ADULT_CROP },
    ],
    faq: faqList(faqUse(HOW_ADULT), faqMedicine("o seu médico")),
  },
  {
    slug: "rotina",
    title: "Rotina estressante?",
    titleConfirmed: true,
    lead: "Florais Bio Florais, sem álcool, para acompanhar os dias de correria e de mudanças.",
    metaDescription: "Florais Bio Florais Adulto, sem álcool, para acompanhar a rotina e as mudanças do dia a dia.",
    // Recorte (só a foto, sem nenhum texto de arte) da arte "Equilíbrio para viver melhor cada dia": o frasco com flores, à esquerda.
    hero: { src: "/para/hero-rotina.jpg", alt: "Frasco de floral Bio Florais Adulto ao lado de um vaso de flores", position: "50% 40%", aspect: "1 / 1" },
    lineSlug: "adulto",
    lineLabel: "Linha Adulto",
    howToUse: HOW_ADULT,
    // "Rescue" saiu: o rótulo do frasco na foto traz RESCUE (a regra é nunca "Rescue").
    products: [
      { slug: "adulto-floral-em-gotas-stress", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-sensacao-de-ansiedade", crop: ADULT_CROP },
      { slug: "adulto-floral-em-gotas-mudancas-na-vida", crop: ADULT_CROP },
    ],
    faq: faqList(faqUse(HOW_ADULT), faqMedicine("o seu médico")),
  },
  {
    slug: "bebe-soninho",
    title: "Hora do soninho",
    titleConfirmed: true,
    lead: "Florais da Linha Baby, sem álcool, pensados para acompanhar a rotina do bebê e da família.",
    metaDescription: "Florais Bio Florais Baby, sem álcool, para acompanhar a rotina do bebê e a hora de dormir.",
    hero: { src: "/para/O1_Sono_Baby.jpg", alt: "Bebê dormindo ao lado de um frasco de floral Bio Florais Baby Sono", position: "50% 50%" },
    lineSlug: "baby",
    lineLabel: "Linha Baby",
    howToUse: HOW_BABY,
    // 3 produtos: o 4º card da grade é o card da linha Baby ("Conheça a linha"); a grade tem sempre 4 cards.
    products: [
      { slug: "baby-floral-em-gotas-sono" },
      { slug: "baby-floral-em-gotas-choro-excessivo" },
      { slug: "baby-floral-em-gotas-bebe-nervoso" },
    ],
    faq: faqList(faqUse(HOW_BABY), { question: "É um medicamento?", answer: "Não. Não é medicamento, sedativo nem indutor do sono. Se o sono do bebê mudar de forma persistente, converse com o pediatra." }),
  },
  {
    slug: "crianca-desacelerar",
    title: "É hora de desacelerar",
    titleConfirmed: true,
    lead: "Florais da Linha Infantil, sem álcool, para acompanhar crianças de 3 a 7 anos no dia a dia.",
    metaDescription: "Florais Bio Florais Infantil, sem álcool, para acompanhar o dia a dia das crianças.",
    hero: { src: "/para/O1_Sono_Infantil.jpg", alt: "Menina dormindo abraçada a um ursinho ao lado de um frasco de floral Bio Florais Infantil Sono", position: "50% 50%" },
    lineSlug: "infantil",
    lineLabel: "Linha Infantil",
    howToUse: HOW_INFANTIL,
    products: [
      { slug: "infantil-floral-em-gotas-hiperatividade" },
      { slug: "infantil-floral-em-gotas-ansiedade" },
      { slug: "infantil-floral-em-gotas-sono" },
      { slug: "infantil-floral-em-gotas-medos-infantis-e-pesadelos" },
    ],
    faq: faqList(faqUse(HOW_INFANTIL), faqMedicine("o pediatra")),
  },
];

export const CAMPAIGN_SLUGS = campaignPages.map((page) => page.slug);

export function getCampaignPage(slug: string): CampaignPage | undefined {
  return campaignPages.find((page) => page.slug === slug);
}
