/**
 * ADMIN B2B — ações sobre um vendedor/RCA:
 *   deactivate    desativa (perde o acesso na hora; links de oferta dele
 *                 deixam de abrir porque a oferta exige responsável ativo)
 *   reactivate    reativa (também ativa cadastros antigos que ficaram
 *                 "pending" quando ainda existia aprovação)
 *   reset_access  gera link de definição de nova senha (mesma mecânica
 *                 do convite; revoga o link de redefinição anterior)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { parseOmieVendorInput } from "@/lib/b2b/omie-vendor";
import {
  buildInviteMessage,
  buildInviteUrl,
  buildWhatsAppUrl,
  createResponsibleInvite,
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
      omieVendor?: string;
    };

    const [responsible] = await db
      .select({
        id: b2bResponsibles.id,
        name: b2bResponsibles.name,
        email: b2bResponsibles.email,
        type: b2bResponsibles.type,
        phone: b2bResponsibles.phone,
        status: b2bResponsibles.status,
        companyApprovedAt: b2bResponsibles.companyApprovedAt,
        passwordHash: b2bResponsibles.passwordHash,
      })
      .from(b2bResponsibles)
      .where(eq(b2bResponsibles.id, id))
      .limit(1);

    if (!responsible) {
      return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
    }

    const now = new Date();

    switch (body.action) {
      case "deactivate": {
        await db
          .update(b2bResponsibles)
          .set({ status: "inactive", updatedAt: now })
          .where(eq(b2bResponsibles.id, id));

        return NextResponse.json({ ok: true });
      }

      case "reactivate": {
        if (responsible.status === "active") {
          return NextResponse.json({ error: "Este vendedor já está ativo." }, { status: 409 });
        }

        if (!responsible.passwordHash) {
          return NextResponse.json(
            { error: "Este vendedor ainda não concluiu o cadastro (sem senha)." },
            { status: 409 }
          );
        }

        // Sem etapa de aprovação: reativar já deixa ativo.
        await db
          .update(b2bResponsibles)
          .set({
            status: "active",
            companyApprovedAt: responsible.companyApprovedAt ?? now,
            updatedAt: now,
          })
          .where(eq(b2bResponsibles.id, id));

        return NextResponse.json({ ok: true, status: "active" });
      }

      case "extend_trial": {
        // +7 dias a partir do que for maior: hoje ou o fim atual do teste. Cadastro completo não precisa.
        const rows = await getAppSqlRunner()(
          `UPDATE b2b_responsibles
              SET trial_ends_at = greatest((now() AT TIME ZONE 'UTC'), coalesce(trial_ends_at, (now() AT TIME ZONE 'UTC'))) + interval '7 days',
                  updated_at = now()
            WHERE id = $1 AND profile_completed_at IS NULL AND trial_ends_at IS NOT NULL
            RETURNING to_char(trial_ends_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS trial_ends_at`,
          [id]
        );

        if (rows.length === 0) {
          return NextResponse.json({ error: "Este vendedor não está em período de teste (cadastro já completo)." }, { status: 409 });
        }

        return NextResponse.json({ ok: true, trialEndsAt: rows[0].trial_ends_at });
      }

      case "set_omie_vendor": {
        const parsed = parseOmieVendorInput(body.omieVendor);

        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        try {
          await getAppSqlRunner()(
            `UPDATE b2b_responsibles SET omie_vendor_code = $2, updated_at = now() WHERE id = $1`,
            [id, parsed.value]
          );
        } catch {
          return NextResponse.json(
            { error: "Coluna do Vendedor no Omie ainda não existe (aplique o SQL 30b)." },
            { status: 409 }
          );
        }

        return NextResponse.json({ ok: true, omieVendor: parsed.value });
      }

      case "reset_access": {
        const invite = await createResponsibleInvite({
          name: responsible.name,
          email: responsible.email,
          responsibleType: responsible.type,
          purpose: "password_reset",
          responsibleId: responsible.id,
        });

        const url = buildInviteUrl(invite.token);

        return NextResponse.json({
          ok: true,
          expiresAt: invite.expiresAt,
          url,
          whatsappUrl: buildWhatsAppUrl(
            body.whatsapp || responsible.phone,
            buildInviteMessage({ name: responsible.name, url, purpose: "password_reset" })
          ),
        });
      }

      default:
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (error) {
    console.error("[admin/b2b/responsibles/:id POST]", error);
    return NextResponse.json({ error: "Erro ao atualizar vendedor." }, { status: 500 });
  }
}
