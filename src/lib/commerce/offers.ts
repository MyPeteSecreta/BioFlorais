export type BioOfferCode =
  "BIO_SHAMPOO_CONDICIONADOR_10";

export interface OfferInputLine {
  productSlug: string;
  name: string;
  category: string | null;
  qty: number;
  unitPriceCents: number;
}

export interface SelectedOfferInput {
  code: string;
  qty?: number;
  productSlugs?: string[];
}

export interface OfferBreakdown {
  code: BioOfferCode;
  label: string;
  qty: number;
  productSlugs: string[];
  regularCents: number;
  discountCents: number;
}

export interface OfferResult {
  grossSubtotalCents: number;
  offerDiscountCents: number;
  subtotalAfterOffersCents: number;
  breakdown: OfferBreakdown[];
}

function normalize(
  value: string | null | undefined
) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function positiveInteger(
  value: number | undefined
) {
  return Number.isInteger(value) &&
    Number(value) > 0
    ? Number(value)
    : 1;
}

export const bioOffers = {
  BIO_SHAMPOO_CONDICIONADOR_10: {
    code:
      "BIO_SHAMPOO_CONDICIONADOR_10" as const,

    label:
      "Combo Shampoo + Condicionador — 10% OFF",

    discountPercent: 10,

    active: true,
  },
} as const;

export function calculateSelectedOffers(
  lines: OfferInputLine[],
  selectedOffers:
    SelectedOfferInput[] = []
): OfferResult {

  const grossSubtotalCents =
    lines.reduce(
      (sum, line) =>
        sum +
        line.unitPriceCents *
          line.qty,
      0
    );

  const breakdown:
    OfferBreakdown[] = [];

  const remainingQty =
    new Map(
      lines.map(
        (line) => [
          line.productSlug,
          line.qty,
        ]
      )
    );

  for (const selected of selectedOffers) {

    if (
      selected.code !==
      "BIO_SHAMPOO_CONDICIONADOR_10"
    ) {
      continue;
    }

    const definition =
      bioOffers
        .BIO_SHAMPOO_CONDICIONADOR_10;

    if (!definition.active) {
      continue;
    }

    const selectedSlugs = [
      ...new Set(
        selected.productSlugs ?? []
      ),
    ];

    if (selectedSlugs.length !== 2) {
      continue;
    }

    const selectedLines =
      selectedSlugs
        .map(
          (slug) =>
            lines.find(
              (line) =>
                line.productSlug === slug
            )
        )
        .filter(
          (
            line
          ): line is OfferInputLine =>
            Boolean(line)
        );

    if (selectedLines.length !== 2) {
      continue;
    }

    const shampoo =
      selectedLines.find(
        (line) =>
          normalize(line.category) ===
          "shampoo"
      );

    const conditioner =
      selectedLines.find(
        (line) =>
          normalize(line.category) ===
          "condicionador"
      );

    if (!shampoo || !conditioner) {
      continue;
    }

    /*
     * Só produtos correspondentes.
     * Ex. Cabelos Normais + Cabelos Normais.
     *
     * Masculino Cabelos Normais não casa
     * com Cabelos Normais feminino.
     */
    if (
      normalize(shampoo.name) !==
      normalize(conditioner.name)
    ) {
      continue;
    }

    const availableShampoo =
      remainingQty.get(
        shampoo.productSlug
      ) ?? 0;

    const availableConditioner =
      remainingQty.get(
        conditioner.productSlug
      ) ?? 0;

    const pairQty =
      Math.min(
        positiveInteger(selected.qty),
        availableShampoo,
        availableConditioner
      );

    if (pairQty <= 0) {
      continue;
    }

    const regularPerPair =
      shampoo.unitPriceCents +
      conditioner.unitPriceCents;

    const discountPerPair =
      Math.round(
        regularPerPair *
        (
          definition.discountPercent /
          100
        )
      );

    breakdown.push({
      code:
        definition.code,

      label:
        definition.label,

      qty:
        pairQty,

      productSlugs: [
        shampoo.productSlug,
        conditioner.productSlug,
      ],

      regularCents:
        regularPerPair *
        pairQty,

      discountCents:
        discountPerPair *
        pairQty,
    });

    remainingQty.set(
      shampoo.productSlug,
      availableShampoo - pairQty
    );

    remainingQty.set(
      conditioner.productSlug,
      availableConditioner - pairQty
    );
  }

  const offerDiscountCents =
    breakdown.reduce(
      (sum, offer) =>
        sum +
        offer.discountCents,
      0
    );

  return {
    grossSubtotalCents,

    offerDiscountCents,

    subtotalAfterOffersCents:
      Math.max(
        0,
        grossSubtotalCents -
          offerDiscountCents
      ),

    breakdown,
  };
}
