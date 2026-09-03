import type { BioQuizUniverse } from "./bio-florais";

export type BioQuizRoute =
  | { type: "question"; questionId: string }
  | { type: "result" }
  | { type: "neutral" };

export type BioQuizOption = {
  id: string;
  label: string;
  supportLabel?: string;
};

export type BioQuizQuestion = {
  id: string;
  universe?: BioQuizUniverse;
  title: string;
  subtitle?: string;
  kind: "single" | "number" | "boolean";
  options?: readonly BioQuizOption[];
};

export const BIO_QUIZ_START_QUESTION: BioQuizQuestion = {
  id: "universe",
  title: "Para quem \u00e9 o floral?",
  subtitle: "Ou voc\u00ea procura algo espec\u00edfico?",
  kind: "single",
  options: [
    { id: "adulto", label: "Adulto" },
    { id: "criancas", label: "Crian\u00e7a" },
    { id: "baby", label: "Baby (at\u00e9 3 anos)" },
    { id: "teen", label: "Teen" },
    { id: "pet", label: "Pet" },
    {
      id: "dose-unica",
      label: "Iniciar ou potencializar o cuidado",
      supportLabel: "Dose \u00danica",
    },
    {
      id: "virtudes",
      label: "Fortalecer uma virtude",
      supportLabel: "Virtudes Divinas",
    },
  ],
};

export const BIO_QUIZ_UNIVERSE_ENTRY: Record<
  BioQuizUniverse,
  string
> = {
  adulto: "adult-main",
  criancas: "children-age",
  baby: "baby-main",
  teen: "teen-main",
  pet: "pet-puppy",
  "dose-unica": "dose-main",
  virtudes: "virtues-family",
};

export const BIO_QUIZ_QUESTIONS: Record<string, BioQuizQuestion> = {
  "adult-main": {
    id: "adult-main",
    universe: "adulto",
    title: "O que mais representa o momento que voc\u00ea est\u00e1 vivendo?",
    kind: "single",
    options: [
      { id: "fear", label: "Estou sentindo medo, ansiedade ou tens\u00e3o" },
      { id: "sadness", label: "Estou triste, desanimado(a) ou sem energia emocional" },
      { id: "self-esteem", label: "Minha autoestima est\u00e1 baixa ou sinto inseguran\u00e7a" },
      { id: "study", label: "Preciso de mais concentra\u00e7\u00e3o, foco nos estudos ou mem\u00f3ria" },
      { id: "tolerance", label: "Estou impaciente, irritado(a) ou muito exigente comigo mesmo" },
      { id: "rescue", label: "Aconteceu algo recente que me abalou" },
      { id: "life-phase", label: "Estou passando por uma fase espec\u00edfica da vida" },
      { id: "habit", label: "Tenho um h\u00e1bito que quero mudar" },
      { id: "identity", label: "\u00c9 sobre minha vida \u00edntima, minha lideran\u00e7a ou minha identidade" },
      { id: "other-goal", label: "\u00c9 sobre outro objetivo da minha vida" },
      { id: "weight", label: "Quero cuidar do descontrole alimentar ou do meu peso" },
    ],
  },

  "adult-fear": {
    id: "adult-fear",
    universe: "adulto",
    title: "Qual dessas frases descreve melhor o que voc\u00ea sente?",
    kind: "single",
    options: [
      { id: "sleep", label: "Tenho dificuldade espec\u00edfica para dormir" },
      { id: "panic", label: "Sinto ondas repentinas de medo muito intenso, como se algo muito grave estivesse prestes a acontecer" },
      { id: "social-panic", label: "Sinto desconforto forte em situa\u00e7\u00f5es sociais, com outras pessoas" },
      { id: "stress", label: "Estou sobrecarregado(a) com a rotina e as responsabilidades" },
      { id: "anxiety", label: "Sinto uma inquieta\u00e7\u00e3o sem motivo claro, dificuldade de aproveitar a vida" },
      { id: "fear", label: "Sinto um medo mais amplo e recorrente, sem uma situa\u00e7\u00e3o espec\u00edfica" },
    ],
  },

  "adult-sadness": {
    id: "adult-sadness",
    universe: "adulto",
    title: "Isso \u00e9 algo recente e forte, ou mais arrastado e de fundo?",
    kind: "single",
    options: [
      { id: "sadness", label: "Recente e forte, sinto isso fisicamente, com melancolia ou aperto" },
      { id: "discouragement", label: "Mais uma falta de energia ou vontade de fazer as coisas" },
      { id: "joy", label: "Uma sensa\u00e7\u00e3o leve e constante de falta de alegria, h\u00e1 um tempo" },
    ],
  },

  "adult-self-esteem": {
    id: "adult-self-esteem",
    universe: "adulto",
    title: "Isso tem mais a ver com relacionamentos ou com autoconfian\u00e7a de um modo geral?",
    kind: "single",
    options: [
      { id: "insecurity", label: "Ci\u00fame ou inseguran\u00e7a em relacionamentos" },
      { id: "self-esteem", label: "Autoconfian\u00e7a e amor pr\u00f3prio de um modo geral" },
    ],
  },

  "adult-study": {
    id: "adult-study",
    universe: "adulto",
    title: "Isso \u00e9 sobre estudo e provas, ou sobre mem\u00f3ria no dia a dia?",
    kind: "single",
    options: [
      { id: "student", label: "Sobre estudos, provas ou concentra\u00e7\u00e3o em tarefas" },
      { id: "memory", label: "Sobre mem\u00f3ria e esquecimento no dia a dia, sem contexto de estudo" },
    ],
  },

  "adult-tolerance": {
    id: "adult-tolerance",
    universe: "adulto",
    title: "Isso \u00e9 mais sobre reagir mal com os outros ou sobre se cobrar demais?",
    kind: "single",
    options: [
      { id: "tolerance", label: "Reajo mal, fico irritado(a) ou explosivo(a) com os outros" },
      { id: "perfectionism", label: "Me cobro demais e tenho dificuldade de aceitar erros" },
    ],
  },

  "adult-life-phase": {
    id: "adult-life-phase",
    universe: "adulto",
    title: "Qual fase?",
    kind: "single",
    options: [
      { id: "menopause", label: "Menopausa" },
      { id: "senior", label: "Melhor idade" },
      { id: "tpm", label: "TPM" },
      { id: "pregnancy", label: "Gesta\u00e7\u00e3o" },
    ],
  },

  "adult-habit": {
    id: "adult-habit",
    universe: "adulto",
    title: "Qual h\u00e1bito?",
    kind: "single",
    options: [
      { id: "addictions", label: "\u00c1lcool ou outras subst\u00e2ncias" },
      { id: "smoking", label: "Cigarro ou tabagismo" },
    ],
  },

  "adult-identity": {
    id: "adult-identity",
    universe: "adulto",
    title: "O que descreve melhor?",
    kind: "single",
    options: [
      { id: "sexual", label: "\u00c9 sobre minha vida sexual ou intimidade" },
      { id: "pride", label: "\u00c9 sobre aceita\u00e7\u00e3o da minha identidade" },
      { id: "leadership", label: "\u00c9 sobre meu papel de lideran\u00e7a ou responsabilidade" },
    ],
  },

  "adult-other-goal": {
    id: "adult-other-goal",
    universe: "adulto",
    title: "Qual desses objetivos descreve melhor?",
    kind: "single",
    options: [
      { id: "financial", label: "Dinheiro, carreira ou decis\u00f5es financeiras" },
      { id: "arts", label: "Criatividade ou express\u00e3o art\u00edstica" },
      { id: "chakras", label: "Equil\u00edbrio espiritual ou energ\u00e9tico de forma mais ampla" },
      { id: "changes", label: "Uma mudan\u00e7a de vida em andamento" },
    ],
  },

  "pet-puppy": {
    id: "pet-puppy",
    universe: "pet",
    title: "Seu pet \u00e9 filhote?",
    kind: "boolean",
    options: [
      { id: "yes", label: "Sim" },
      { id: "no", label: "N\u00e3o" },
    ],
  },

  "pet-main": {
    id: "pet-main",
    universe: "pet",
    title: "O que descreve melhor o que seu pet est\u00e1 vivendo?",
    kind: "single",
    options: [
      { id: "emotion", label: "Meu pet est\u00e1 ansioso, agitado ou desanimado" },
      { id: "physical-behavior", label: "Meu pet tem um comportamento que me preocupa" },
      { id: "fear", label: "Meu pet sente medo" },
      { id: "home", label: "\u00c9 sobre a rela\u00e7\u00e3o do meu pet comigo ou com a casa" },
      { id: "discipline", label: "Meu pet tem um comportamento indisciplinado" },
      { id: "aggression", label: "Meu pet est\u00e1 agressivo" },
      { id: "barking", label: "Meu pet late muito" },
      { id: "specific", label: "\u00c9 uma situa\u00e7\u00e3o espec\u00edfica" },
    ],
  },

  "pet-emotion": {
    id: "pet-emotion",
    universe: "pet",
    title: "O que parece disparar isso no seu pet?",
    kind: "single",
    options: [
      { id: "stress", label: "Mudan\u00e7a recente de ambiente ou rotina" },
      { id: "hyperactivity", label: "Energia f\u00edsica alta mesmo depois de brincar" },
      { id: "sadness", label: "Parou de comer direito, se esconde ou mudou de h\u00e1bito" },
      { id: "anxiety", label: "Nenhum gatilho claro, \u00e9 uma agita\u00e7\u00e3o ou inquieta\u00e7\u00e3o difusa" },
    ],
  },

  "pet-physical-behavior": {
    id: "pet-physical-behavior",
    universe: "pet",
    title: "Qual comportamento?",
    kind: "single",
    options: [
      { id: "licking", label: "Lambe ou machuca a pr\u00f3pria pele" },
      { id: "coprophagia", label: "Come as pr\u00f3prias fezes" },
      { id: "food", label: "Mudou a forma de comer, a mais ou a menos" },
    ],
  },

  "pet-fear": {
    id: "pet-fear",
    universe: "pet",
    title: "Esse medo tem uma causa espec\u00edfica?",
    kind: "single",
    options: [
      { id: "fireworks", label: "Sim, fogos de artif\u00edcio ou trov\u00f5es" },
      { id: "general", label: "N\u00e3o, \u00e9 um medo mais amplo" },
    ],
  },

  "pet-home": {
    id: "pet-home",
    universe: "pet",
    title: "O que descreve melhor a situa\u00e7\u00e3o?",
    kind: "single",
    options: [
      { id: "neediness", label: "Meu pet fica muito apegado ou ciumento comigo" },
      { id: "new-home", label: "Meu pet foi doado ou mudou de casa recentemente" },
      { id: "baby-arrived", label: "Um beb\u00ea chegou recentemente na fam\u00edlia" },
    ],
  },

  "pet-discipline": {
    id: "pet-discipline",
    universe: "pet",
    title: "Qual comportamento?",
    kind: "single",
    options: [
      { id: "marking", label: "Urina em v\u00e1rios lugares para marcar territ\u00f3rio" },
      { id: "indiscipline", label: "Faz barulho, suja ou destr\u00f3i coisas em geral" },
      { id: "training", label: "Est\u00e1 em fase de aprendizado ou treino, sem mau comportamento" },
    ],
  },

  "pet-aggression": {
    id: "pet-aggression",
    universe: "pet",
    title: "Com quem ou com o qu\u00ea \u00e9 a agressividade?",
    kind: "single",
    options: [
      { id: "children", label: "Com crian\u00e7as" },
      { id: "new-animal", label: "Com a chegada de outro animal" },
      { id: "general", label: "Em outros contextos, como pessoas, espa\u00e7o ou comida" },
    ],
  },

  "pet-specific": {
    id: "pet-specific",
    universe: "pet",
    title: "Qual situa\u00e7\u00e3o?",
    kind: "single",
    options: [
      { id: "travel", label: "Viagem ou mudan\u00e7a de ambiente" },
      { id: "heat", label: "Meu pet est\u00e1 no cio" },
      { id: "false-pregnancy", label: "Demonstra sinais de gravidez sem estar prenhe" },
      { id: "bath", label: "Tem medo ou resist\u00eancia ao banho" },
      { id: "sos", label: "Algo inesperado e forte aconteceu" },
    ],
  },

  "children-age": {
    id: "children-age",
    universe: "criancas",
    title: "Qual a idade da crian\u00e7a?",
    subtitle: "Digite a idade em anos.",
    kind: "number",
  },

  "children-main": {
    id: "children-main",
    universe: "criancas",
    title: "O que descreve melhor o momento da crian\u00e7a?",
    kind: "single",
    options: [
      { id: "anxiety", label: "Sinto que meu filho(a) est\u00e1 ansioso(a)" },
      { id: "obedience", label: "Meu filho(a) est\u00e1 resistente, teimoso(a) ou desobediente" },
      { id: "fears", label: "Meu filho(a) tem medos ou pesadelos" },
      { id: "rescue", label: "Algo inesperado ou forte aconteceu recentemente" },
      { id: "development", label: "\u00c9 sobre uma fase de desenvolvimento" },
      { id: "school-social", label: "\u00c9 sobre a vida escolar ou social" },
      { id: "separation", label: "\u00c9 sobre se afastar dos pais ou cuidadores" },
      { id: "phase", label: "\u00c9 uma mistura de v\u00e1rias coisas t\u00edpicas dessa fase" },
      { id: "neutral", label: "Nenhuma dessas op\u00e7\u00f5es descreve bem o momento" },
    ],
  },

  "children-age-baby-confirm": {
    id: "children-age-baby-confirm",
    universe: "criancas",
    title: "Pela idade informada, a linha Baby pode ser mais adequada para este momento.",
    subtitle: "Quer continuar pelo Quiz Baby?",
    kind: "single",
    options: [
      { id: "redirect", label: "Sim, continuar pelo Baby" },
      { id: "stay", label: "Continuar pelo Quiz Crian\u00e7as" },
    ],
  },

  "children-age-teen-confirm": {
    id: "children-age-teen-confirm",
    universe: "criancas",
    title: "Pela idade informada, a linha Teen pode ser mais adequada para este momento.",
    subtitle: "Quer continuar pelo Quiz Teen?",
    kind: "single",
    options: [
      { id: "redirect", label: "Sim, continuar pelo Teen" },
      { id: "stay", label: "Continuar pelo Quiz Crian\u00e7as" },
    ],
  },

  "children-age-adult-confirm": {
    id: "children-age-adult-confirm",
    universe: "criancas",
    title: "Pela idade informada, a linha Adulto pode ser mais adequada para este momento.",
    subtitle: "Quer continuar pelo Quiz Adulto?",
    kind: "single",
    options: [
      { id: "redirect", label: "Sim, continuar pelo Adulto" },
      { id: "stay", label: "Continuar pelo Quiz Crian\u00e7as" },
    ],
  },

  "children-fears": {
    id: "children-fears",
    universe: "criancas",
    title: "\u00c9 mais um medo durante o dia ou algo que acontece \u00e0 noite, durante o sono?",
    kind: "single",
    options: [
      { id: "day", label: "Durante o dia" },
      { id: "night", label: "\u00c0 noite, durante o sono" },
      { id: "both", label: "Os dois" },
    ],
  },

  "children-development": {
    id: "children-development",
    universe: "criancas",
    title: "Qual dessas situa\u00e7\u00f5es?",
    kind: "single",
    options: [
      { id: "school", label: "Dificuldade de ir para escola ou creche, com apego exagerado" },
      { id: "hyperactivity", label: "Excesso de energia ou impaci\u00eancia" },
      { id: "crying", label: "Choro frequente sem outro sintoma claro" },
      { id: "diaper-pacifier", label: "Retirando a fralda ou a chupeta" },
      { id: "sleep", label: "Dificuldade de pegar no sono" },
    ],
  },

  "children-school-social": {
    id: "children-school-social",
    universe: "criancas",
    title: "Qual dessas situa\u00e7\u00f5es?",
    kind: "single",
    options: [
      { id: "concentration", label: "Dificuldade de concentra\u00e7\u00e3o ou aten\u00e7\u00e3o na escola" },
      { id: "social", label: "Dificuldade de conviver com colegas, timidez ou egocentrismo" },
      { id: "food", label: "Mudan\u00e7a no comportamento alimentar" },
    ],
  },

  "children-separation": {
    id: "children-separation",
    universe: "criancas",
    title: "O que descreve melhor?",
    kind: "single",
    options: [
      { id: "separation", label: "Os pais est\u00e3o se separando ou se separaram" },
      { id: "neediness", label: "Fica desconfort\u00e1vel quando longe dos cuidadores no dia a dia" },
    ],
  },

  "teen-main": {
    id: "teen-main",
    universe: "teen",
    title: "O que descreve melhor o momento do adolescente?",
    kind: "single",
    options: [
      { id: "emotion", label: "Meu humor est\u00e1 inst\u00e1vel, sem motivo aparente" },
      { id: "study", label: "Tenho dificuldade com estudos, rotina ou organiza\u00e7\u00e3o" },
      { id: "aggression", label: "Me sinto incompreendido(a), o que me deixa triste, fechado(a) ou agressivo(a)" },
      { id: "relationships", label: "Meus relacionamentos com pais, amigos ou fam\u00edlia est\u00e3o abalados" },
      { id: "food", label: "Estou com o comportamento alimentar alterado" },
      { id: "rescue", label: "Algo recente e forte aconteceu" },
      { id: "sexuality", label: "Estou vivendo descobertas e mudan\u00e7as relacionadas \u00e0 sexualidade" },
      { id: "phase", label: "N\u00e3o sei apontar um \u00fanico motivo, \u00e9 uma mistura de v\u00e1rias coisas t\u00edpicas da fase" },
    ],
  },

  "teen-emotion": {
    id: "teen-emotion",
    universe: "teen",
    title: "Qual descreve melhor?",
    kind: "single",
    options: [
      { id: "emotional-control", label: "Raiva ou tristeza repentina, sem motivo aparente" },
      { id: "my-place", label: "D\u00favidas sobre quem sou ou onde me encaixo" },
      { id: "stubbornness", label: "Resisto ou discordo de regras e ideias dos outros" },
      { id: "changes", label: "N\u00e3o sou mais crian\u00e7a, mas tamb\u00e9m n\u00e3o me sinto adulto(a)" },
    ],
  },

  "teen-study": {
    id: "teen-study",
    universe: "teen",
    title: "\u00c9 mais sobre focar durante o estudo ou organizar a rotina e prioridades?",
    kind: "single",
    options: [
      { id: "concentration", label: "Focar e prestar aten\u00e7\u00e3o durante o estudo" },
      { id: "organization", label: "Organizar rotina, estudos, responsabilidades e prioridades" },
    ],
  },

  "baby-main": {
    id: "baby-main",
    universe: "baby",
    title: "O que descreve melhor este momento?",
    kind: "single",
    options: [
      { id: "emotion", label: "O beb\u00ea est\u00e1 inquieto, chora muito ou tem dificuldade de dormir" },
      { id: "development", label: "\u00c9 sobre um marco de desenvolvimento" },
      { id: "routine", label: "\u00c9 sobre uma mudan\u00e7a de rotina ou situa\u00e7\u00e3o social" },
      { id: "pregnancy", label: "\u00c9 sobre a gesta\u00e7\u00e3o, n\u00e3o sobre o beb\u00ea j\u00e1 nascido" },
      { id: "rescue", label: "Algo inesperado ou forte aconteceu recentemente" },
    ],
  },

  "baby-emotion": {
    id: "baby-emotion",
    universe: "baby",
    title: "Qual sinal \u00e9 mais forte?",
    kind: "single",
    options: [
      { id: "crying", label: "Choro frequente e intenso" },
      { id: "sleep", label: "Dificuldade espec\u00edfica na hora de dormir" },
      { id: "nervous", label: "Inquieta\u00e7\u00e3o ou irritabilidade geral" },
    ],
  },

  "baby-development": {
    id: "baby-development",
    universe: "baby",
    title: "Qual marco?",
    kind: "single",
    options: [
      { id: "pacifier", label: "Retirada da chupeta" },
      { id: "diaper", label: "Retirada da fralda" },
      { id: "speech", label: "Desenvolvimento da fala ou comunica\u00e7\u00e3o" },
    ],
  },

  "baby-routine": {
    id: "baby-routine",
    universe: "baby",
    title: "Qual situa\u00e7\u00e3o?",
    kind: "single",
    options: [
      { id: "mother-work", label: "A m\u00e3e voltou ao trabalho, com novos cuidadores ou hor\u00e1rios" },
      { id: "social", label: "Mais contato com pessoas ou ambientes novos" },
      { id: "vaccine", label: "Per\u00edodo ap\u00f3s uma vacina" },
    ],
  },

  "dose-main": {
    id: "dose-main",
    universe: "dose-unica",
    title: "O que voc\u00ea quer come\u00e7ar ou potencializar?",
    kind: "single",
    options: [
      { id: "anxiety", label: "Ansiedade ou tens\u00e3o do dia a dia" },
      { id: "stress", label: "Sobrecarga de rotina" },
      { id: "sleep", label: "Dificuldade para dormir" },
      { id: "rescue", label: "Algo recente que me abalou" },
      { id: "sadness", label: "Tristeza ou des\u00e2nimo mais forte" },
      { id: "weight", label: "Descontrole alimentar ou peso" },
    ],
  },

  "virtues-family": {
    id: "virtues-family",
    universe: "virtudes",
    title: "O que voc\u00ea mais quer fortalecer agora?",
    kind: "single",
    options: [
      { id: "relations", label: "Quero me relacionar melhor com as pessoas ao meu redor" },
      { id: "strength", label: "Quero mais coragem e confian\u00e7a para agir" },
      { id: "balance", label: "Quero mais paz e equil\u00edbrio dentro de mim" },
      { id: "clarity", label: "Quero mais clareza para tomar decis\u00f5es" },
      { id: "authenticity", label: "Quero ser mais verdadeiro comigo mesmo e com os outros" },
      { id: "transformation", label: "Quero soltar o que me pesa e me renovar por dentro" },
      { id: "discipline", label: "Quero disciplina e for\u00e7a de vontade para realizar meus objetivos" },
      { id: "love", label: "Quero cultivar mais amor e generosidade" },
    ],
  },

  "virtues-relations-split": {
    id: "virtues-relations-split",
    universe: "virtudes",
    title: "Isso \u00e9 mais sobre...",
    kind: "single",
    options: [
      { id: "other", label: "Como eu trato e percebo o outro" },
      { id: "position", label: "Como eu me posiciono e me sustento nas rela\u00e7\u00f5es" },
    ],
  },

  "virtues-relations-other": {
    id: "virtues-relations-other",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "compreensao", label: "Quero entender melhor o que o outro sente", supportLabel: "Compreens\u00e3o" },
      { id: "gentileza", label: "Quero ser mais gentil no dia a dia", supportLabel: "Gentileza" },
      { id: "docura", label: "Quero tratar o outro com mais suavidade", supportLabel: "Do\u00e7ura" },
    ],
  },

  "virtues-relations-position": {
    id: "virtues-relations-position",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "respeito", label: "Quero ter mais considera\u00e7\u00e3o pelo espa\u00e7o do outro", supportLabel: "Respeito" },
      { id: "justica", label: "Quero ser mais justo(a) nas minhas decis\u00f5es", supportLabel: "Justi\u00e7a" },
      { id: "lealdade", label: "Quero ser mais leal com quem confia em mim", supportLabel: "Lealdade" },
      { id: "tolerancia", label: "Quero conviver melhor com o que \u00e9 diferente de mim", supportLabel: "Toler\u00e2ncia" },
    ],
  },

  "virtues-strength": {
    id: "virtues-strength",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "coragem", label: "Quero enfrentar meus medos", supportLabel: "Coragem" },
      { id: "autoconfianca", label: "Quero confiar mais em mim mesmo(a)", supportLabel: "Autoconfian\u00e7a" },
    ],
  },

  "virtues-balance": {
    id: "virtues-balance",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "contentamento", label: "Quero me sentir satisfeito(a) com o que tenho", supportLabel: "Contentamento" },
      { id: "estabilidade", label: "Quero mais firmeza emocional", supportLabel: "Estabilidade" },
      { id: "paciencia", label: "Quero manter a calma e n\u00e3o perder a paci\u00eancia", supportLabel: "Paci\u00eancia" },
      { id: "serenidade", label: "Quero mais tranquilidade interior", supportLabel: "Serenidade" },
      { id: "leveza", label: "Quero me livrar do peso que carrego", supportLabel: "Leveza" },
    ],
  },

  "virtues-clarity": {
    id: "virtues-clarity",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "prudencia", label: "Quero ter mais cautela antes de agir", supportLabel: "Prud\u00eancia" },
      { id: "sabedoria", label: "Quero agir com mais conhecimento e menos impulso", supportLabel: "Sabedoria" },
      { id: "discernimento", label: "Quero ter mais clareza para escolher entre op\u00e7\u00f5es", supportLabel: "Discernimento" },
    ],
  },

  "virtues-authenticity": {
    id: "virtues-authenticity",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "honestidade", label: "Quero agir com verdade nas minhas atitudes", supportLabel: "Honestidade" },
      { id: "humildade", label: "Quero reconhecer meus limites sem me diminuir", supportLabel: "Humildade" },
      { id: "espontaneidade", label: "Quero me expressar livremente, sem me policiar", supportLabel: "Espontaneidade" },
      { id: "simplicidade", label: "Quero viver sem excesso, sem complicar", supportLabel: "Simplicidade" },
      { id: "verdade", label: "Quero ser fiel a mim mesmo, sem me enganar", supportLabel: "Verdade" },
    ],
  },

  "virtues-transformation": {
    id: "virtues-transformation",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "pureza", label: "Quero manter minha inten\u00e7\u00e3o e meus pensamentos limpos", supportLabel: "Pureza" },
      { id: "limpeza", label: "Quero me livrar do que me suja ou pesa por dentro", supportLabel: "Limpeza" },
      { id: "desapego", label: "Quero soltar o que n\u00e3o me serve mais", supportLabel: "Desapego" },
      { id: "perdao", label: "Quero perdoar e me libertar de m\u00e1goas", supportLabel: "Perd\u00e3o" },
      { id: "flexibilidade", label: "Quero me adaptar melhor \u00e0s mudan\u00e7as", supportLabel: "Flexibilidade" },
    ],
  },

  "virtues-discipline": {
    id: "virtues-discipline",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "dedicacao", label: "Quero terminar o que come\u00e7o", supportLabel: "Dedica\u00e7\u00e3o" },
      { id: "responsabilidade", label: "Quero assumir melhor minhas responsabilidades", supportLabel: "Responsabilidade" },
      { id: "disciplina", label: "Quero mais disciplina no dia a dia", supportLabel: "Disciplina" },
      { id: "determinacao", label: "Quero permanecer firme at\u00e9 alcan\u00e7ar meu objetivo", supportLabel: "Determina\u00e7\u00e3o" },
    ],
  },

  "virtues-love": {
    id: "virtues-love",
    universe: "virtudes",
    title: "O que voc\u00ea quer fortalecer?",
    kind: "single",
    options: [
      { id: "generosidade", label: "Quero dar mais de mim ao pr\u00f3ximo", supportLabel: "Generosidade" },
      { id: "gratidao", label: "Quero reconhecer e agradecer o que tenho", supportLabel: "Gratid\u00e3o" },
      { id: "amor", label: "Quero cultivar mais amor incondicional", supportLabel: "Amor" },
      { id: "benevolencia", label: "Quero abandonar inveja, raiva e julgamento", supportLabel: "Benevol\u00eancia" },
      { id: "compaixao", label: "Quero acolher o sofrimento do outro com compaix\u00e3o", supportLabel: "Compaix\u00e3o" },
    ],
  },
};

export function getBioQuizQuestion(
  questionId: string,
): BioQuizQuestion | null {
  return BIO_QUIZ_QUESTIONS[questionId] ?? null;
}
