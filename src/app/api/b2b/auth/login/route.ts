/**
 * BIO FLORAIS B2B — login do responsável/RCA (login + senha).
 * Só responsáveis com status "active" entram.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/b2b/password";
import {
  B2B_SESSION_COOKIE,
  B2B_SESSION_MAX_AGE,
  createB2BResponsibleSession,
} from "@/lib/b2b/responsible-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      login?: unknown;
      password?: unknown;
    };

    const login = String(body.login ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!login || !password) {
      return NextResponse.json({ error: "Informe login e senha." }, { status: 400 });
    }

    const [responsible] = await db
      .select({
        id: b2bResponsibles.id,
        status: b2bResponsibles.status,
        passwordHash: b2bResponsibles.passwordHash,
      })
      .from(b2bResponsibles)
      .where(sql`lower(${b2bResponsibles.login}) = ${login}`)
      .limit(1);

    if (
      !responsible ||
      responsible.status !== "active" ||
      !responsible.passwordHash ||
      !verifyPassword(password, responsible.passwordHash)
    ) {
      return NextResponse.json({ error: "Login ou senha inválidos." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set(B2B_SESSION_COOKIE, createB2BResponsibleSession(responsible.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: B2B_SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[b2b/auth/login]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
