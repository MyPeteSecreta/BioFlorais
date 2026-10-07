/**
 * ADMIN B2B — "Trocar a cada N segundos" das mensagens ao lojista, separado
 * para a faixa do topo e para o botão flutuante (padrão 60 s). Guardado em b2b_settings.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { loadRotation } from "@/lib/b2b/retailer-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const valid = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 5 && Number(value) <= 3600;

export async function PUT(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { bannerSeconds?: unknown; buttonSeconds?: unknown };

    if (!valid(body.bannerSeconds) || !valid(body.buttonSeconds)) {
      return NextResponse.json({ error: "Informe segundos inteiros entre 5 e 3600." }, { status: 400 });
    }

    const run = getAppSqlRunner();

    for (const [key, value] of [
      ["retailer_banner_seconds", body.bannerSeconds],
      ["retailer_button_seconds", body.buttonSeconds],
    ] as const) {
      await run(
        `INSERT INTO b2b_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, String(Number(value))]
      );
    }

    return NextResponse.json({ ok: true, rotation: await loadRotation(run) });
  } catch (error) {
    console.error("[admin/b2b/messages/settings PUT]", error);
    return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
  }
}
