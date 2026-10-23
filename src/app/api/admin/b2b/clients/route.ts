/**
 * ADMIN B2B — Clientes: busca por nome/razão social, contato, e-mail, cidade, CNPJ/CPF ou WhatsApp (?q=).
 * Só leitura. A edição é em /api/admin/b2b/clients/[id].
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { searchClients } from "@/lib/b2b/client-admin";
import { getAppSqlRunner } from "@/lib/b2b/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const clients = await searchClients(getAppSqlRunner(), request.nextUrl.searchParams.get("q") ?? "", 40, {
      includeTests: request.nextUrl.searchParams.get("tests") === "1",
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("[admin/b2b/clients GET]", error);

    return NextResponse.json({ error: "Não foi possível buscar os clientes." }, { status: 500 });
  }
}
