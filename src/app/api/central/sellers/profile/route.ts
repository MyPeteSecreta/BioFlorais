import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { applyReplicatedProfile, lookupSellerProfile } from "@/lib/central/brand-api";
import { centralAuthError } from "@/lib/central/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Central → Bio (V4): consulta o cadastro completo do vendedor pelo e-mail. */
export async function GET(request: NextRequest) {
  const denied = centralAuthError(request);

  if (denied) return denied;

  try {
    return NextResponse.json(await lookupSellerProfile(getAppSqlRunner(), request.nextUrl.searchParams.get("email") ?? ""));
  } catch (error) {
    console.error("[central/sellers/profile GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao consultar o cadastro." }, { status: 500 });
  }
}

/* Central → Bio (V4): replica o cadastro completo para o vendedor (mesmo e-mail) que ainda não completou. */
export async function POST(request: NextRequest) {
  const denied = centralAuthError(request);

  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await applyReplicatedProfile(getAppSqlRunner(), body);

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[central/sellers/profile POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao aplicar o cadastro." }, { status: 500 });
  }
}
