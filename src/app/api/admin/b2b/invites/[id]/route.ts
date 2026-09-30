/**
 * ADMIN B2B — ações sobre um convite pendente:
 *   { action: "revoke" }                      revoga
 *   { action: "regenerate", whatsapp? }       revoga e gera um link novo
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibleInvites } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import {
  buildInviteMessage,
  buildInviteUrl,
  buildWhatsAppUrl,
  createResponsibleInvite,
  type InvitePurpose,
} from "@/lib/b2b/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      whatsapp?: string;
    };

    const [invite] = await db
      .select()
      .from(b2bResponsibleInvites)
      .where(eq(b2bResponsibleInvites.id, id))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Este convite já foi usado ou revogado." },
        { status: 409 }
      );
    }

    if (body.action === "revoke") {
      await db
        .update(b2bResponsibleInvites)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(and(eq(b2bResponsibleInvites.id, id), eq(b2bResponsibleInvites.status, "pending")));

      return NextResponse.json({ ok: true });
    }

    if (body.action === "regenerate") {
      const purpose = (invite.purpose === "password_reset"
        ? "password_reset"
        : "onboarding") as InvitePurpose;

      const next = await createResponsibleInvite({
        name: invite.name,
        email: invite.email,
        responsibleType: invite.responsibleType,
        purpose,
        responsibleId: invite.responsibleId,
      });

      const url = buildInviteUrl(next.token);

      return NextResponse.json({
        ok: true,
        inviteId: next.inviteId,
        expiresAt: next.expiresAt,
        url,
        whatsappUrl: buildWhatsAppUrl(
          body.whatsapp,
          buildInviteMessage({ name: invite.name, url, purpose })
        ),
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/b2b/invites/:id POST]", error);
    return NextResponse.json({ error: "Erro ao atualizar convite." }, { status: 500 });
  }
}
