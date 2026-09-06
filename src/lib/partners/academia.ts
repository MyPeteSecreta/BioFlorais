import {
  createPartnerProgramClient,
} from "@angelblancdigital/partners";

export type ValidatedPartnerCoupon = {
  partnerCouponId: string;
  code: string;
  partnerId: string;
  discountPercent: number;
  commissionPercent: number | null;
  campaign: {
    id: string;
    name: string;
  };
  startsAt: string | null;
  expiresAt: string | null;
};

const BIO_PARTNER_BRAND = "bio-florais" as const;

function getPartnerClient() {
  const baseUrl =
    process.env.ACADEMIA_PARTNER_API_URL?.trim();

  const clientId =
    process.env.ACADEMIA_PARTNER_CLIENT_ID?.trim();

  const clientSecret =
    process.env.ACADEMIA_PARTNER_CLIENT_SECRET?.trim();

  if (!baseUrl) {
    throw new Error(
      "ACADEMIA_PARTNER_API_URL não configurada."
    );
  }

  if (!clientId) {
    throw new Error(
      "ACADEMIA_PARTNER_CLIENT_ID não configurado."
    );
  }

  if (!clientSecret) {
    throw new Error(
      "ACADEMIA_PARTNER_CLIENT_SECRET não configurado."
    );
  }

  return createPartnerProgramClient({
    baseUrl,
    clientId,
    clientSecret,
  });
}

export async function validatePartnerCoupon(
  couponCode: string,
  subtotalCents: number
): Promise<ValidatedPartnerCoupon | null> {
  const code =
    couponCode
      .trim()
      .toUpperCase();

  if (!code) {
    return null;
  }

  const client =
    getPartnerClient();

  const data =
    await client.validateCoupon({
      brand: BIO_PARTNER_BRAND,
      couponCode: code,
      subtotalCents,
    });

  if (!data.valid) {
    return null;
  }

  return {
    partnerCouponId:
      data.partnerCouponId,

    code:
      data.couponCode,

    partnerId:
      data.partnerId,

    discountPercent:
      data.discountPercent,

    commissionPercent:
      data.commissionPercent,

    campaign: {
      id:
        data.campaign.id,

      name:
        data.campaign.name,
    },

    startsAt:
      data.startsAt,

    expiresAt:
      data.expiresAt,
  };
}

export async function sendPartnerEvent(
  event: Parameters<
    ReturnType<typeof createPartnerProgramClient>["sendEvent"]
  >[0]
) {
  const client =
    getPartnerClient();

  return client.sendEvent(event);
}
