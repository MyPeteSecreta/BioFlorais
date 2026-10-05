/**
 * BIO FLORAIS B2B — cadastro COMPLETO do vendedor/RCA (CPF/CNPJ, endereço, Pix ou
 * dados bancários e aceite do Termo RCA). Funciona em qualquer situação de acesso
 * (inclusive teste vencido). Grava profile_completed_at e, no RCA, a data/hora, o IP e
 * a versão do termo. Libera as comissões retidas.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import { requireResponsibleAnyState } from "@/lib/b2b/require-responsible";
import { RCA_TERMS_VERSION, parseCompleteProfile } from "@/lib/b2b/vendor-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const responsible = await requireResponsibleAnyState(request);

  if (!responsible) {
    return NextResponse.json({ error: "Sessão B2B inválida." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseCompleteProfile(body, responsible.type);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const value = parsed.value;
    const now = new Date();
    const isRca = responsible.type === "rca";
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

    await db
      .update(b2bResponsibles)
      .set({
        personType: value.personType,
        cpf: value.cpf,
        rg: value.rg,
        cnpj: value.cnpj,
        stateRegistration: value.stateRegistration,
        postalCode: value.postalCode,
        street: value.street,
        addressNumber: value.addressNumber,
        addressComplement: value.addressComplement,
        neighborhood: value.neighborhood,
        city: value.city,
        state: value.state,
        pixKey: value.pixKey,
        bankName: value.bankName,
        bankAgency: value.bankAgency,
        bankAccount: value.bankAccount,
        ...(isRca
          ? { rcaTermsAcceptedAt: now, rcaTermsAcceptedIp: ip, rcaTermsVersion: RCA_TERMS_VERSION }
          : {}),
        profileCompletedAt: now,
        onboardingCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(b2bResponsibles.id, responsible.id));

    return NextResponse.json({ ok: true, profileCompletedAt: now.toISOString() });
  } catch (error) {
    console.error("[b2b/profile/complete]", error);
    return NextResponse.json({ error: "Não foi possível salvar o cadastro (o SQL 26b foi aplicado?)." }, { status: 500 });
  }
}
