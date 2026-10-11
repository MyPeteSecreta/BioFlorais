/**
 * ADMIN B2B — links de campanha do modo demonstração.
 *  GET                          lista (campanha, validade, acessos, situação)
 *  POST { action: "create" }    gera o link UMA vez (só o hash fica no banco)
 *  POST { action: "revoke" }    o link deixa de abrir
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { createDemoLink, listDemoLinks, parseDemoLinkInput, revokeDemoLink } from "@/lib/b2b/demo";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { getSiteUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRED = { error: "Sua sessão expirou. Entre de novo." };
const NEEDS_SQL = "Modo demonstração indisponível (aplique o SQL 36b).";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json(EXPIRED, { status: 401 });

  try {
    return NextResponse.json({ links: await listDemoLinks(getAppSqlRunner()) });
  } catch (error) {
    console.error("[admin/b2b/demo-links GET]", error);
    return NextResponse.json({ links: [], error: NEEDS_SQL });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json(EXPIRED, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const run = getAppSqlRunner();

  try {
    if (body.action === "create") {
      const parsed = parseDemoLinkInput(body);

      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

      const created = await createDemoLink(run, {
        campaign: parsed.campaign,
        days: parsed.days,
        maxAccesses: parsed.maxAccesses,
        createdBy: "Admin",
      });
      const link = `${getSiteUrl()}/b2b/demo/${created.token}`;

      return NextResponse.json({
        ok: true,
        link,
        expiresAt: created.expiresAt.toISOString(),
        whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`Teste a plataforma comercial da Bio Florais sem cadastro: ${link}`)}`,
      });
    }

    if (body.action === "revoke") {
      const id = String(body.id ?? "");

      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Link inválido." }, { status: 400 });

      return (await revokeDemoLink(run, id))
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Link não encontrado ou já revogado." }, { status: 404 });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/b2b/demo-links POST]", error);
    return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
  }
}
