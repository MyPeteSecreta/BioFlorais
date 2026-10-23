/**
 * BIO FLORAIS B2B — "Já sou cliente": o lojista informa e-mail ou CNPJ/CPF e, se houver cadastro, recebe o link pessoal por
 * e-mail (para o endereço CADASTRADO). Resposta SEMPRE neutra (200 com a mesma mensagem): não revela se o cadastro existe nem
 * se o limite de tentativas foi atingido. O lojista não tem senha nem login: o acesso é só o link pessoal.
 */

import { NextRequest, NextResponse } from "next/server";

import { ACCESS_NEUTRAL_MESSAGE, requestAccessLink } from "@/lib/b2b/access-link";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { readActiveOfferLink } from "@/lib/b2b/offer-link";
import { sendEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { identifier?: unknown };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;

  try {
    await requestAccessLink(
      getAppSqlRunner(),
      { identifier: body.identifier, ip },
      { readLink: (offerId, contact) => readActiveOfferLink(offerId, contact), sendEmail: (message) => sendEmail(message) }
    );
  } catch (error) {
    // Falha interna também responde neutro (sem pista para quem tenta descobrir cadastros).
    console.error("[b2b/entrar]", error);
  }

  return NextResponse.json({ ok: true, message: ACCESS_NEUTRAL_MESSAGE });
}
