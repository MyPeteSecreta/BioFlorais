import { NextResponse } from "next/server";

import { B2B_SESSION_COOKIE } from "@/lib/b2b/responsible-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Sair encerra a sessão neste aparelho: apaga o cookie (mesmo caminho do login), inclusive o de 30 dias.
  response.cookies.set(B2B_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
