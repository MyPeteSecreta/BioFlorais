/**
 * BIO FLORAIS B2B — gerar o link público de uma oferta já ATIVA.
 * Revoga o link anterior da mesma oferta; o token bruto só existe na
 * resposta (o banco guarda o SHA-256).
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bOfferLinks } from "@/lib/db/schema";
import { buildWhatsAppUrl } from "@/lib/b2b/invite-links";
import { generateOpaqueToken, hashToken } from "@/lib/b2b/token";
import { getSiteUrl } from "@/lib/seo/site-url";

export async function issueOfferLink(input: {
  offerId: string;
  clientName: string;
  clientPhone: string | null;
  responsibleName: string;
}) {
  await db
    .update(b2bOfferLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(b2bOfferLinks.offerId, input.offerId), isNull(b2bOfferLinks.revokedAt)));

  const token = generateOpaqueToken();

  await db.insert(b2bOfferLinks).values({
    offerId: input.offerId,
    tokenHash: hashToken(token),
    expiresAt: null,
  });

  const path = `/b2b/oferta/${token}`;
  const url = `${getSiteUrl()}${path}`;

  return {
    path,
    url,
    whatsappUrl: buildWhatsAppUrl(
      input.clientPhone,
      `Olá, ${input.clientName}! Aqui é ${input.responsibleName}, da Bio Florais. Sua oferta B2B está pronta: ${url}`
    ),
  };
}
