/**
 * BIO FLORAIS B2B — convites de responsável (RCA / Vendedor).
 *
 * - Token opaco de 256 bits; só o SHA-256 vai para o banco.
 * - Validade de 7 dias. O token bruto só existe na resposta que o gerou.
 * - "Gerar novo link" revoga os convites pendentes anteriores do mesmo
 *   destino (mesmo e-mail no cadastro; mesmo responsável na redefinição).
 * - Sem provedor de e-mail: o link é mostrado ao admin com "Copiar" e
 *   "Enviar pelo WhatsApp" (wa.me com o texto pronto).
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibleInvites } from "@/lib/db/schema";
import { generateOpaqueToken, hashToken } from "@/lib/b2b/token";
import { getSiteUrl } from "@/lib/seo/site-url";
import type { B2BResponsibleType, InvitePurpose } from "@/lib/b2b/invite-links";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export {
  B2B_RESPONSIBLE_TYPES,
  buildInviteMessage,
  buildWhatsAppUrl,
  isB2BResponsibleType,
  isValidEmail,
  normalizeEmail,
  type B2BResponsibleType,
  type InvitePurpose,
} from "@/lib/b2b/invite-links";

export function buildInviteUrl(token: string) {
  return `${getSiteUrl()}/b2b/convite/${token}`;
}

/**
 * Cria um convite novo e revoga os pendentes do mesmo destino.
 * Devolve o token bruto (mostrar uma única vez).
 */
export async function createResponsibleInvite(input: {
  name: string;
  email: string;
  responsibleType: B2BResponsibleType | string;
  purpose: InvitePurpose;
  responsibleId?: string | null;
}) {
  const now = new Date();

  await db
    .update(b2bResponsibleInvites)
    .set({ status: "revoked", revokedAt: now })
    .where(
      and(
        eq(b2bResponsibleInvites.status, "pending"),
        input.purpose === "password_reset" && input.responsibleId
          ? eq(b2bResponsibleInvites.responsibleId, input.responsibleId)
          : eq(b2bResponsibleInvites.email, input.email),
        eq(b2bResponsibleInvites.purpose, input.purpose)
      )
    );

  const token = generateOpaqueToken();

  const [invite] = await db
    .insert(b2bResponsibleInvites)
    .values({
      name: input.name,
      email: input.email,
      responsibleType: input.responsibleType,
      tokenHash: hashToken(token),
      status: "pending",
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      sentAt: now,
      purpose: input.purpose,
      responsibleId: input.responsibleId ?? null,
    })
    .returning({ id: b2bResponsibleInvites.id, expiresAt: b2bResponsibleInvites.expiresAt });

  return { inviteId: invite.id, expiresAt: invite.expiresAt, token };
}

export type InviteLookup =
  | {
      ok: true;
      invite: typeof b2bResponsibleInvites.$inferSelect;
    }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "used" };

export async function loadInviteByToken(rawToken: string): Promise<InviteLookup> {
  const token = String(rawToken ?? "").trim();

  if (!token) {
    return { ok: false, reason: "invalid" };
  }

  const [invite] = await db
    .select()
    .from(b2bResponsibleInvites)
    .where(eq(b2bResponsibleInvites.tokenHash, hashToken(token)))
    .limit(1);

  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.status === "revoked" || invite.revokedAt) return { ok: false, reason: "revoked" };
  if (invite.status !== "pending" || invite.acceptedAt) return { ok: false, reason: "used" };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, invite };
}
