export type BioQuizUniverse =
  | "adulto"
  | "criancas"
  | "baby"
  | "teen"
  | "pet"
  | "dose-unica"
  | "virtudes";

export type BioQuizContext = {
  age?: number;
  isPuppy?: boolean;
  redirectedFrom?: BioQuizUniverse;
};

export type BioQuizResult = {
  principal: string | null;
  associated: string[];
  structuralDose: string | null;
};

export type BioQuizCandidate = {
  slug: string;
  score: number;
  evidenceCount: number;
};

export type BioQuizState = {
  universe: BioQuizUniverse | null;
  scores: Record<string, number>;
  evidence: Record<string, string[]>;
  gates: Record<string, boolean>;
  explicitPrimary: string | null;
  context: BioQuizContext;
};

export function createBioQuizState(): BioQuizState {
  return {
    universe: null,
    scores: {},
    evidence: {},
    gates: {},
    explicitPrimary: null,
    context: {},
  };
}

export function setUniverse(
  state: BioQuizState,
  universe: BioQuizUniverse,
): BioQuizState {
  return {
    ...state,
    universe,
  };
}

export function setContext(
  state: BioQuizState,
  context: Partial<BioQuizContext>,
): BioQuizState {
  return {
    ...state,
    context: {
      ...state.context,
      ...context,
    },
  };
}

export function addEvidence(
  state: BioQuizState,
  productSlug: string,
  points: number,
  evidenceId: string,
): BioQuizState {
  const currentEvidence = state.evidence[productSlug] ?? [];
  const alreadyExists = currentEvidence.includes(evidenceId);

  return {
    ...state,
    scores: {
      ...state.scores,
      [productSlug]:
        (state.scores[productSlug] ?? 0) + (alreadyExists ? 0 : points),
    },
    evidence: {
      ...state.evidence,
      [productSlug]: alreadyExists
        ? currentEvidence
        : [...currentEvidence, evidenceId],
    },
  };
}

export function openGate(
  state: BioQuizState,
  gateId: string,
): BioQuizState {
  return {
    ...state,
    gates: {
      ...state.gates,
      [gateId]: true,
    },
  };
}

export function hasGate(
  state: BioQuizState,
  gateId: string,
): boolean {
  return state.gates[gateId] === true;
}

export function setExplicitPrimary(
  state: BioQuizState,
  productSlug: string | null,
): BioQuizState {
  return {
    ...state,
    explicitPrimary: productSlug,
  };
}

export function evidenceCount(
  state: BioQuizState,
  productSlug: string,
): number {
  return state.evidence[productSlug]?.length ?? 0;
}

export function scoreFor(
  state: BioQuizState,
  productSlug: string,
): number {
  return state.scores[productSlug] ?? 0;
}


export function rankCandidates(
  state: BioQuizState,
  eligibleSlugs: readonly string[],
): BioQuizCandidate[] {
  return eligibleSlugs
    .map((slug) => ({
      slug,
      score: scoreFor(state, slug),
      evidenceCount: evidenceCount(state, slug),
    }))
    .filter(
      (candidate) =>
        candidate.score > 0 &&
        candidate.evidenceCount > 0,
    )
    .sort((a, b) => {
      if (b.evidenceCount !== a.evidenceCount) {
        return b.evidenceCount - a.evidenceCount;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.slug.localeCompare(b.slug);
    });
}

export function selectPrincipal(
  state: BioQuizState,
  candidates: readonly BioQuizCandidate[],
): string | null {
  if (
    state.explicitPrimary &&
    candidates.some(
      (candidate) => candidate.slug === state.explicitPrimary,
    )
  ) {
    return state.explicitPrimary;
  }

  return candidates[0]?.slug ?? null;
}


export type BioProductGateMap = Record<
  string,
  readonly string[]
>;

export function hasRequiredGates(
  state: BioQuizState,
  productSlug: string,
  productGates: BioProductGateMap,
): boolean {
  const requiredGates = productGates[productSlug] ?? [];

  return requiredGates.every(
    (gateId) => hasGate(state, gateId),
  );
}

export function eligibleCandidates(
  state: BioQuizState,
  eligibleSlugs: readonly string[],
  productGates: BioProductGateMap = {},
): BioQuizCandidate[] {
  const gatedSlugs = eligibleSlugs.filter(
    (slug) =>
      hasRequiredGates(state, slug, productGates),
  );

  return rankCandidates(state, gatedSlugs);
}
