/**
 * ADMIN B2B — displays/kits (Rodada 11, mínimo): só LIGAR/DESLIGAR cada display. A composição é fixa
 * (DISPLAYS_COMPOSICAO.md; "mais vendidos" = ordem dos cards da linha no site) e os preços do mostruário
 * (Kit Provador R$ 2,00; display R$ 3,00 a cada 180 dias) são constantes por enquanto.
 *   GET   lista os displays (linha, unidades, foto, ligado)
 *   POST  { key, enabled }
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { BIO_DISPLAYS, composeKit, displayByKey, kitUnits } from "@/lib/b2b/displays";
import { displayPhotoUrl, loadDisabledDisplays, saveDisabledDisplays } from "@/lib/b2b/displays-server";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const disabled = await loadDisabledDisplays(getAppSqlRunner());

    return NextResponse.json({
      ok: true,
      displays: BIO_DISPLAYS.map((display) => {
        const kit = composeKit(display);

        return {
          key: display.key,
          code: display.code,
          name: display.name,
          lineSlug: display.lineSlug,
          skus: kit.length,
          units: kitUnits(kit),
          photo: displayPhotoUrl(display.key),
          enabled: !disabled.has(display.key),
        };
      }),
    });
  } catch (error) {
    console.error("[admin/b2b/displays GET]", error);
    return NextResponse.json({ error: "Erro ao carregar os displays." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const body = (await request.json().catch(() => ({}))) as { key?: unknown; enabled?: unknown };
    const key = String(body.key ?? "");

    if (!displayByKey(key) || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Display inválido." }, { status: 400 });
    }

    const run = getAppSqlRunner();
    const disabled = await loadDisabledDisplays(run);

    if (body.enabled) disabled.delete(key);
    else disabled.add(key);

    await saveDisabledDisplays(run, disabled);

    return NextResponse.json({ ok: true, key, enabled: body.enabled });
  } catch (error) {
    console.error("[admin/b2b/displays POST]", error);
    return NextResponse.json({ error: "Erro ao salvar (o SQL 14b foi aplicado?)." }, { status: 500 });
  }
}
