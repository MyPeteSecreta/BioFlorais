/**
 * ADMIN B2B — Clientes do site (B2C): compradores agrupados por e-mail a partir dos pedidos. SÓ LEITURA (?q= busca por
 * e-mail, nome ou cidade). Não há exportação.
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin/session";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { searchSiteClients } from "@/lib/b2b/site-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }

  try {
    const clients = await searchSiteClients(getAppSqlRunner(), request.nextUrl.searchParams.get("q") ?? "");

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("[admin/b2b/site-clients GET]", error);

    return NextResponse.json({ error: "Não foi possível buscar os clientes do site." }, { status: 500 });
  }
}
