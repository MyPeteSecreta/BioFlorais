import { getProduct } from "@/lib/catalog/bio-products";

export const ADULT_PRODUCTS = {
  ansiedade: "adulto-floral-em-gotas-sensacao-de-ansiedade",
  rescue: "adulto-floral-em-gotas-rescue",
  sono: "adulto-floral-em-gotas-sono",
  tristeza: "adulto-floral-em-gotas-tristeza-estado-depressivo",
  reducaoPeso: "adulto-floral-em-gotas-reducao-de-peso",
  stress: "adulto-floral-em-gotas-stress",
  menopausa: "adulto-floral-em-gotas-fase-da-menopausa",
  vicios: "adulto-floral-em-gotas-vicios-e-dependencias",
  medo: "adulto-floral-em-gotas-medo",
  estudante: "adulto-floral-em-gotas-momento-do-estudante",
  pararFumar: "adulto-floral-em-gotas-parar-de-fumar",
  chakras: "adulto-floral-em-gotas-reequilibrio-dos-chakras",
  autoestima: "adulto-floral-em-gotas-autoestima",
  memoria: "adulto-floral-em-gotas-falta-de-memoria",
  inseguranca: "adulto-floral-em-gotas-inseguranca",
  tpm: "adulto-floral-em-gotas-momento-tpm",
  panico: "adulto-floral-em-gotas-panico",
  sucessoFinanceiro: "adulto-floral-em-gotas-sucesso-financeiro",
  desanimo: "adulto-floral-em-gotas-desanimo",
  magoa: "adulto-floral-em-gotas-magoa",
  tolerancia: "adulto-floral-em-gotas-falta-de-tolerancia",
  parceiroSexual: "adulto-floral-em-gotas-parceiro-sexual",
  alegria: "adulto-floral-em-gotas-carencia-de-alegria",
  pride: "adulto-floral-em-gotas-pride",
  panicoSocial: "adulto-floral-em-gotas-panico-social",
  lideranca: "adulto-floral-em-gotas-lideranca",
  melhorIdade: "adulto-floral-em-gotas-fase-da-melhor-idade",
  perfeccionismo: "adulto-floral-em-gotas-perfeccionismo",
  artes: "adulto-floral-em-gotas-das-artes",
  gestacao: "adulto-floral-em-gotas-gestacao",
  mudancasVida: "adulto-floral-em-gotas-mudancas-na-vida",
} as const;

export const ADULT_PRODUCT_SLUGS = Object.values(ADULT_PRODUCTS);

export const ADULT_PRODUCT_GATES = {
  [ADULT_PRODUCTS.parceiroSexual]: ["adult-partner-sexual"],
} as const;

export const PET_PRODUCTS = {
  ansiedade: "pet-floral-em-gotas-ansiedade",
  lambedura: "pet-floral-em-gotas-lambedura-e-automutilacao",
  stress: "pet-floral-em-gotas-stress",
  hiperatividade: "pet-floral-em-gotas-hiperatividade",
  carencia: "pet-floral-em-gotas-carencia-e-sindrome-do-abandono",
  coprofagia: "pet-floral-em-gotas-coprofagia",
  filhotes: "pet-floral-em-gotas-filhotes",
  viagens: "pet-floral-em-gotas-viagens",
  latido: "pet-floral-em-gotas-latido-excessivo",
  agressividade: "pet-floral-em-gotas-agressividade",
  sos: "pet-floral-em-gotas-s-o-s",
  medoFogos: "pet-floral-em-gotas-medo-de-fogos",
  novoAnimal: "pet-floral-em-gotas-aceitando-um-novo-animal",
  medo: "pet-floral-em-gotas-medo",
  cio: "pet-floral-em-gotas-fase-do-cio",
  tristeza: "pet-floral-em-gotas-tristeza-e-depressao",
  novoLar: "pet-floral-em-gotas-adaptacao-a-um-novo-lar",
  marcacao: "pet-floral-em-gotas-marcacao-de-territorio",
  indisciplina: "pet-floral-em-gotas-indisciplina",
  adestramento: "pet-floral-em-gotas-adestramento",
  aversaoBanho: "pet-floral-em-gotas-aversao-a-banho",
  aversaoCriancas: "pet-floral-em-gotas-aversao-a-criancas",
  gravidezPsicologica: "pet-floral-em-gotas-gravidez-psicologica",
  bebeChegou: "pet-floral-em-gotas-o-bebe-chegou",
  reequilibrioAlimentar: "pet-floral-em-gotas-reequilibrio-alimentar",
} as const;

export const PET_PRODUCT_SLUGS = Object.values(PET_PRODUCTS);

export const CHILDREN_PRODUCTS = {
  kidsConcentracao: "kids-floral-em-gotas-concentracao",
  kidsSociabilidade: "kids-floral-em-gotas-sociabilidade",
  kidsAnsiedade: "kids-floral-em-gotas-ansiedade",
  kidsSeparacao: "kids-floral-em-gotas-separacao",
  kidsReequilibrioAlimentar: "kids-floral-em-gotas-momento-reequilibrio-alimentar",
  kidsMedos: "kids-floral-em-gotas-medos-infantis",
  kidsCarencia: "kids-floral-em-gotas-carencia",
  kidsPesadelos: "kids-floral-em-gotas-pesadelos",
  kidsTeimosia: "kids-floral-em-gotas-teimosia",
  kidsRescue: "kids-floral-em-gotas-rescue-s-o-s",

  infantilAdaptacaoEscolar: "infantil-floral-em-gotas-adaptacao-escolar",
  infantilSono: "infantil-floral-em-gotas-sono",
  infantilHiperatividade: "infantil-floral-em-gotas-hiperatividade",
  infantilMedosPesadelos: "infantil-floral-em-gotas-medos-infantis-e-pesadelos",
  infantilChoroExcessivo: "infantil-floral-em-gotas-choro-excessivo",
  infantilFraldaChupeta: "infantil-floral-em-gotas-tirando-a-fralda-e-a-chupeta",
  infantilDesobediencia: "infantil-floral-em-gotas-desobediencia",
  infantilNaoFicaNervoso: "infantil-floral-em-gotas-nao-fica-nervoso",
  infantilRescue: "infantil-floral-em-gotas-rescue-s-o-s",
  infantilAnsiedade: "infantil-floral-em-gotas-ansiedade",

  faseInfancia: "adulto-floral-em-gotas-fase-da-infancia",
} as const;

export const CHILDREN_PRODUCT_SLUGS = Object.values(CHILDREN_PRODUCTS);

export const TEEN_PRODUCTS = {
  rescue: "teen-floral-em-gotas-rescue-s-o-s",
  controleEmocional: "teen-floral-em-gotas-controle-emocional",
  meuLugarNoMundo: "teen-floral-em-gotas-meu-lugar-no-mundo",
  relacionamentos: "teen-floral-em-gotas-relacionamentos",
  agressividade: "teen-floral-em-gotas-agressividade",
  concentracao: "teen-floral-em-gotas-concentracao",
  teimosia: "teen-floral-em-gotas-teimosia",
  organizacao: "teen-floral-em-gotas-organizacao",
  controleAlimentar: "teen-floral-em-gotas-controle-alimentar",
  mudancas: "teen-floral-em-gotas-mudancas",
  faseAdolescencia: "adulto-floral-em-gotas-fase-da-adolescencia",
} as const;

export const TEEN_PRODUCT_SLUGS = Object.values(TEEN_PRODUCTS);

export const TEEN_PRODUCT_GATES = {
  [TEEN_PRODUCTS.controleAlimentar]: ["teen-food-control"],
} as const;

export const BABY_PRODUCTS = {
  bebeNervoso: "baby-floral-em-gotas-bebe-nervoso",
  choroExcessivo: "baby-floral-em-gotas-choro-excessivo",
  falaNene: "baby-floral-em-gotas-fala-nene",
  gravidezConturbada: "baby-floral-em-gotas-gravidez-conturbada",
  mamaeVoltaTrabalho: "baby-floral-em-gotas-mamae-volta-ao-trabalho",
  posVacina: "baby-floral-em-gotas-pos-vacina",
  rescue: "baby-floral-em-gotas-rescue-s-o-s",
  sociabilidade: "baby-floral-em-gotas-sociabilidade",
  sono: "baby-floral-em-gotas-sono",
  tirandoChupeta: "baby-floral-em-gotas-tirando-a-chupeta",
  tirandoFralda: "baby-floral-em-gotas-tirando-a-fralda",
} as const;

export const BABY_PRODUCT_SLUGS = Object.values(BABY_PRODUCTS);

export const DOSE_PRODUCTS = {
  ansiedade: "dose-unica-floral-dose-unica-ansiedade",
  stress: "dose-unica-floral-dose-unica-stress",
  sono: "dose-unica-floral-dose-unica-sono",
  rescue: "dose-unica-floral-dose-unica-rescue-s-o-s",
  depressao: "dose-unica-floral-dose-unica-depressao",
  perdaPeso: "dose-unica-floral-dose-unica-perda-de-peso",
} as const;

export const DOSE_PRODUCT_SLUGS = Object.values(DOSE_PRODUCTS);

export const VIRTUE_PRODUCTS = {
  amor: "virtudes-divinas-virtudes-divinas-amor",
  docura: "virtudes-divinas-virtudes-divinas-docura",
  limpeza: "virtudes-divinas-virtudes-divinas-limpeza",
  autoconfianca: "virtudes-divinas-virtudes-divinas-autoconfianca",
  espontaneidade: "virtudes-divinas-virtudes-divinas-espontaneidade",
  benevolencia: "virtudes-divinas-virtudes-divinas-benevolencia",
  estabilidade: "virtudes-divinas-virtudes-divinas-estabilidade",
  perdao: "virtudes-divinas-virtudes-divinas-perdao",
  compaixao: "virtudes-divinas-virtudes-divinas-compaixao",
  flexibilidade: "virtudes-divinas-virtudes-divinas-flexibilidade",
  paciencia: "virtudes-divinas-virtudes-divinas-paciencia",
  prudencia: "virtudes-divinas-virtudes-divinas-prudencia",
  compreensao: "virtudes-divinas-virtudes-divinas-compreensao",
  generosidade: "virtudes-divinas-virtudes-divinas-generosidade",
  pureza: "virtudes-divinas-virtudes-divinas-pureza",
  contentamento: "virtudes-divinas-virtudes-divinas-contentamento",
  gentileza: "virtudes-divinas-virtudes-divinas-gentileza",
  coragem: "virtudes-divinas-virtudes-divinas-coragem",
  gratidao: "virtudes-divinas-virtudes-divinas-gratidao",
  dedicacao: "virtudes-divinas-virtudes-divinas-dedicacao",
  honestidade: "virtudes-divinas-virtudes-divinas-honestidade",
  desapego: "virtudes-divinas-virtudes-divinas-desapego",
  humildade: "virtudes-divinas-virtudes-divinas-humildade",
  respeito: "virtudes-divinas-virtudes-divinas-respeito",
  responsabilidade: "virtudes-divinas-virtudes-divinas-responsabilidade",
  sabedoria: "virtudes-divinas-virtudes-divinas-sabedoria",
  serenidade: "virtudes-divinas-virtudes-divinas-serenidade",
  determinacao: "virtudes-divinas-virtudes-divinas-determinacao",
  justica: "virtudes-divinas-virtudes-divinas-justica",
  simplicidade: "virtudes-divinas-virtudes-divinas-simplicidade",
  discernimento: "virtudes-divinas-virtudes-divinas-discernimento",
  lealdade: "virtudes-divinas-virtudes-divinas-lealdade",
  tolerancia: "virtudes-divinas-virtudes-divinas-tolerancia",
  disciplina: "virtudes-divinas-virtudes-divinas-disciplina",
  leveza: "virtudes-divinas-virtudes-divinas-leveza",
  verdade: "virtudes-divinas-virtudes-divinas-verdade",
} as const;

export const VIRTUE_PRODUCT_SLUGS = Object.values(VIRTUE_PRODUCTS);

export const CHILDREN_BLOCKED_PRODUCT_SLUGS = [
  CHILDREN_PRODUCTS.infantilNaoFicaNervoso,
] as const;

export const CHILDREN_ELIGIBLE_PRODUCT_SLUGS =
  CHILDREN_PRODUCT_SLUGS.filter(
    (slug) => !CHILDREN_BLOCKED_PRODUCT_SLUGS.includes(
      slug as (typeof CHILDREN_BLOCKED_PRODUCT_SLUGS)[number],
    ),
  );

export function validateQuizProductSlugs(
  slugs: readonly string[],
): string[] {
  return slugs.filter((slug) => !getProduct(slug));
}
