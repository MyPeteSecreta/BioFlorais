/**
 * GET /api/b2b/materiais/<id>?versao=lojista|representante — baixa o PDF de venda do vendedor LOGADO.
 * Só com sessão válida do vendedor (cookie B2B). A versão lojista sai carimbada com o nome, o WhatsApp e o QR do link pessoal dele;
 * a representante (uso interno) sai como está. Nada é público: os PDFs-base não ficam em /public.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { B2B_SESSION_COOKIE, readB2BResponsibleSession } from "@/lib/b2b/responsible-session";
import { buildSalesMaterial } from "@/lib/b2b/sales-material-server";
import { parseAudience } from "@/lib/b2b/sales-materials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = readB2BResponsibleSession(request.cookies.get(B2B_SESSION_COOKIE)?.value);

  if (!session) return NextResponse.json({ error: "Entre na sua conta para baixar o material." }, { status: 401 });

  const { id } = await context.params;
  const audience = parseAudience(request.nextUrl.searchParams.get("versao"));

  if (!audience) return NextResponse.json({ error: "Escolha a versão: lojista ou representante." }, { status: 400 });

  try {
    const result = await buildSalesMaterial(getAppSqlRunner(), { responsibleId: session.responsibleId, materialId: id, audience });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[b2b/materiais]", error);
    return NextResponse.json({ error: "Não foi possível gerar o material agora." }, { status: 500 });
  }
}
