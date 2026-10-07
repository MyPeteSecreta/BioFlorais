/**
 * ADMIN B2B — gerar convite de cadastro (RCA / Vendedor).
 * O token só aparece nesta resposta; o banco guarda o hash.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import {
  buildInviteMessage,
  buildInviteUrl,
  buildWhatsAppUrl,
  createResponsibleInvite,
  isB2BResponsibleType,
  isValidEmail,
  normalizeEmail,
} from "@/lib/b2b/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      type?: string;
      whatsapp?: string;
    };

    const name = String(body.name ?? "").trim();
    const email = normalizeEmail(body.email);

    if (!name) {
      return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    if (!isB2BResponsibleType(body.type)) {
      return NextResponse.json({ error: "Escolha o tipo: RCA ou Vendedor." }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: b2bResponsibles.id })
      .from(b2bResponsibles)
      .where(sql`lower(${b2bResponsibles.email}) = ${email}`)
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          error:
            "Já existe um vendedor com este e-mail. Use \"Redefinir acesso\" na lista.",
        },
        { status: 409 }
      );
    }

    const invite = await createResponsibleInvite({
      name,
      email,
      responsibleType: body.type,
      purpose: "onboarding",
    });

    const url = buildInviteUrl(invite.token);

    return NextResponse.json({
      ok: true,
      inviteId: invite.inviteId,
      expiresAt: invite.expiresAt,
      url,
      whatsappUrl: buildWhatsAppUrl(
        body.whatsapp,
        buildInviteMessage({ name, url, purpose: "onboarding" })
      ),
    });
  } catch (error) {
    console.error("[admin/b2b/invites POST]", error);
    return NextResponse.json({ error: "Erro ao gerar convite." }, { status: 500 });
  }
}
