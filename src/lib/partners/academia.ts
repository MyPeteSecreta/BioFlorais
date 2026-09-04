import { createPartnerProgramClient } from "@angelblancdigital/partners";

export type ValidatedPartnerCoupon = {
  code: string;
  partnerId: string | null;
  discountPercent: number;
  commissionPercent: number | null;
  campaign: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

const BIO_PARTNER_BRAND = "bio-florais" as const;

function getPartnerClient() {
  const baseUrl =
    process.env.ACADEMIA_PARTNER_API_URL?.trim();

  const apiKey =
    process.env.PARTNER_API_KEY?.trim();

  if (!baseUrl) {
    throw new Error(
      "ACADEMIA_PARTNER_API_URL nao configurada."
    );
  }

  if (!apiKey) {
    throw new Error(
      "PARTNER_API_KEY nao configurada."
    );
  }

  return createPartnerProgramClient({
    baseUrl,
    apiKey,
  });
}

export async function validatePartnerCoupon(
  couponCode: string,
  subtotalCents: number
): Promise<ValidatedPartnerCoupon | null> {
  const code =
    couponCode.trim().toUpperCase();

  if (!code) {
    return null;
  }

  if (
    !Number.isInteger(subtotalCents) ||
    subtotalCents <= 0
  ) {
    throw new Error(
      "Subtotal invalido para validar cupom de parceira."
    );
  }

  const client = getPartnerClient();

  const data = await client.validateCoupon({
    brand: BIO_PARTNER_BRAND,
    couponCode: code,
    subtotal: subtotalCents / 100,
  });

  if (!data.valid) {
    return null;
  }

  const discountPercent =
    Number(data.discountPercent);

  if (
    !Number.isFinite(discountPercent) ||
    discountPercent <= 0 ||
    discountPercent > 100
  ) {
    throw new Error(
      "Desconto invalido retornado pela Academia."
    );
  }

  return {
    code:
      data.couponCode?.trim().toUpperCase() ||
      code,

    partnerId:
      data.partnerId ?? null,

    discountPercent,

    commissionPercent:
      typeof data.commissionPercent === "number"
        ? data.commissionPercent
        : null,

    campaign:
      data.campaign ?? null,

    startsAt:
      data.startsAt ?? null,

    expiresAt:
      data.expiresAt ?? null,
  };
}


