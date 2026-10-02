/**
 * BIO FLORAIS B2B — gerar o link público de uma oferta já ATIVA.
 * Revoga o link anterior da mesma oferta; o token bruto só existe na
 * resposta (o banco guarda o SHA-256).
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bOfferLinks } from "@/lib/db/schema";
import { buildWhatsAppUrl } from "@/lib/b2b/invite-links";
import { decryptOfferToken, encryptOfferToken, generateOpaqueToken, hashToken } from "@/lib/b2b/token";
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

  const base = { offerId: input.offerId, tokenHash: hashToken(token), expiresAt: null };
  const ciphertext = encryptOfferToken(token);

  try {
    await db.insert(b2bOfferLinks).values({ ...base, tokenCiphertext: ciphertext });
  } catch (error) {
    // SQL 11b ainda não aplicado (coluna ausente): grava sem a cópia cifrada.
    console.error("[b2b/offer-link] sem token_ciphertext, gravando sem cópia", error);
    await db.insert(b2bOfferLinks).values(base);
  }

  return buildLinkPayload(token, input);
}

type LinkContact = { clientName: string; clientPhone: string | null; responsibleName: string };

function buildLinkPayload(token: string, input: LinkContact) {
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

/**
 * Link ATIVO da oferta para copiar/reenviar (o mesmo que o cliente já tem).
 * null = link criado antes do SQL 11b (sem cópia): gerar novo link.
 */
export async function readActiveOfferLink(offerId: string, input: LinkContact) {
  try {
    const [row] = await db
      .select({ tokenCiphertext: b2bOfferLinks.tokenCiphertext })
      .from(b2bOfferLinks)
      .where(and(eq(b2bOfferLinks.offerId, offerId), isNull(b2bOfferLinks.revokedAt)))
      .limit(1);

    const token = decryptOfferToken(row?.tokenCiphertext);
    return token ? buildLinkPayload(token, input) : null;
  } catch (error) {
    console.error("[b2b/offer-link] leitura do link", error);
    return null;
  }
}
