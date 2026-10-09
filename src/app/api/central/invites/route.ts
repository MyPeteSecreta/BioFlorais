import { NextRequest, NextResponse } from "next/server";

import { createResponsibleInvite, buildInviteUrl } from "@/lib/b2b/invites";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { createBrandInvite } from "@/lib/central/brand-api";
import { centralAuthError } from "@/lib/central/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Central → Bio: cria o convite de vendedor/RCA (contrato em src/lib/central/contract.ts). */
export async function POST(request: NextRequest) {
  const denied = centralAuthError(request);

  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const result = await createBrandInvite(
      getAppSqlRunner(),
      async (input) => {
        const invite = await createResponsibleInvite({ ...input, purpose: "onboarding" });

        return { inviteId: invite.inviteId, url: buildInviteUrl(invite.token), expiresAt: invite.expiresAt };
      },
      body
    );

    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "INVALID" ? 400 : 409 });
  } catch (error) {
    console.error("[central/invites]", error);
    return NextResponse.json({ ok: false, error: "Erro ao gerar o convite." }, { status: 500 });
  }
}
