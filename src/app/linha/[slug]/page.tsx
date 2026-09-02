import fs from "node:fs";
import path from "node:path";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  bioCommercialOrder,
  getLine,
  getProductsByLine,
  type BioProduct,
} from "@/lib/catalog/bio-products";

type VisualCard = {
  key: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  href: string;
  image: string;
  product: BioProduct;
  isPair: boolean;
};

const lineVisuals: Record<
  string,
  {
    image: string;
    eyebrow: string;
    description: string;
    headline: string;
  }
> = {
  adulto: {
    image:
      "/assets/home/linhas/Adulto.png",

    eyebrow:
      "Cuidado para diferentes momentos",

    description:
      "Encontre a versão Bio Florais que combina com o seu momento e sua rotina.",

    headline:
      "Encontre o floral para o seu momento.",
  },

  pet: {
    image:
      "/assets/home/linhas/Pet.png",

    eyebrow:
      "Equilíbrio também para quem faz parte da família",

    description:
      "Florais e cuidados desenvolvidos para diferentes comportamentos e momentos dos pets.",

    headline:
      "Encontre o cuidado ideal para o seu pet.",
  },

  infantil: {
    image:
      "/assets/home/linhas/Infantil.png",

    eyebrow:
      "Cuidado para os pequenos",

    description:
      "Uma linha criada para acompanhar diferentes fases e desafios da infância.",

    headline:
      "Cuidado floral para cada fase da infância.",
  },

  baby: {
    image:
      "/assets/home/linhas/Baby.png",

    eyebrow:
      "Desde os primeiros momentos",

    description:
      "Cuidados Bio Florais pensados especialmente para a primeira infância.",

    headline:
      "Cuidado delicado desde os primeiros momentos.",
  },

  kids: {
    image:
      "/assets/home/linhas/Kids.png",

    eyebrow:
      "Crescer também é aprender a se equilibrar",

    description:
      "Versões desenvolvidas para diferentes momentos do universo infantil.",

    headline:
      "Equilíbrio para crescer, descobrir e aprender.",
  },

  teen: {
    image:
      "/assets/home/linhas/Teen.png",

    eyebrow:
      "Para uma fase cheia de mudanças",

    description:
      "Bio Florais para acompanhar emoções, descobertas e transformações da adolescência.",

    headline:
      "Para uma fase cheia de descobertas e mudanças.",
  },

  "dose-unica": {
    image:
      "/assets/home/linhas/DoseUnica.png",

    eyebrow:
      "Praticidade Bio Florais",

    description:
      "Versões em apresentação prática para diferentes momentos do dia.",

    headline:
      "Praticidade para cuidar de você onde estiver.",
  },

  "virtudes-divinas": {
    image:
      "/assets/home/linhas/VirtudesDivinas.png",

    eyebrow:
      "Um universo de virtudes",

    description:
      "Explore as 36 versões e encontre aquela que conversa com o seu momento.",

    headline:
      "Descubra a virtude que conversa com o seu momento.",
  },

  cosmeticos: {
    image:
      "/assets/home/linhas/Cosmetico.png",

    eyebrow:
      "Cuidado que vai além dos florais",

    description:
      "Shampoos, condicionadores, cremes e cuidados que ampliam o universo Bio Florais.",

    headline:
      "Transforme o cuidado em um ritual diário.",
  },

  "cosmeticos-pet": {
    image:
      "/assets/home/linhas/CosmeticoPet.png",

    eyebrow:
      "Cuidado completo para pets",

    description:
      "Higiene, perfumação e cuidados associados ao universo Bio Florais Pet.",

    headline:
      "Cuidado completo para cães e gatos.",
  },

  "home-care": {
    image:
      "/assets/home/linhas/HomeCare.png",

    eyebrow:
      "Bio Florais também para a casa",

    description:
      "Aromatizadores e sabonetes para levar a experiência Bio Florais para outros momentos da rotina.",

    headline:
      "Transforme a atmosfera da sua casa.",
  },
};

function imageExists(
  publicPath: string
) {
  const cleanPath =
    publicPath.replace(
      /^\//,
      ""
    );

  return fs.existsSync(
    path.join(
      process.cwd(),
      "public",
      cleanPath
    )
  );
}

const cardProductFolders: Record<
  string,
  string
> = {
  adulto: "floraladulto",
  pet: "floralpet",
  infantil: "floralinfantil",
  baby: "baby",
  kids: "kids",
  teen: "teen",
  "dose-unica": "dose-unica",
  "virtudes-divinas": "virtudes-divinas",
  cosmeticos: "cosmeticos",
  "cosmeticos-pet": "cosmeticos-pet",
  "home-care": "home-care",
};

function normalizeCardName(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

const cardProductAliases:
  Record<
    string,
    string[]
  > = {

  /*
   * ========================================================
   * ADULTO
   * Nomes f?sicos atualmente utilizados em public/cardprodutos
   * ========================================================
   */

  "adulto-floral-em-gotas-autoestima":
    ["autoestima"],

  "adulto-floral-em-gotas-carencia-de-alegria":
    ["carencia"],

  "adulto-floral-em-gotas-das-artes":
    ["dasartes", "das-artes"],

  "adulto-floral-em-gotas-desanimo":
    ["desanimo"],

  "adulto-floral-em-gotas-fase-da-adolescencia":
    ["adolescencia"],

  "adulto-floral-em-gotas-fase-da-infancia":
    ["infancia"],

  "adulto-floral-em-gotas-fase-da-melhor-idade":
    ["melhor-idade"],

  "adulto-floral-em-gotas-fase-da-menopausa":
    ["menopausa"],

  "adulto-floral-em-gotas-falta-de-memoria":
    ["memoria"],

  "adulto-floral-em-gotas-falta-de-tolerancia":
    ["tolerancia"],

  "adulto-floral-em-gotas-gestacao":
    ["gestacao"],

  "adulto-floral-em-gotas-inseguranca":
    ["inseguranca"],

  "adulto-floral-em-gotas-lideranca":
    ["lideranca"],

  "adulto-floral-em-gotas-magoa":
    ["magoa"],

  "adulto-floral-em-gotas-medo":
    ["medo"],

  "adulto-floral-em-gotas-momento-do-estudante":
    ["estudante", "momento-do-estudante"],


  /*
   * ========================================================
   * PET
   * ========================================================
   */

  "pet-floral-em-gotas-aceitando-um-novo-animal":
    ["aceitando-novo-animal"],

  "pet-floral-em-gotas-adaptacao-a-um-novo-lar":
    ["adaptacao-novo-lar"],

  "pet-floral-em-gotas-adestramento":
    ["adestramento"],

  "pet-floral-em-gotas-ansiedade":
    ["ansiedade", "ansiedade2", "ansiedade3"],

  "pet-floral-em-gotas-autoestima":
    ["autoestima", "autoestima2"],

  "pet-floral-em-gotas-aversao-a-banho":
    ["aversao-banho"],

  "pet-floral-em-gotas-aversao-a-criancas":
    ["aversao-crianca"],

  "pet-floral-em-gotas-o-bebe-chegou":
    ["bebe-chegou"],

  "pet-floral-em-gotas-carencia-e-sindrome-do-abandono":
    ["carencia-sindrome-abandono"],

  "pet-floral-em-gotas-coprofagia":
    ["coprofagia"],

  "pet-floral-em-gotas-stress":
    ["estresse", "stress"],

  "pet-floral-em-gotas-fase-do-cio":
    ["fase-do-cio"],

  "pet-floral-em-gotas-filhotes":
    ["filhotes"],

  "pet-floral-em-gotas-gravidez-psicologica":
    ["gravidez-psicologica"],

  "pet-floral-em-gotas-hiperatividade":
    ["hiperatividade"],

  "pet-floral-em-gotas-indisciplina":
    ["indisciplina"],

  "pet-floral-em-gotas-lambedura-e-automutilacao":
    ["lambedura-automutilacao"],

  "pet-floral-em-gotas-latido-excessivo":
    ["latido-excessivo"],

  "pet-floral-em-gotas-marcacao-de-territorio":
    ["marcacao-territorio"],

  "pet-floral-em-gotas-medo-de-fogos":
    ["medo-fogos"],

  "pet-floral-em-gotas-medo":
    ["medo"],

  "pet-floral-em-gotas-reequilibrio-alimentar":
    ["reequilibrio-alimentar"],

  "pet-floral-em-gotas-s-o-s":
    ["rescue-sos", "sos"],

  "pet-floral-em-gotas-rescue":
    ["rescue-sos", "rescue"],

  "pet-floral-em-gotas-tristeza-e-depressao":
    ["tristeza-depressao"],

  "pet-floral-em-gotas-viagens":
    ["viagem", "viagens"],
};


function normalizeCardFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const explicitProductCards: Record<string, string> = {
  // ADULTO
  "adulto-floral-em-gotas-fase-da-adolescencia": "/cardprodutos/floraladulto/adolescencia.png",
  "adulto-floral-em-gotas-autoestima": "/cardprodutos/floraladulto/autoestima.png",
  "adulto-floral-em-gotas-carencia-de-alegria": "/cardprodutos/floraladulto/carencia.png",
  "adulto-floral-em-gotas-das-artes": "/cardprodutos/floraladulto/dasartes.png",
  "adulto-floral-em-gotas-desanimo": "/cardprodutos/floraladulto/desanimo.png",
  "adulto-floral-em-gotas-momento-do-estudante": "/cardprodutos/floraladulto/estudante.png",
  "adulto-floral-em-gotas-gestacao": "/cardprodutos/floraladulto/gestacao.png",
  "adulto-floral-em-gotas-fase-da-infancia": "/cardprodutos/floraladulto/infancia.png",
  "adulto-floral-em-gotas-inseguranca": "/cardprodutos/floraladulto/inseguranca.png",
  "adulto-floral-em-gotas-lideranca": "/cardprodutos/floraladulto/lideranca.png",
  "adulto-floral-em-gotas-magoa": "/cardprodutos/floraladulto/magoa.png",
  "adulto-floral-em-gotas-medo": "/cardprodutos/floraladulto/medo.png",
  "adulto-floral-em-gotas-fase-da-melhor-idade": "/cardprodutos/floraladulto/melhor-idade.png",
  "adulto-floral-em-gotas-falta-de-memoria": "/cardprodutos/floraladulto/memoria.png",
  "adulto-floral-em-gotas-fase-da-menopausa": "/cardprodutos/floraladulto/menopausa.png",
  "adulto-floral-em-gotas-mudancas-na-vida": "/cardprodutos/floraladulto/mudancas-vida.png",
  "adulto-floral-em-gotas-panico-social": "/cardprodutos/floraladulto/panico-social.png",
  "adulto-floral-em-gotas-panico": "/cardprodutos/floraladulto/panico.png",
  "adulto-floral-em-gotas-parar-de-fumar": "/cardprodutos/floraladulto/parar-fumar.png",
  "adulto-floral-em-gotas-parceiro-sexual": "/cardprodutos/floraladulto/parceiro-sexual.png",
  "adulto-floral-em-gotas-perfeccionismo": "/cardprodutos/floraladulto/perfeccionismo.png",
  "adulto-floral-em-gotas-falta-de-tolerancia": "/cardprodutos/floraladulto/tolerancia.png",
  "adulto-floral-em-gotas-momento-tpm": "/cardprodutos/floraladulto/tpm.png",

  "adulto-floral-em-gotas-sensacao-de-ansiedade": "/cardprodutos/floraladulto/sensacao-ansiedade.png",
  "adulto-floral-em-gotas-rescue": "/cardprodutos/floraladulto/rescue.png",
  "adulto-floral-em-gotas-sono": "/cardprodutos/floraladulto/sono.png",
  "adulto-floral-em-gotas-tristeza-estado-depressivo": "/cardprodutos/floraladulto/tristeza-depressao.png",
  "adulto-floral-em-gotas-reducao-de-peso": "/cardprodutos/floraladulto/reducao-peso.png",
  "adulto-floral-em-gotas-stress": "/cardprodutos/floraladulto/stress.png",
  "adulto-floral-em-gotas-vicios-e-dependencias": "/cardprodutos/floraladulto/vicios-dependencias.png",
  "adulto-floral-em-gotas-reequilibrio-dos-chakras": "/cardprodutos/floraladulto/reequilibrio-chackras.png",
  "adulto-floral-em-gotas-sucesso-financeiro": "/cardprodutos/floraladulto/sucesso-financeiro.png",
  "adulto-floral-em-gotas-pride": "/cardprodutos/floraladulto/pride.png",

  // PET
  "pet-floral-em-gotas-aceitando-um-novo-animal": "/cardprodutos/floralpet/aceitando-novo-animal.png",
  "pet-floral-em-gotas-adaptacao-a-um-novo-lar": "/cardprodutos/floralpet/adaptacao-novo-lar.png",
  "pet-floral-em-gotas-adestramento": "/cardprodutos/floralpet/adestramento.png",
  "pet-floral-em-gotas-ansiedade": "/cardprodutos/floralpet/ansiedade.png",
  "pet-floral-em-gotas-autoestima": "/cardprodutos/floralpet/autoestima.png",
  "pet-floral-em-gotas-aversao-a-banho": "/cardprodutos/floralpet/aversao-banho.png",
  "pet-floral-em-gotas-aversao-a-criancas": "/cardprodutos/floralpet/aversao-crianca.png",
  "pet-floral-em-gotas-o-bebe-chegou": "/cardprodutos/floralpet/bebe-chegou.png",
  "pet-floral-em-gotas-carencia-e-sindrome-do-abandono": "/cardprodutos/floralpet/carencia-sindrome-abandono.png",
  "pet-floral-em-gotas-coprofagia": "/cardprodutos/floralpet/coprofagia.png",
  "pet-floral-em-gotas-stress": "/cardprodutos/floralpet/estresse.png",
  "pet-floral-em-gotas-fase-do-cio": "/cardprodutos/floralpet/fase-do-cio.png",
  "pet-floral-em-gotas-filhotes": "/cardprodutos/floralpet/filhotes.png",
  "pet-floral-em-gotas-gravidez-psicologica": "/cardprodutos/floralpet/gravidez-psicologica.png",
  "pet-floral-em-gotas-hiperatividade": "/cardprodutos/floralpet/hiperatividade.png",
  "pet-floral-em-gotas-indisciplina": "/cardprodutos/floralpet/indisciplina.png",
  "pet-floral-em-gotas-lambedura-e-automutilacao": "/cardprodutos/floralpet/lambedura-automutilacao.png",
  "pet-floral-em-gotas-latido-excessivo": "/cardprodutos/floralpet/latido-excessivo.png",
  "pet-floral-em-gotas-marcacao-de-territorio": "/cardprodutos/floralpet/marcacao-territorio.png",
  "pet-floral-em-gotas-medo-de-fogos": "/cardprodutos/floralpet/medo-fogos.png",
  "pet-floral-em-gotas-medo": "/cardprodutos/floralpet/medo.png",
  "pet-floral-em-gotas-reequilibrio-alimentar": "/cardprodutos/floralpet/reequilibrio-alimentar.png",
  "pet-floral-em-gotas-s-o-s": "/cardprodutos/floralpet/rescue-sos.png",
  "pet-floral-em-gotas-tristeza-e-depressao": "/cardprodutos/floralpet/tristeza-depressao.png",
  "pet-floral-em-gotas-viagens": "/cardprodutos/floralpet/viagem.png",
};
function getCardProductImage(
  lineSlug: string,
  productSlug: string
) {
  /*
   * ========================================================
   * PAGINA B ? CARDS DE PRODUTOS
   * ========================================================
   *
   * REGRA:
   *
   * public/cardprodutos = cards exclusivos da Pagina B.
   * public/products     = fotos exclusivas da PDP/Pagina C.
   *
   * Nao misturar as duas estruturas.
   */

  const explicitCard =
    explicitProductCards[productSlug];

  if (explicitCard) {
    return explicitCard;
  }

  /*
   * Pasta f?sica real de cada linha dentro de:
   *
   * public/cardprodutos/
   */
  const foldersByLine: Record<string, string> = {
    adulto: "floraladulto",
    pet: "floralpet",
    infantil: "floralinfantil",
    baby: "baby",
    kids: "kids",
    teen: "teen",
    "dose-unica": "dose-unica",
    "virtudes-divinas": "virtudes-divinas",

    // Mant?m compatibilidade com as demais linhas.
    cosmeticos: "cosmeticos",
    "cosmeticos-pet": "cosmeticos-pet",
    "home-care": "home-care",
  };

  const folder =
    foldersByLine[lineSlug] ??
    cardProductFolders[lineSlug] ??
    lineSlug;

  const directory = path.join(
    process.cwd(),
    "public",
    "cardprodutos",
    folder
  );

  if (!fs.existsSync(directory)) {
    return "";
  }

  /*
   * ========================================================
   * FILTRO DOS ARQUIVOS DA PAGINA B
   * ========================================================
   *
   * Regras aprovadas:
   *
   * PET:
   *   ansiedade2 / ansiedade3 etc = IGNORAR
   *
   * KIDS:
   *   rescue-sos2 etc = IGNORAR
   *
   * TEEN:
   *   relacionamentosB etc = IGNORAR
   *
   * VIRTUDES:
   *   como-funciona
   *   como-funcionaB
   *   foto2
   *   = NAO sao cards de produto.
   */

  const files = fs
    .readdirSync(directory, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(png|jpg|jpeg|webp|avif)$/i.test(
          entry.name
        )
    )
    .filter((entry) => {
      const stem =
        entry.name.replace(/\.[^.]+$/, "");

      const normalized =
        normalizeCardFileName(stem);

      // Arquivos editoriais / auxiliares.
      if (
        normalized === "como-funciona" ||
        normalized === "foto2"
      ) {
        return false;
      }

      /*
       * Ignora c?pias alternativas:
       *
       * ansiedade2
       * ansiedade3
       * rescue-sos2
       * relacionamentosB
       * sabedoriaB
       * como-funcionaB
       */
      if (/[0-9]+$/i.test(stem)) {
        return false;
      }

      if (/b$/i.test(stem)) {
        return false;
      }

      return true;
    });

  /*
   * ========================================================
   * NOMES QUE NAO COINCIDEM 1:1 ENTRE CATALOGO E ARQUIVO
   * ========================================================
   */

  const explicitAliases: Record<
    string,
    string[]
  > = {

    // ======================================================
    // PET | SNACK FLOWERS
    // ======================================================

    "pet-snack-floral-agressividade":
      ["snack-agressividade"],

    "pet-snack-floral-ansiedade":
      ["snack-ansiedade"],

    "pet-snack-floral-filhotes":
      ["snack-filhotes"],

    "pet-snack-floral-hiperatividade":
      ["snack-hiperatividade"],

    "pet-snack-floral-lambedura":
      ["snack-lambedura"],

    "pet-snack-floral-medo":
      ["snack-medo"],


    // ======================================================
    // ADULTO
    // ======================================================

    adulto: [
      "sensacao-ansiedade",
      "sensacao-de-ansiedade",
      "ansiedade",
    ],

    "adulto-floral-em-gotas-sensacao-de-ansiedade":
      [
        "sensacao-ansiedade",
        "sensacao-de-ansiedade",
        "ansiedade",
      ],

    "adulto-floral-em-gotas-carencia-de-alegria":
      ["carencia"],

    "adulto-floral-em-gotas-das-artes":
      ["dasartes"],

    "adulto-floral-em-gotas-fase-da-adolescencia":
      ["adolescencia"],

    "adulto-floral-em-gotas-fase-da-infancia":
      ["infancia"],

    "adulto-floral-em-gotas-fase-da-melhor-idade":
      ["melhor-idade"],

    "adulto-floral-em-gotas-fase-da-menopausa":
      ["menopausa"],

    "adulto-floral-em-gotas-falta-de-memoria":
      ["memoria"],

    "adulto-floral-em-gotas-falta-de-tolerancia":
      ["tolerancia"],

    "adulto-floral-em-gotas-momento-do-estudante":
      ["estudante"],

    "adulto-floral-em-gotas-momento-tpm":
      ["tpm"],

    "adulto-floral-em-gotas-mudancas-na-vida":
      ["mudancas-vida"],

    "adulto-floral-em-gotas-parar-de-fumar":
      ["parar-fumar"],

    "adulto-floral-em-gotas-reducao-de-peso":
      ["reducao-peso"],

    "adulto-floral-em-gotas-reequilibrio-dos-chakras":
      [
        "reequilibrio-chackras",
        "reequilibrio-chakras",
      ],

    "adulto-floral-em-gotas-tristeza-estado-depressivo":
      ["tristeza-depressao"],

    "adulto-floral-em-gotas-vicios-e-dependencias":
      ["vicios-dependencias"],


    // ======================================================
    // PET
    // ======================================================

    "pet-floral-em-gotas-ansiedade":
      ["ansiedade"],

    "pet-floral-em-gotas-lambedura-e-automutilacao":
      ["lambedura-automutilacao"],

    "pet-floral-em-gotas-stress":
      ["estresse"],

    "pet-floral-em-gotas-carencia-e-sindrome-do-abandono":
      ["carencia-sindrome-abandono"],

    "pet-floral-em-gotas-viagens":
      ["viagem"],

    "pet-floral-em-gotas-s-o-s":
      ["rescue-sos"],

    "pet-floral-em-gotas-medo-de-fogos":
      ["medo-fogos"],

    "pet-floral-em-gotas-aceitando-um-novo-animal":
      ["aceitando-novo-animal"],

    "pet-floral-em-gotas-adaptacao-a-um-novo-lar":
      ["adaptacao-novo-lar"],

    "pet-floral-em-gotas-marcacao-de-territorio":
      ["marcacao-territorio"],

    "pet-floral-em-gotas-aversao-a-banho":
      ["aversao-banho"],

    "pet-floral-em-gotas-aversao-a-criancas":
      ["aversao-crianca"],

    "pet-floral-em-gotas-o-bebe-chegou":
      ["bebe-chegou"],

    "pet-floral-em-gotas-reequilibrio-alimentar":
      ["reequilibrio-alimentar"],

    "pet-floral-em-gotas-tristeza-e-depressao":
      ["tristeza-depressao"],


    // ======================================================
    // INFANTIL
    // ======================================================

    "infantil-floral-em-gotas-medos-infantis-e-pesadelos":
      ["medos-infantis-pesadelos"],

    "infantil-floral-em-gotas-tirando-a-fralda-e-a-chupeta":
      ["tirando-fralda-chupeta"],

    "infantil-floral-em-gotas-rescue-s-o-s":
      ["rescue-sos"],


    // ======================================================
    // BABY
    // ======================================================

    "baby-floral-em-gotas-mamae-volta-ao-trabalho":
      ["mamae-volta-trabalho"],

    "baby-floral-em-gotas-tirando-a-chupeta":
      ["tirando-chupeta"],

    "baby-floral-em-gotas-tirando-a-fralda":
      ["tirando-fralda"],

    "baby-floral-em-gotas-rescue-s-o-s":
      ["rescue-sos"],


    // ======================================================
    // KIDS
    // ======================================================

    "kids-floral-em-gotas-momento-reequilibrio-alimentar":
      ["reequilibrio-alimentar"],

    "kids-floral-em-gotas-rescue-s-o-s":
      ["rescue-sos"],


    // ======================================================
    // TEEN
    // ======================================================

    "teen-floral-em-gotas-rescue-s-o-s":
      ["rescue-sos"],


    // ======================================================
    // DOSE UNICA
    // ======================================================

    "dose-unica-floral-dose-unica-perda-de-peso":
      ["perda-peso"],

    "dose-unica-floral-dose-unica-rescue-s-o-s":
      ["rescue"],


    // ======================================================
    // COSMETICOS HUMANOS | PAGINA B
    // ======================================================
    //
    // Shampoo + Condicionador com o MESMO nome sao agrupados
    // pelo buildVisualCards em UM card da Pagina B.
    //
    // A imagem abaixo representa a familia.
    // Na Pagina C os SKUs continuam separados.
    //
    // Produtos sem card fisico permanecem sem imagem
    // ate recuperarmos/produzirmos a foto correta.
    // ======================================================

    "cosmeticos-shampoo-uso-diario":
      ["uso-diario"],

    "cosmeticos-shampoo-cabelos-claros":
      ["claros"],

    "cosmeticos-shampoo-cabelos-cacheados":
      ["cacheados"],

    "cosmeticos-shampoo-cabelos-danificados":
      ["danificados"],

    "cosmeticos-shampoo-cabelos-normais":
      ["normais"],

    "cosmeticos-shampoo-cabelos-oleosos":
      ["oleosos"],

    "cosmeticos-shampoo-cabelos-tingidos":
      ["tingidos"],

    /*
     * Cards Murumuru existentes fisicamente.
     * Mantemos exatamente os nomes encontrados na pasta.
     */

    "cosmeticos-shampoo-masculino-cabelos-normais":
      ["shampoo-murumuru-normais"],

    "cosmeticos-shampoo-masculino-cabelos-oleosos":
      ["shampoo-murumuru-oleosos"],

    "cosmeticos-shampoo-masculino-cabelos-secos":
      ["shampoo-murumuru-secos"],

    "cosmeticos-condicionador-condicionador-premium":
      ["condicionador-murumuru"],

    "cosmeticos-creme-corpo-ansiedade":
      ["creme-corpo-ansiedade"],

    "cosmeticos-creme-corpo-harmonia-interior":
      ["creme-corpo-harmonia-interior"],

    "cosmeticos-creme-corpo-hidratante":
      ["creme-corpo-hidratante"],

    "cosmeticos-creme-corpo-reequilibrio-dos-chakras":
      ["creme-corpo-reequilibrio-chackras"],

    "cosmeticos-creme-corpo-rescue-sos":
      ["creme-corpo-rescue-sos"],

    "cosmeticos-creme-maos-cha-verde-e-gengibre":
      ["creme-maos-cha-verde-gengibre"],

    "cosmeticos-creme-maos-calendula-e-camomila":
      ["creme-maos-calendula-camomila"],

    "cosmeticos-creme-maos-flores-do-campo":
      ["creme-maos-flores-campo"],

    "cosmeticos-sabonete-liquido-alegria":
      ["sabonete-alegria"],

    "cosmeticos-sabonete-liquido-ansiedade":
      ["sabonete-ansiedade"],

    "cosmeticos-sabonete-liquido-energizante":
      ["sabonete-energizante"],

    "cosmeticos-sabonete-liquido-hidratante":
      ["sabonete-hidratante"],

    "cosmeticos-sabonete-liquido-harmonia-interior":
      ["sabonete-harmonia-interior"],

    "cosmeticos-sabonete-liquido-reequilibrio-dos-chakras":
      ["sabonete-reequilibrio-chackras"],

    "cosmeticos-sabonete-liquido-refrescante":
      ["sabonete-refrescante"],

    "cosmeticos-sabonete-liquido-relaxante":
      ["sabonete-relaxante"],

    "cosmeticos-sabonete-liquido-rescue-sos":
      ["sabonete-rescue-sos"],


    // ======================================================
    // HOME CARE | PAGINA B
    // ======================================================
    //
    // 14 produtos individuais.
    // 14 cards fisicos confirmados.
    // ======================================================

    "home-care-aromatizador-spray-bem-estar":
      ["aromatizador-bem-estar"],

    "home-care-aromatizador-spray-harmonia":
      ["aromatizador-harmonia"],

    "home-care-aromatizador-spray-limpeza-e-protecao":
      ["aromatizador-limpeza-protecao"],

    "home-care-aromatizador-spray-reequilibrio-do-ambiente":
      ["aromatizador-reequilibrio-ambiente"],

    "home-care-aromatizador-spray-serenidade":
      ["aromatizador-serenidade"],

    "home-care-sabonete-liquido-alegria":
      ["sabonete-alegria"],

    "home-care-sabonete-liquido-ansiedade":
      ["sabonete-ansiedade"],

    "home-care-sabonete-liquido-energizante":
      ["sabonete-energizante"],

    "home-care-sabonete-liquido-hidratante":
      ["sabonete-hidratante"],

    "home-care-sabonete-liquido-harmonia-interior":
      ["sabonete-harmonia-interior"],

    "home-care-sabonete-liquido-reequilibrio-dos-chakras":
      ["sabonete-reequilibrio-chackras"],

    "home-care-sabonete-liquido-refrescante":
      ["sabonete-refrescante"],

    "home-care-sabonete-liquido-relaxante":
      ["sabonete-relaxante"],

    "home-care-sabonete-liquido-rescue-sos":
      ["sabonete-rescue"],

    // ======================================================
    // COSMETICOS HUMANOS | COMPLEMENTO
    // ======================================================

    /*
     * Shampoo + Condicionador Cabelos Secos:
     * um card na Pagina B.
     */
    "cosmeticos-shampoo-cabelos-secos":
      ["secos"],

    /*
     * Shampoo Murumuru Grisalhos:
     * card fisico adicionado posteriormente.
     */
    "cosmeticos-shampoo-masculino-cabelos-grisalhos-premium":
      ["shampoo-murumuru-grisalhos"],


    // ======================================================
    // COSMETICOS PET | PAGINA B
    // ======================================================
    //
    // Shampoo + Condicionador de mesma versao:
    // UM card na Pagina B.
    //
    // Os SKUs permanecem separados na Pagina C.
    // ======================================================

    "cosmeticos-pet-shampoo-adestramento":
      ["shampoo-cond-adestramento"],

    "cosmeticos-pet-shampoo-agressividade":
      ["shampo-cond-agressividade"],

    "cosmeticos-pet-shampoo-ansiedade-pelos-claros":
      ["shampoo-cond-ansiedade-claros"],

    "cosmeticos-pet-shampoo-ansiedade-pelos-escuros":
      ["shampoo-condp-ansiedade-escuro"],

    "cosmeticos-pet-shampoo-filhotes":
      ["shampoo-cond-filhotes"],

    "cosmeticos-pet-shampoo-lambedura":
      ["shampoo-cond-lambedura"],

    "cosmeticos-pet-shampoo-rescue-sos":
      ["shampoo-cond-rescue-sos"],

    "cosmeticos-pet-shampoo-tristeza-e-depressao":
      ["shampoo-cond-tristeza-depressao"],


    // ------------------------------------------------------
    // PERFUMES
    // ------------------------------------------------------

    /*
     * Nao existe atualmente card fisico de Perfume
     * Agressividade. Portanto ele permanece textual.
     */

    "cosmeticos-pet-perfume-spray-ansiedade":
      ["perfume-ansiedade"],

    "cosmeticos-pet-perfume-spray-filhotes":
      ["perfume-filhotes"],

    "cosmeticos-pet-perfume-spray-rescue-sos":
      ["perfume-rescue"],

    "cosmeticos-pet-perfume-spray-tristeza-e-depressao":
      ["perfume-tristeza-depressao"],


    // ------------------------------------------------------
    // FLORAIS DE AMBIENTE
    // ------------------------------------------------------

    "cosmeticos-pet-floral-de-ambiente-adestramento":
      ["floral-ambiente-adestramento"],

    "cosmeticos-pet-floral-de-ambiente-agressividade":
      ["floral-ambiente-agressividade"],

    "cosmeticos-pet-floral-de-ambiente-ansiedade":
      ["floral-ambiente-ansiedade"],

    "cosmeticos-pet-floral-de-ambiente-filhotes":
      ["floral-ambiente-filhotes"],

    "cosmeticos-pet-floral-de-ambiente-rescue-sos":
      ["floral-ambiente-rescue-sos"],

    /*
     * O arquivo fisico possui "=" no nome.
     * normalizeCardFileName transforma a pontuacao
     * durante a comparacao.
     */
    "cosmeticos-pet-floral-de-ambiente-tristeza-e-depressao":
      ["floral-ambiente-tristeza-depressao"],


    // ------------------------------------------------------
    // OUTROS COSMETICOS PET
    // ------------------------------------------------------

    "cosmeticos-pet-spray-spray-desembaracante":
      ["spray-desembaracante"],

    "cosmeticos-pet-finalizador-silicone-finalizador":
      ["silicone-finalizador"],

    "cosmeticos-pet-higiene-oral-spray-para-halito-menta":
      ["spray-halito-menta"],

    // Perfume Spray Agressividade
    "cosmeticos-pet-perfume-spray-agressividade":
      ["perfume-agressividade"],

    // ======================================================
    // VIRTUDES
    // ======================================================

    /*
     * Virtudes normalmente funciona automaticamente ap?s
     * remover o prefixo da slug.
     *
     * Os aliases podem permanecer vazios aqui porque:
     *
     * virtudes-divinas-virtudes-divinas-amor
     * -> amor
     *
     * etc.
     */
  };

  /*
   * ========================================================
   * TRANSFORMAR SLUG DO CATALOGO NO NOME PROVAVEL DO PNG
   * ========================================================
   */

  const strippedSlug = productSlug

    // Florais Adulto / Pet / Infantil / Baby / Kids / Teen
    .replace(
      /^adulto-floral-em-gotas-/,
      ""
    )
    .replace(
      /^pet-floral-em-gotas-/,
      ""
    )
    .replace(
      /^infantil-floral-em-gotas-/,
      ""
    )
    .replace(
      /^baby-floral-em-gotas-/,
      ""
    )
    .replace(
      /^kids-floral-em-gotas-/,
      ""
    )
    .replace(
      /^teen-floral-em-gotas-/,
      ""
    )

    // Cosmeticos Humanos
    .replace(
      /^cosmeticos-/,
      ""
    )

    // Home Care
    .replace(
      /^home-care-/,
      ""
    )
    // Dose Unica
    .replace(
      /^dose-unica-floral-dose-unica-/,
      ""
    )

    // Virtudes Divinas
    .replace(
      /^virtudes-divinas-virtudes-divinas-/,
      ""
    );

  const candidates = [
    ...(explicitAliases[productSlug] ?? []),
    strippedSlug,
    productSlug,
  ].map(normalizeCardFileName);

  /*
   * Remove candidatos repetidos.
   */
  const uniqueCandidates =
    [...new Set(candidates)];

  for (
    const candidate of uniqueCandidates
  ) {

    const found = files.find(
      (file) => {

        const withoutExtension =
          file.name.replace(
            /\.[^.]+$/,
            ""
          );

        return (
          normalizeCardFileName(
            withoutExtension
          ) === candidate
        );
      }
    );

    if (found) {

      return `/cardprodutos/${folder}/${found.name}`;
    }
  }

  return "";
}
function getMarketingCardImages(
  lineSlug: string
) {
  const foldersByLine: Record<string, string> = {
    adulto: "floraladulto",
    pet: "floralpet",
    infantil: "floralinfantil",
    baby: "baby",
    kids: "kids",
    teen: "teen",
    "dose-unica": "dose-unica",
    "virtudes-divinas": "virtudes-divinas",
    cosmeticos: "cosmeticos",
    "cosmeticos-pet": "cosmeticos-pet",
    "home-care": "home-care",
  };

  const folder =
    foldersByLine[lineSlug] ??
    lineSlug;

  const directory = path.join(
    process.cwd(),
    "public",
    "cardprodutos",
    folder
  );

  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = fs
    .readdirSync(directory, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(png|jpg|jpeg|webp|avif)$/i.test(
          entry.name
        )
    )
    .map((entry) => entry.name);

  return ["mkt1", "mkt2"]
    .map((base) =>
      files.find((file) =>
        new RegExp(
          `^${base}\\.(png|jpg|jpeg|webp|avif)$`,
          "i"
        ).test(file)
      )
    )
    .filter(
      (file): file is string =>
        Boolean(file)
    )
    .map(
      (file) =>
        `/cardprodutos/${folder}/${file}`
    );
}

function getCommercialOrder(
  lineSlug: string
): readonly string[] | null {
  if (lineSlug === "adulto") {
    return bioCommercialOrder.adulto.slugs;
  }

  if (lineSlug === "pet") {
    return bioCommercialOrder.pet.slugs;
  }

  return null;
}
function isHairPairCategory(
  category: string
) {
  const normalized =
    category
      .trim()
      .toLowerCase();

  return (
    normalized ===
      "shampoo" ||
    normalized ===
      "condicionador"
  );
}

function buildVisualCards(
  products: BioProduct[]
) {
  const cards: VisualCard[] =
    [];

  const consumed =
    new Set<string>();

  for (
    const product of products
  ) {
    if (
      consumed.has(
        product.slug
      )
    ) {
      continue;
    }

    if (
      isHairPairCategory(
        product.category
      )
    ) {
      const pair =
        products.filter(
          (candidate) =>
            candidate.lineSlug ===
              product.lineSlug &&
            candidate.name ===
              product.name &&
            isHairPairCategory(
              candidate.category
            )
        );

      if (
        pair.length >= 2
      ) {
        const shampoo =
          pair.find(
            (item) =>
              item.category
                .toLowerCase() ===
              "shampoo"
          ) ??
          pair[0];

        for (
          const item of pair
        ) {
          consumed.add(
            item.slug
          );
        }

        cards.push({
          key:
            `pair-${product.lineSlug}-${product.name}`,

          title:
            product.name,

          eyebrow:
            "Shampoo + Condicionador",

          subtitle:
            "Conheça as opções individuais e o combo da versão.",

          href:
            `/produto/${shampoo.slug}`,

          image:
            shampoo.image,

          product:
            shampoo,

          isPair:
            true,
        });

        continue;
      }
    }

    consumed.add(
      product.slug
    );

    cards.push({
      key:
        product.slug,

      title:
        product.name,

      eyebrow:
        product.category,

      subtitle:
        product.content
          ? product.content
          : "Conheça este produto Bio Florais.",

      href:
        `/produto/${product.slug}`,

      image:
        product.image,

      product,

      isPair:
        false,
    });
  }

  return cards;
}

const marketingCards = [
  {
    eyebrow:
      "Bio Florais",

    title:
      "Equilíbrio para diferentes momentos.",

    text:
      "Conheça outros produtos e combinações dentro deste universo.",
  },

  {
    eyebrow:
      "Desde 1997",

    title:
      "Uma história de cuidado que continua.",

    text:
      "Bio Florais acompanha diferentes fases, rotinas e momentos.",
  },
];

export default async function LinePage({
  params,
}: {
  params:
    Promise<{
      slug: string;
    }>;
}) {
  const {
    slug,
  } =
    await params;

  const line =
    getLine(slug);

  if (!line) {
    notFound();
  }

  const allLineProducts =
    getProductsByLine(
      slug
    );

  /*
   * ========================================================
   * PAGINA B PET
   * ========================================================
   *
   * Ordem comercial:
   *
   * 1-12  = Florais em Gotas
   * 13-18 = Snacks Florais
   * 19+   = demais Florais em Gotas
   *
   * Os Snacks permanecem dentro da linha PET.
   */

  const products =
    slug === "pet"
      ? (() => {

          const petOrder =
            getCommercialOrder("pet") ?? [];

          const petRank =
            new Map(
              petOrder.map(
                (productSlug, index) => [
                  productSlug,
                  index,
                ]
              )
            );

          const drops =
            allLineProducts
              .filter(
                (product) =>
                  product.category !==
                  "Snack Floral"
              )
              .sort(
                (a, b) =>
                  (
                    petRank.get(a.slug) ??
                    Number.MAX_SAFE_INTEGER
                  ) -
                  (
                    petRank.get(b.slug) ??
                    Number.MAX_SAFE_INTEGER
                  )
              );

          const snacks =
            allLineProducts.filter(
              (product) =>
                product.category ===
                "Snack Floral"
            );

          return [
            ...drops.slice(
              0,
              12
            ),

            ...snacks,

            ...drops.slice(
              12
            ),
          ];
        })()
      : allLineProducts;

  const commercialOrder =
    getCommercialOrder(slug);
  const commercialRank =
    commercialOrder
      ? new Map(
          commercialOrder.map(
            (productSlug, index) => [
              productSlug,
              index,
            ]
          )
        )
      : null;

  const orderMap =
    commercialOrder
      ? new Map(
          commercialOrder.map(
            (productSlug, index) => [
              productSlug,
              index,
            ]
          )
        )
      : null;

  const orderedProducts =
    orderMap && slug !== "pet"
      ? [...products].sort(
          (a, b) =>
            (
              orderMap.get(a.slug) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              orderMap.get(b.slug) ??
              Number.MAX_SAFE_INTEGER
            )
        )
      : products;

  const cards =
    buildVisualCards(
      orderedProducts
    ).map(
      (card) => ({
        ...card,

        // PAGINA B:
        // imagem dedicada do card.
        // Nao usa a galeria do produto.
        image:
          getCardProductImage(
            card.product.lineSlug,
            card.product.slug
          ),
      })
    );

  const isPriorityLine =
    slug === "adulto" ||
    slug === "pet";

  const visual =
    lineVisuals[slug];

  const marketingImages =
    getMarketingCardImages(slug);

  const occupiedGridColumns =
    cards.reduce(
      (total, _card, index) =>
        total +
        (
          isPriorityLine &&
          index < 6
            ? 3
            : 2
        ),
      0
    );

  const missingGridColumns =
    (
      6 -
      (
        occupiedGridColumns %
        6
      )
    ) %
    6;

  const marketingSlotsNeeded =
    Math.ceil(
      missingGridColumns / 2
    );

  const marketingCount =
    Math.min(
      marketingSlotsNeeded,
      marketingImages.length
    );

  const marketingPosition1 =
    marketingSlotsNeeded === 1
      ? Math.max(
          1,
          Math.round(
            cards.length / 2
          )
        )
      : Math.max(
          1,
          Math.round(
            cards.length / 3
          )
        );

  const marketingPosition2 =
    Math.max(
      marketingPosition1 + 1,
      Math.round(
        cards.length * 2 / 3
      )
    );

  return (
    <main
      className="
        min-h-screen
        overflow-x-hidden
        bg-[#fffdf9]
        text-[#2f2231]
      "
    >

      {/* HEADER */}
      <header
        className="
          sticky
          top-0
          z-50
          border-b
          border-[#eadfd9]/80
          bg-[#fffdf9]/95
          backdrop-blur-xl
        "
      >
        <div
          className="
            mx-auto
            flex
            h-[72px]
            max-w-[1440px]
            items-center
            justify-between
            px-5
            lg:px-10
          "
        >
          <Link
            href="/"
          >
            <p
              className="
                font-serif
                text-[24px]
                font-semibold
                tracking-[-0.03em]
                text-[#55245f]
              "
            >
              Bio Florais
            </p>

            <p
              className="
                mt-[-2px]
                text-[8px]
                font-extrabold
                uppercase
                tracking-[0.25em]
                text-[#b17d22]
              "
            >
              Desde 1997
            </p>
          </Link>

          <Link
            href="/#linhas"
            className="
              rounded-full
              border
              border-[#63326d]/20
              bg-white
              px-5
              py-2.5
              text-xs
              font-extrabold
              text-[#63326d]
              transition
              hover:bg-[#63326d]
              hover:text-white
            "
          >
            Todas as linhas
          </Link>
        </div>
      </header>


      {/* HERO DA LINHA */}
      <section
        className="
          overflow-hidden
          border-b
          border-[#eadfd9]
          bg-[#faf5ef]
          px-5
          py-8
          lg:px-10
          lg:py-10
        "
      >
        <div
          className="
            mx-auto
            grid
            max-w-[1440px]
            gap-8
            lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]
            lg:items-center
          "
        >

          <div
            className="
              min-w-0
              py-3
              lg:py-6
            "
          >
            <div
              className="
                mb-6
                flex
                flex-wrap
                items-center
                gap-2
                text-[11px]
                font-bold
                text-[#8d7b89]
              "
            >
              <Link
                href="/"
                className="
                  transition
                  hover:text-[#63326d]
                "
              >
                Início
              </Link>

              <span>
                /
              </span>

              <Link
                href="/#linhas"
                className="
                  transition
                  hover:text-[#63326d]
                "
              >
                Linhas
              </Link>

              <span>
                /
              </span>

              <span
                className="
                  text-[#63326d]
                "
              >
                {
                  line.name
                }
              </span>
            </div>

            <p
              className="
                text-[11px]
                font-extrabold
                uppercase
                tracking-[0.20em]
                leading-5
                text-[#a0742b]
              "
            >
              {
                visual?.eyebrow ??
                "Universo Bio Florais"
              }
            </p>

            <h1
              className="
                mt-3
                max-w-[650px]
                font-serif
                text-5xl
                font-semibold
                leading-[0.98]
                tracking-[-0.045em]
                text-[#422347]
                sm:text-6xl
                lg:text-[68px]
              "
            >
              {
                line.name
              }
            </h1>

            <p
              className="
                mt-5
                max-w-[590px]
                text-base
                leading-7
                text-[#675866]
                sm:text-lg
              "
            >
              {
                visual?.description ??
                "Conheça os produtos, versões e cuidados desta linha."
              }
            </p>

            <div
              className="
                mt-7
                flex
                flex-wrap
                gap-3
              "
            >
              <div
                className="
                  rounded-full
                  bg-white
                  px-4
                  py-2
                  text-xs
                  font-extrabold
                  text-[#63326d]
                  shadow-sm
                "
              >
                {
                  cards.length
                } opções
              </div>

              <div
                className="
                  rounded-full
                  border
                  border-[#dbcbd9]
                  px-4
                  py-2
                  text-xs
                  font-bold
                  text-[#806c7d]
                "
              >
                Bio Florais · Desde 1997
              </div>
            </div>
          </div>

          {visual && (
            <div
              className="
                min-w-0
                overflow-hidden
                rounded-[30px]
                shadow-[0_18px_45px_rgba(61,35,65,0.10)]
              "
            >
              <Image
                src={visual.image}
                alt={`Linha Bio Florais ${line.name}`}
                width={1600}
                height={900}
                priority
                sizes="
                  (max-width: 1024px)
                  100vw,
                  55vw
                "
                className="
                  h-auto
                  w-full
                  rounded-[30px]
                "
              />
            </div>
          )}
        </div>
      </section>


      {/* PRODUTOS */}
      <section
        className="
          mx-auto
          max-w-[1440px]
          px-5
          py-12
          lg:px-10
          lg:py-16
        "
      >

        <div
          className="
            mb-8
          "
        >
          <p
            className="
              text-[11px]
              font-extrabold
              uppercase
              tracking-[0.22em]
              text-[#a0742b]
            "
          >
            Explore a linha
          </p>

          <h2
            className="
              mt-2
              font-serif
              text-4xl
              font-semibold
              tracking-[-0.03em]
              text-[#422347]
            "
          >
            {visual.headline}
          </h2>
        </div>


        <div
          className="
            grid
            gap-6
            lg:grid-cols-6
          "
        >
          {cards.map(
            (card, index) => {
              const hasImage =
                imageExists(
                  card.image
                );

              return (
                <Link
                  key={
                    card.key
                  }
                  href={
                    card.href
                  }
                  style={{
                    order:
                      index +
                      (
                        marketingCount >= 1 &&
                        index >= marketingPosition1
                          ? 1
                          : 0
                      ) +
                      (
                        marketingCount === 2 &&
                        index >= marketingPosition2
                          ? 1
                          : 0
                      ),
                  }}
                  className={`
                    group
                    relative
                    block
                    aspect-video
                    ${
                      isPriorityLine &&
                      index < 6
                        ? "lg:col-span-3"
                        : "lg:col-span-2"
                    }
                    overflow-hidden
                    rounded-[26px]
                    border
                    border-[#eadfd9]
                    bg-[#f7efe9]
                    shadow-sm
                    transition
                    duration-300
                    hover:-translate-y-1
                    hover:shadow-xl
                  `}
                >
                  {hasImage ? (
                    <Image
                      src={
                        card.image
                      }
                      alt={
                        card.title
                      }
                      fill
                      sizes="
                        (max-width: 1024px)
                        100vw,
                        33vw
                      "
                      className="
                        object-cover
                        transition
                        duration-500
                        group-hover:scale-[1.025]
                      "
                    />
                  ) : (
                    <div
                      className="
                        absolute
                        inset-0
                        bg-gradient-to-br
                        from-[#f8eee8]
                        via-[#fffaf6]
                        to-[#eee1ef]
                      "
                    />
                  )}

                  <div
                    className="
                      absolute
                      inset-0
                      bg-gradient-to-t
                      from-black/70
                      via-black/5
                      to-transparent
                    "
                  />

                  {!hasImage && (
                    <div
                      className="
                        absolute
                        inset-0
                        flex
                        items-center
                        justify-center
                      "
                    >
                      <span
                        className="
                          text-xs
                          font-bold
                          text-[#a08c9e]
                        "
                      >
                        Foto em preparação
                      </span>
                    </div>
                  )}


                </Link>
              );
            }
          )}


          {Array.from({
            length:
              marketingCount,
          }).map(
            (
              _,
              index
            ) => {
              const marketingImage =
                marketingImages[index];

              const card =
                marketingCards[
                  index %
                    marketingCards.length
                ];

              return (
                <div
                  key={
                    `marketing-${index}`
                  }
                  style={{
                    order:
                      index === 0
                        ? marketingPosition1
                        : marketingPosition2,
                  }}
                  className="
                    relative
                    aspect-video
                    lg:col-span-2
                    overflow-hidden
                    rounded-[26px]
                    bg-[#4c2854]
                    text-white
                  "
                >
                  {marketingImage ? (
                    <Image
                      src={marketingImage}
                      alt={`Destaque ${line.name}`}
                      fill
                      sizes="
                        (max-width: 1024px)
                        100vw,
                        33vw
                      "
                      className="
                        object-cover
                      "
                    />
                  ) : (
                    <div
                      className="
                        relative
                        flex
                        h-full
                        flex-col
                        justify-end
                        p-7
                      "
                    >
                      <p
                        className="
                          text-[10px]
                          font-extrabold
                          uppercase
                          tracking-[0.2em]
                          text-[#e4be73]
                        "
                      >
                        {
                          card.eyebrow
                        }
                      </p>

                      <h3
                        className="
                          mt-3
                          font-serif
                          text-3xl
                          font-semibold
                          leading-[1.03]
                        "
                      >
                        {
                          card.title
                        }
                      </h3>

                      <p
                        className="
                          mt-3
                          text-sm
                          leading-5
                          text-white/75
                        "
                      >
                        {
                          card.text
                        }
                      </p>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </section>
    </main>
  );
}















