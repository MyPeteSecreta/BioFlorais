/**
 * ENTRADA DO MODO DEMONSTRAÇÃO: /b2b/demo/<token> (link de campanha gerado pelo admin; não existe rota
 * pública aberta). Cada pessoa que abre um link válido ganha o PRÓPRIO vendedor de demonstração (24 h) e
 * entra com ele. Voltando no mesmo navegador dentro das 24 h, continua no mesmo demo (cookie).
 */

import { NextRequest, NextResponse } from "next/server";

import {
  DEMO_COOKIE,
  createDemoCookie,
  createDemoSeller,
  hashIp,
  loadDemoState,
  readDemoCookie,
  registerDemoCreation,
  resolveDemoLink,
} from "@/lib/b2b/demo";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { B2B_SESSION_COOKIE, B2B_SESSION_MAX_AGE, createB2BResponsibleSession } from "@/lib/b2b/responsible-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = getAppSqlRunner();
  const secure = process.env.NODE_ENV === "production";
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  try {
    const setSession = (response: NextResponse, responsibleId: string, expiresAt: Date) => {
      response.cookies.set(B2B_SESSION_COOKIE, createB2BResponsibleSession(responsibleId), {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: B2B_SESSION_MAX_AGE,
      });
      response.cookies.set(DEMO_COOKIE, createDemoCookie(responsibleId, expiresAt), {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 24 * 60 * 60,
      });

      return response;
    };

    // Voltou no mesmo navegador dentro de 24 h: continua no mesmo demo.
    const existing = readDemoCookie(request.cookies.get(DEMO_COOKIE)?.value);

    if (existing) {
      const state = await loadDemoState(run, existing.responsibleId);

      if (state.isDemo && !state.expired && state.expiresAt) {
        return setSession(redirectTo("/b2b/painel"), existing.responsibleId, new Date(state.expiresAt));
      }
    }

    const link = await resolveDemoLink(run, token);

    if (!link.ok) return redirectTo("/b2b/demo-invalido");

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
    const allowed = await registerDemoCreation(run, hashIp(ip), link.linkId);

    if (!allowed.allowed) return redirectTo("/b2b/demo-invalido?motivo=limite");

    const seller = await createDemoSeller(run, link.linkId);

    return setSession(redirectTo("/b2b/painel"), seller.responsibleId, seller.expiresAt);
  } catch (error) {
    console.error("[b2b/demo]", error);

    return redirectTo("/b2b/demo-invalido");
  }
}
