import {
  addEvidence,
  openGate,
  setContext,
  setExplicitPrimary,
  setUniverse,
  type BioQuizState,
  type BioQuizUniverse,
} from "./bio-florais";

import {
  ADULT_PRODUCTS,
  BABY_PRODUCTS,
  CHILDREN_PRODUCTS,
  DOSE_PRODUCTS,
  PET_PRODUCTS,
  TEEN_PRODUCTS,
  VIRTUE_PRODUCTS,
} from "./bio-florais-products";

export type BioQuizFlowResult =
  | {
      type: "question";
      questionId: string;
      state: BioQuizState;
    }
  | {
      type: "result";
      state: BioQuizState;
    }
  | {
      type: "neutral";
      state: BioQuizState;
    };

function primary(
  state: BioQuizState,
  slug: string,
  evidenceId: string,
): BioQuizState {
  let next = addEvidence(state, slug, 10, evidenceId);
  next = setExplicitPrimary(next, slug);
  return next;
}

function result(
  state: BioQuizState,
  slug: string,
  evidenceId: string,
): BioQuizFlowResult {
  return {
    type: "result",
    state: primary(state, slug, evidenceId),
  };
}

function question(
  state: BioQuizState,
  questionId: string,
): BioQuizFlowResult {
  return {
    type: "question",
    questionId,
    state,
  };
}

export function beginBioQuizUniverse(
  state: BioQuizState,
  universe: BioQuizUniverse,
): BioQuizFlowResult {
  const next = setUniverse(state, universe);

  const entry: Record<BioQuizUniverse, string> = {
    adulto: "adult-main",
    criancas: "children-age",
    baby: "baby-main",
    teen: "teen-main",
    pet: "pet-puppy",
    "dose-unica": "dose-main",
    virtudes: "virtues-family",
  };

  return question(next, entry[universe]);
}

export function applyBioQuizAge(
  state: BioQuizState,
  age: number,
): BioQuizFlowResult {
  let next = setContext(state, { age });

  if (state.universe !== "criancas") {
    return question(next, "children-main");
  }

  if (age <= 3) {
    return question(next, "children-age-baby-confirm");
  }

  if (age >= 10 && age <= 15) {
    return question(next, "children-age-teen-confirm");
  }

  if (age > 15) {
    return question(next, "children-age-adult-confirm");
  }

  return question(next, "children-main");
}

export function applyBioQuizAnswer(
  state: BioQuizState,
  questionId: string,
  optionId: string,
): BioQuizFlowResult {
  let next = state;

  switch (questionId) {
    case "pet-puppy":
      next = setContext(next, {
        isPuppy: optionId === "yes",
      });
      return question(next, "pet-main");

    case "children-age-baby-confirm":
      if (optionId === "redirect") {
        next = setUniverse(next, "baby");
        next = setContext(next, { redirectedFrom: "criancas" });
        return question(next, "baby-main");
      }
      return question(next, "children-main");

    case "children-age-teen-confirm":
      if (optionId === "redirect") {
        next = setUniverse(next, "teen");
        next = setContext(next, { redirectedFrom: "criancas" });
        return question(next, "teen-main");
      }
      return question(next, "children-main");

    case "children-age-adult-confirm":
      if (optionId === "redirect") {
        next = setUniverse(next, "adulto");
        next = setContext(next, { redirectedFrom: "criancas" });
        return question(next, "adult-main");
      }
      return question(next, "children-main");

    // ADULTO
    case "adult-main":
      switch (optionId) {
        case "fear":
          return question(next, "adult-fear");
        case "sadness":
          return question(next, "adult-sadness");
        case "self-esteem":
          return question(next, "adult-self-esteem");
        case "study":
          return question(next, "adult-study");
        case "tolerance":
          return question(next, "adult-tolerance");
        case "rescue":
          return result(next, ADULT_PRODUCTS.rescue, "adult-rescue");
        case "life-phase":
          return question(next, "adult-life-phase");
        case "habit":
          return question(next, "adult-habit");
        case "identity":
          return question(next, "adult-identity");
        case "other-goal":
          return question(next, "adult-other-goal");
        case "weight":
          return result(next, ADULT_PRODUCTS.reducaoPeso, "adult-weight");
      }
      break;

    case "adult-fear": {
      const map: Record<string, string> = {
        sleep: ADULT_PRODUCTS.sono,
        panic: ADULT_PRODUCTS.panico,
        "social-panic": ADULT_PRODUCTS.panicoSocial,
        stress: ADULT_PRODUCTS.stress,
        anxiety: ADULT_PRODUCTS.ansiedade,
        fear: ADULT_PRODUCTS.medo,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "adult-fear-" + optionId);
      }
      break;
    }

    case "adult-sadness": {
      const map: Record<string, string> = {
        sadness: ADULT_PRODUCTS.tristeza,
        discouragement: ADULT_PRODUCTS.desanimo,
        joy: ADULT_PRODUCTS.alegria,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "adult-sadness-" + optionId);
      }
      break;
    }

    case "adult-self-esteem":
      if (optionId === "insecurity") {
        return result(next, ADULT_PRODUCTS.inseguranca, "adult-insecurity");
      }
      if (optionId === "self-esteem") {
        return result(next, ADULT_PRODUCTS.autoestima, "adult-self-esteem");
      }
      break;

    case "adult-study":
      if (optionId === "student") {
        return result(next, ADULT_PRODUCTS.estudante, "adult-student");
      }
      if (optionId === "memory") {
        return result(next, ADULT_PRODUCTS.memoria, "adult-memory");
      }
      break;

    case "adult-tolerance":
      if (optionId === "tolerance") {
        return result(next, ADULT_PRODUCTS.tolerancia, "adult-tolerance");
      }
      if (optionId === "perfectionism") {
        return result(next, ADULT_PRODUCTS.perfeccionismo, "adult-perfectionism");
      }
      break;

    case "adult-life-phase": {
      const map: Record<string, string> = {
        menopause: ADULT_PRODUCTS.menopausa,
        senior: ADULT_PRODUCTS.melhorIdade,
        tpm: ADULT_PRODUCTS.tpm,
        pregnancy: ADULT_PRODUCTS.gestacao,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "adult-phase-" + optionId);
      }
      break;
    }

    case "adult-habit":
      if (optionId === "addictions") {
        return result(next, ADULT_PRODUCTS.vicios, "adult-addictions");
      }
      if (optionId === "smoking") {
        return result(next, ADULT_PRODUCTS.pararFumar, "adult-smoking");
      }
      break;

    case "adult-identity":
      if (optionId === "sexual") {
        next = openGate(next, "adult-partner-sexual");
        return result(next, ADULT_PRODUCTS.parceiroSexual, "adult-sexual");
      }
      if (optionId === "pride") {
        return result(next, ADULT_PRODUCTS.pride, "adult-pride");
      }
      if (optionId === "leadership") {
        return result(next, ADULT_PRODUCTS.lideranca, "adult-leadership");
      }
      break;

    case "adult-other-goal": {
      const map: Record<string, string> = {
        financial: ADULT_PRODUCTS.sucessoFinanceiro,
        arts: ADULT_PRODUCTS.artes,
        chakras: ADULT_PRODUCTS.chakras,
        changes: ADULT_PRODUCTS.mudancasVida,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "adult-goal-" + optionId);
      }
      break;
    }

    // PET
    case "pet-main":
      switch (optionId) {
        case "emotion":
          return question(next, "pet-emotion");
        case "physical-behavior":
          return question(next, "pet-physical-behavior");
        case "fear":
          return question(next, "pet-fear");
        case "home":
          return question(next, "pet-home");
        case "discipline":
          return question(next, "pet-discipline");
        case "aggression":
          return question(next, "pet-aggression");
        case "barking":
          return result(next, PET_PRODUCTS.latido, "pet-barking");
        case "specific":
          return question(next, "pet-specific");
      }
      break;

    case "pet-emotion": {
      const map: Record<string, string> = {
        stress: PET_PRODUCTS.stress,
        hyperactivity: PET_PRODUCTS.hiperatividade,
        sadness: PET_PRODUCTS.tristeza,
        anxiety: PET_PRODUCTS.ansiedade,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "pet-emotion-" + optionId);
      }
      break;
    }

    case "pet-physical-behavior": {
      const map: Record<string, string> = {
        licking: PET_PRODUCTS.lambedura,
        coprophagia: PET_PRODUCTS.coprofagia,
        food: PET_PRODUCTS.reequilibrioAlimentar,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "pet-physical-" + optionId);
      }
      break;
    }

    case "pet-fear":
      if (optionId === "fireworks") {
        return result(next, PET_PRODUCTS.medoFogos, "pet-fireworks");
      }
      if (optionId === "general") {
        return result(next, PET_PRODUCTS.medo, "pet-fear");
      }
      break;

    case "pet-home":
      if (optionId === "neediness") {
        return result(next, PET_PRODUCTS.carencia, "pet-neediness");
      }

      if (optionId === "new-home") {
        next = primary(next, PET_PRODUCTS.novoLar, "pet-new-home");

        if (next.context.isPuppy) {
          next = addEvidence(
            next,
            PET_PRODUCTS.filhotes,
            5,
            "pet-puppy-new-home",
          );
        }

        return { type: "result", state: next };
      }

      if (optionId === "baby-arrived") {
        return result(next, PET_PRODUCTS.bebeChegou, "pet-baby-arrived");
      }
      break;

    case "pet-discipline":
      if (optionId === "marking") {
        return result(next, PET_PRODUCTS.marcacao, "pet-marking");
      }

      if (optionId === "indiscipline") {
        return result(next, PET_PRODUCTS.indisciplina, "pet-indiscipline");
      }

      if (optionId === "training") {
        if (next.context.isPuppy) {
          next = addEvidence(
            next,
            PET_PRODUCTS.adestramento,
            8,
            "pet-training",
          );
          next = addEvidence(
            next,
            PET_PRODUCTS.filhotes,
            10,
            "pet-puppy-training",
          );
          next = setExplicitPrimary(next, PET_PRODUCTS.filhotes);

          return { type: "result", state: next };
        }

        return result(next, PET_PRODUCTS.adestramento, "pet-training");
      }
      break;

    case "pet-aggression": {
      const map: Record<string, string> = {
        children: PET_PRODUCTS.aversaoCriancas,
        "new-animal": PET_PRODUCTS.novoAnimal,
        general: PET_PRODUCTS.agressividade,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "pet-aggression-" + optionId);
      }
      break;
    }

    case "pet-specific": {
      const map: Record<string, string> = {
        travel: PET_PRODUCTS.viagens,
        heat: PET_PRODUCTS.cio,
        "false-pregnancy": PET_PRODUCTS.gravidezPsicologica,
        bath: PET_PRODUCTS.aversaoBanho,
        sos: PET_PRODUCTS.sos,
      };
      if (map[optionId]) {
        return result(next, map[optionId], "pet-specific-" + optionId);
      }
      break;
    }

    // CRIANCAS
    case "children-main":
      switch (optionId) {
        case "anxiety": {
          const age = next.context.age ?? 0;
          const slug =
            age >= 3 && age <= 9
              ? CHILDREN_PRODUCTS.kidsAnsiedade
              : CHILDREN_PRODUCTS.infantilAnsiedade;

          return result(next, slug, "children-anxiety");
        }

        case "obedience": {
          const age = next.context.age ?? 0;
          const slug =
            age >= 3 && age <= 9
              ? CHILDREN_PRODUCTS.kidsTeimosia
              : CHILDREN_PRODUCTS.infantilDesobediencia;

          return result(next, slug, "children-obedience");
        }

        case "fears": {
          const age = next.context.age ?? 0;

          if (age >= 3 && age <= 9) {
            return question(next, "children-fears");
          }

          return result(
            next,
            CHILDREN_PRODUCTS.infantilMedosPesadelos,
            "children-fears-combined",
          );
        }

        case "rescue": {
          const age = next.context.age ?? 0;
          const slug =
            age >= 3 && age <= 9
              ? CHILDREN_PRODUCTS.kidsRescue
              : CHILDREN_PRODUCTS.infantilRescue;

          return result(next, slug, "children-rescue");
        }

        case "development":
          return question(next, "children-development");

        case "school-social":
          return question(next, "children-school-social");

        case "separation":
          return question(next, "children-separation");

        case "phase":
          return result(next, CHILDREN_PRODUCTS.faseInfancia, "children-phase");

        case "neutral":
          return {
            type: "neutral",
            state: next,
          };
      }
      break;

    case "children-fears":
      if (optionId === "day") {
        return result(next, CHILDREN_PRODUCTS.kidsMedos, "children-fear-day");
      }

      if (optionId === "night") {
        return result(next, CHILDREN_PRODUCTS.kidsPesadelos, "children-fear-night");
      }

      if (optionId === "both") {
        next = primary(next, CHILDREN_PRODUCTS.kidsMedos, "children-fear-both-day");
        next = addEvidence(
          next,
          CHILDREN_PRODUCTS.kidsPesadelos,
          8,
          "children-fear-both-night",
        );
        return { type: "result", state: next };
      }
      break;

    case "children-development": {
      const map: Record<string, string> = {
        school: CHILDREN_PRODUCTS.infantilAdaptacaoEscolar,
        hyperactivity: CHILDREN_PRODUCTS.infantilHiperatividade,
        crying: CHILDREN_PRODUCTS.infantilChoroExcessivo,
        "diaper-pacifier": CHILDREN_PRODUCTS.infantilFraldaChupeta,
        sleep: CHILDREN_PRODUCTS.infantilSono,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "children-development-" + optionId);
      }
      break;
    }

    case "children-school-social": {
      const map: Record<string, string> = {
        concentration: CHILDREN_PRODUCTS.kidsConcentracao,
        social: CHILDREN_PRODUCTS.kidsSociabilidade,
        food: CHILDREN_PRODUCTS.kidsReequilibrioAlimentar,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "children-school-" + optionId);
      }
      break;
    }

    case "children-separation":
      if (optionId === "separation") {
        return result(next, CHILDREN_PRODUCTS.kidsSeparacao, "children-separation");
      }

      if (optionId === "neediness") {
        return result(next, CHILDREN_PRODUCTS.kidsCarencia, "children-neediness");
      }
      break;

    // TEEN
    case "teen-main":
      switch (optionId) {
        case "emotion":
          return question(next, "teen-emotion");

        case "study":
          return question(next, "teen-study");

        case "aggression":
          return result(next, TEEN_PRODUCTS.agressividade, "teen-aggression");

        case "relationships":
          return result(next, TEEN_PRODUCTS.relacionamentos, "teen-relationships");

        case "food":
          next = openGate(next, "teen-food-control");
          return result(next, TEEN_PRODUCTS.controleAlimentar, "teen-food");

        case "rescue":
          return result(next, TEEN_PRODUCTS.rescue, "teen-rescue");

        case "sexuality":
          return result(next, TEEN_PRODUCTS.faseAdolescencia, "teen-sexuality");

        case "phase":
          return result(next, TEEN_PRODUCTS.faseAdolescencia, "teen-phase");
      }
      break;

    case "teen-emotion": {
      const map: Record<string, string> = {
        "emotional-control": TEEN_PRODUCTS.controleEmocional,
        "my-place": TEEN_PRODUCTS.meuLugarNoMundo,
        stubbornness: TEEN_PRODUCTS.teimosia,
        changes: TEEN_PRODUCTS.mudancas,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "teen-emotion-" + optionId);
      }
      break;
    }

    case "teen-study":
      if (optionId === "concentration") {
        return result(next, TEEN_PRODUCTS.concentracao, "teen-concentration");
      }

      if (optionId === "organization") {
        return result(next, TEEN_PRODUCTS.organizacao, "teen-organization");
      }
      break;

    // BABY
    case "baby-main":
      switch (optionId) {
        case "emotion":
          return question(next, "baby-emotion");
        case "development":
          return question(next, "baby-development");
        case "routine":
          return question(next, "baby-routine");
        case "pregnancy":
          return result(next, BABY_PRODUCTS.gravidezConturbada, "baby-pregnancy");
        case "rescue":
          return result(next, BABY_PRODUCTS.rescue, "baby-rescue");
      }
      break;

    case "baby-emotion": {
      const map: Record<string, string> = {
        crying: BABY_PRODUCTS.choroExcessivo,
        sleep: BABY_PRODUCTS.sono,
        nervous: BABY_PRODUCTS.bebeNervoso,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "baby-emotion-" + optionId);
      }
      break;
    }

    case "baby-development": {
      const map: Record<string, string> = {
        pacifier: BABY_PRODUCTS.tirandoChupeta,
        diaper: BABY_PRODUCTS.tirandoFralda,
        speech: BABY_PRODUCTS.falaNene,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "baby-development-" + optionId);
      }
      break;
    }

    case "baby-routine": {
      const map: Record<string, string> = {
        "mother-work": BABY_PRODUCTS.mamaeVoltaTrabalho,
        social: BABY_PRODUCTS.sociabilidade,
        vaccine: BABY_PRODUCTS.posVacina,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "baby-routine-" + optionId);
      }
      break;
    }

    // DOSE UNICA
    case "dose-main": {
      const map: Record<string, string> = {
        anxiety: DOSE_PRODUCTS.ansiedade,
        stress: DOSE_PRODUCTS.stress,
        sleep: DOSE_PRODUCTS.sono,
        rescue: DOSE_PRODUCTS.rescue,
        sadness: DOSE_PRODUCTS.depressao,
        weight: DOSE_PRODUCTS.perdaPeso,
      };

      if (map[optionId]) {
        return result(next, map[optionId], "dose-" + optionId);
      }
      break;
    }

    // VIRTUDES
    case "virtues-family": {
      const routes: Record<string, string> = {
        relations: "virtues-relations-split",
        strength: "virtues-strength",
        balance: "virtues-balance",
        clarity: "virtues-clarity",
        authenticity: "virtues-authenticity",
        transformation: "virtues-transformation",
        discipline: "virtues-discipline",
        love: "virtues-love",
      };

      if (routes[optionId]) {
        return question(next, routes[optionId]);
      }
      break;
    }

    case "virtues-relations-split":
      if (optionId === "other") {
        return question(next, "virtues-relations-other");
      }

      if (optionId === "position") {
        return question(next, "virtues-relations-position");
      }
      break;

    case "virtues-relations-other":
    case "virtues-relations-position":
    case "virtues-strength":
    case "virtues-balance":
    case "virtues-clarity":
    case "virtues-authenticity":
    case "virtues-transformation":
    case "virtues-discipline":
    case "virtues-love": {
      const virtueMap: Record<string, string> = {
        compreensao: VIRTUE_PRODUCTS.compreensao,
        gentileza: VIRTUE_PRODUCTS.gentileza,
        docura: VIRTUE_PRODUCTS.docura,
        respeito: VIRTUE_PRODUCTS.respeito,
        justica: VIRTUE_PRODUCTS.justica,
        lealdade: VIRTUE_PRODUCTS.lealdade,
        tolerancia: VIRTUE_PRODUCTS.tolerancia,
        coragem: VIRTUE_PRODUCTS.coragem,
        autoconfianca: VIRTUE_PRODUCTS.autoconfianca,
        contentamento: VIRTUE_PRODUCTS.contentamento,
        estabilidade: VIRTUE_PRODUCTS.estabilidade,
        paciencia: VIRTUE_PRODUCTS.paciencia,
        serenidade: VIRTUE_PRODUCTS.serenidade,
        leveza: VIRTUE_PRODUCTS.leveza,
        prudencia: VIRTUE_PRODUCTS.prudencia,
        sabedoria: VIRTUE_PRODUCTS.sabedoria,
        discernimento: VIRTUE_PRODUCTS.discernimento,
        honestidade: VIRTUE_PRODUCTS.honestidade,
        humildade: VIRTUE_PRODUCTS.humildade,
        espontaneidade: VIRTUE_PRODUCTS.espontaneidade,
        simplicidade: VIRTUE_PRODUCTS.simplicidade,
        verdade: VIRTUE_PRODUCTS.verdade,
        pureza: VIRTUE_PRODUCTS.pureza,
        limpeza: VIRTUE_PRODUCTS.limpeza,
        desapego: VIRTUE_PRODUCTS.desapego,
        perdao: VIRTUE_PRODUCTS.perdao,
        flexibilidade: VIRTUE_PRODUCTS.flexibilidade,
        dedicacao: VIRTUE_PRODUCTS.dedicacao,
        responsabilidade: VIRTUE_PRODUCTS.responsabilidade,
        disciplina: VIRTUE_PRODUCTS.disciplina,
        determinacao: VIRTUE_PRODUCTS.determinacao,
        generosidade: VIRTUE_PRODUCTS.generosidade,
        gratidao: VIRTUE_PRODUCTS.gratidao,
        amor: VIRTUE_PRODUCTS.amor,
        benevolencia: VIRTUE_PRODUCTS.benevolencia,
        compaixao: VIRTUE_PRODUCTS.compaixao,
      };

      if (virtueMap[optionId]) {
        return result(
          next,
          virtueMap[optionId],
          "virtue-" + optionId,
        );
      }
      break;
    }
  }

  throw new Error(
    "Bio Quiz: rota nao encontrada para " +
      questionId +
      " / " +
      optionId,
  );
}
