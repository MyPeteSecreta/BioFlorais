/**
 * /api/b2b/promo-links — links com promoção do vendedor LOGADO (SQL 52b). O vendedor vem SEMPRE da sessão.
 *   GET    lista os links ativos do vendedor (com situação e o endereço completo);
 *   POST   cria (nome, promoção ou kit display, validade do link, elegibilidade do cliente);
 *   DELETE ?id= apaga (revoga) o link.
 * Só promoção ATIVA do admin; demonstração não tem link geral.
 */

import { NextRequest, NextResponse } from "next/server";

import { loadDemoState } from "@/lib/b2b/demo";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { ensureReferralCode } from "@/lib/b2b/partners";
import { createPromoLink, listPromoLinks, promoLinkPath, promoLinkStatus, revokePromoLink } from "@/lib/b2b/promo-links";
import { B2B_SESSION_COOKIE, readB2BResponsibleSession } from "@/lib/b2b/responsible-session";
import { getSiteUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

async function sellerFromSession(request: NextRequest) {
  const session = readB2BResponsibleSession(request.cookies.get(B2B_SESSION_COOKIE)?.value);

  if (!session) return { error: NextResponse.json({ error: "Entre na sua conta." }, { status: 401, headers: NO_STORE }) } as const;

  const run = getAppSqlRunner();
  const [row] = await run(`SELECT id, name FROM b2b_responsibles WHERE id = $1::uuid AND status = 'active'`, [session.responsibleId]);

  if (!row) return { error: NextResponse.json({ error: "Vendedor não encontrado." }, { status: 403, headers: NO_STORE }) } as const;

  const demo = await loadDemoState(run, session.responsibleId);

  if (demo.isDemo) return { error: NextResponse.json({ error: "Na demonstração não há link geral." }, { status: 403, headers: NO_STORE }) } as const;

  const code = await ensureReferralCode(run, session.responsibleId);

  if (!code) return { error: NextResponse.json({ error: "Não foi possível gerar o seu link pessoal agora." }, { status: 503, headers: NO_STORE }) } as const;

  return { run, seller: { id: String(row.id), name: String(row.name), referralCode: code } } as const;
}

const present = (link: Awaited<ReturnType<typeof listPromoLinks>>[number], sellerCode: string) => ({
  id: link.id,
  name: link.name,
  kind: link.kind,
  promotionName: link.promotionName,
  displayKey: link.displayKey,
  expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
  status: promoLinkStatus(link),
  url: `${getSiteUrl()}${promoLinkPath(sellerCode, link.code)}`,
});

export async function GET(request: NextRequest) {
  const found = await sellerFromSession(request);

  if ("error" in found) return found.error;

  const links = await listPromoLinks(found.run, found.seller.id);

  return NextResponse.json({ links: links.map((link) => present(link, found.seller.referralCode)) }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const found = await sellerFromSession(request);

  if ("error" in found) return found.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: NO_STORE });

  try {
    const result = await createPromoLink(found.run, found.seller, {
      name: body.name,
      kind: body.kind,
      promotionId: body.promotionId,
      displayKey: body.displayKey,
      eligibilityMode: body.eligibilityMode,
      eligibilityValue: body.eligibilityValue,
      validityDays: body.validityDays,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });

    return NextResponse.json({ link: present(result.link, found.seller.referralCode) }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("[b2b/promo-links] criar", error);
    return NextResponse.json({ error: "Não foi possível criar o link agora." }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest) {
  const found = await sellerFromSession(request);

  if ("error" in found) return found.error;

  const id = request.nextUrl.searchParams.get("id") ?? "";
  const ok = await revokePromoLink(found.run, found.seller.id, id);

  return ok ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : NextResponse.json({ error: "Link não encontrado." }, { status: 404, headers: NO_STORE });
}
