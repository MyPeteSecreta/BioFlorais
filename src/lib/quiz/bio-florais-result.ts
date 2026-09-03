import {
  eligibleCandidates,
  selectPrincipal,
  type BioQuizResult,
  type BioQuizState,
} from "./bio-florais";

import {
  ADULT_PRODUCT_GATES,
  ADULT_PRODUCT_SLUGS,
  ADULT_PRODUCTS,
  BABY_PRODUCT_SLUGS,
  CHILDREN_ELIGIBLE_PRODUCT_SLUGS,
  DOSE_PRODUCT_SLUGS,
  DOSE_PRODUCTS,
  PET_PRODUCT_SLUGS,
  TEEN_PRODUCT_GATES,
  TEEN_PRODUCT_SLUGS,
  VIRTUE_PRODUCT_SLUGS,
} from "./bio-florais-products";

const ADULT_DOSE_MAP: Record<string, string> = {
  [ADULT_PRODUCTS.ansiedade]: DOSE_PRODUCTS.ansiedade,
  [ADULT_PRODUCTS.stress]: DOSE_PRODUCTS.stress,
  [ADULT_PRODUCTS.sono]: DOSE_PRODUCTS.sono,
  [ADULT_PRODUCTS.rescue]: DOSE_PRODUCTS.rescue,
  [ADULT_PRODUCTS.tristeza]: DOSE_PRODUCTS.depressao,
  [ADULT_PRODUCTS.reducaoPeso]: DOSE_PRODUCTS.perdaPeso,
};

function universeSlugs(state: BioQuizState): readonly string[] {
  switch (state.universe) {
    case "adulto":
      return ADULT_PRODUCT_SLUGS;
    case "pet":
      return PET_PRODUCT_SLUGS;
    case "criancas":
      return CHILDREN_ELIGIBLE_PRODUCT_SLUGS;
    case "teen":
      return TEEN_PRODUCT_SLUGS;
    case "baby":
      return BABY_PRODUCT_SLUGS;
    case "dose-unica":
      return DOSE_PRODUCT_SLUGS;
    case "virtudes":
      return VIRTUE_PRODUCT_SLUGS;
    default:
      return [];
  }
}

function universeGates(state: BioQuizState) {
  switch (state.universe) {
    case "adulto":
      return ADULT_PRODUCT_GATES;
    case "teen":
      return TEEN_PRODUCT_GATES;
    default:
      return {};
  }
}

export function buildBioQuizResult(
  state: BioQuizState,
): BioQuizResult {
  const candidates = eligibleCandidates(
    state,
    universeSlugs(state),
    universeGates(state),
  );

  const principal = selectPrincipal(state, candidates);

  if (!principal) {
    return {
      principal: null,
      associated: [],
      structuralDose: null,
    };
  }

  const associated = candidates
    .filter((candidate) => candidate.slug !== principal)
    .filter((candidate) => candidate.evidenceCount > 0)
    .slice(0, 2)
    .map((candidate) => candidate.slug);

  const structuralDose =
    state.universe === "adulto"
      ? ADULT_DOSE_MAP[principal] ?? null
      : null;

  return {
    principal,
    associated,
    structuralDose,
  };
}
