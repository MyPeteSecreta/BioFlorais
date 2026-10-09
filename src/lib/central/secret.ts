import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { CENTRAL_SECRET_HEADER } from "@/lib/central/contract";

/*
 * Autenticação das rotas internas /api/central/* (server-to-server): header
 * x-central-secret igual a CENTRAL_API_SECRET. Sem a variável configurada na
 * marca, a rota fica FECHADA (503).
 */
export function verifyCentralSecret(headerValue: string | null, expected: string | undefined): "ok" | "not_configured" | "denied" {
  if (!expected) return "not_configured";
  if (!headerValue) return "denied";

  const received = Buffer.from(headerValue);
  const wanted = Buffer.from(expected);

  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted) ? "ok" : "denied";
}

/* null = autorizado; senão, a resposta de erro pronta. */
export function centralAuthError(request: Request): NextResponse | null {
  const result = verifyCentralSecret(request.headers.get(CENTRAL_SECRET_HEADER), process.env.CENTRAL_API_SECRET);

  if (result === "ok") return null;

  return NextResponse.json(
    { ok: false, error: result === "not_configured" ? "Central não configurada nesta marca." : "Não autorizado." },
    { status: result === "not_configured" ? 503 : 401 }
  );
}
