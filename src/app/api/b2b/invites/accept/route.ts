/**
 * BIO FLORAIS B2B — aceite de convite.
 *
 * purpose = "onboarding": cria o responsável com os dados do cadastro,
 *   login e senha (hash scrypt no formato já usado pela Bio) e aceite do
 *   termo RCA (obrigatório para tipo "rca"). Nasce ATIVO (decisão do
 *   Luis, 01/10): company_approved_at = agora, sem etapa de aprovação.
 *   O admin continua podendo desativar/reativar.
 * purpose = "password_reset": só define a nova senha do responsável.
 *
 * O convite é "reservado" com UPDATE condicional (status pending e não
 * expirado) antes de gravar, para dois envios simultâneos não criarem
 * dois cadastros; se a gravação falhar, a reserva é desfeita.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibleInvites, b2bResponsibles } from "@/lib/db/schema";
import { hashPassword } from "@/lib/b2b/password";
import { loadInviteByToken } from "@/lib/b2b/invites";
import {
  B2B_SESSION_COOKIE,
  B2B_SESSION_MAX_AGE,
  createB2BResponsibleSession,
} from "@/lib/b2b/responsible-session";
import { RCA_TERMS_VERSION, parseQuickSignup, trialEndsFrom } from "@/lib/b2b/vendor-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AcceptBody = {
  token?: string;
  /** "quick" (padrão): nome, WhatsApp, e-mail e senha, com 7 dias de teste. "full": cadastro completo. */
  mode?: string;
  email?: string;
  login?: string;
  password?: string;
  passwordConfirmation?: string;
  name?: string;
  phone?: string;
  personType?: string;
  cpf?: string;
  rg?: string;
  cnpj?: string;
  stateRegistration?: string;
  pixKey?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  postalCode?: string;
  street?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  rcaTermsAccepted?: boolean;
};

const LOGIN_PATTERN = /^[a-z0-9._-]{3,40}$/;
const MIN_PASSWORD_LENGTH = 8;

const INVITE_ERRORS = {
  invalid: "Este link de convite não existe.",
  expired: "Este link de convite expirou. Peça um novo ao administrador.",
  revoked: "Este link de convite foi substituído ou revogado. Peça um novo ao administrador.",
  used: "Este link de convite já foi usado.",
} as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

async function claimInvite(inviteId: string) {
  const [claimed] = await db
    .update(b2bResponsibleInvites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(
      and(
        eq(b2bResponsibleInvites.id, inviteId),
        eq(b2bResponsibleInvites.status, "pending"),
        gt(b2bResponsibleInvites.expiresAt, new Date())
      )
    )
    .returning({ id: b2bResponsibleInvites.id });

  return Boolean(claimed);
}

async function releaseInvite(inviteId: string) {
  await db
    .update(b2bResponsibleInvites)
    .set({ status: "pending", acceptedAt: null })
    .where(eq(b2bResponsibleInvites.id, inviteId));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as AcceptBody;

    const lookup = await loadInviteByToken(body.token ?? "");

    if (!lookup.ok) {
      return fail(INVITE_ERRORS[lookup.reason], 410);
    }

    const { invite } = lookup;

    const password = String(body.password ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      return fail(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    // Cadastro rápido tem um campo de senha só; a confirmação só vale se for enviada.
    const quick = invite.purpose === "onboarding" && body.mode !== "full";

    if ((!quick || body.passwordConfirmation !== undefined) && password !== String(body.passwordConfirmation ?? "")) {
      return fail("A confirmação da senha não confere.");
    }

    // ---------------------------------------------------- redefinição
    if (invite.purpose === "password_reset") {
      if (!invite.responsibleId) {
        return fail("Convite de redefinição inválido.", 410);
      }

      if (!(await claimInvite(invite.id))) {
        return fail(INVITE_ERRORS.used, 409);
      }

      const [updated] = await db
        .update(b2bResponsibles)
        .set({ passwordHash: hashPassword(password), updatedAt: new Date() })
        .where(eq(b2bResponsibles.id, invite.responsibleId))
        .returning({ login: b2bResponsibles.login, status: b2bResponsibles.status });

      if (!updated) {
        await releaseInvite(invite.id);
        return fail("Vendedor não encontrado.", 404);
      }

      return NextResponse.json({
        ok: true,
        purpose: "password_reset",
        login: updated.login,
        status: updated.status,
      });
    }

    // ---------------------------------------------------- cadastro RÁPIDO (padrão)
    if (quick) {
      const parsed = parseQuickSignup(body as Record<string, unknown>, invite.email);

      if (!parsed.ok) return fail(parsed.error);

      const email = parsed.value.email;
      const [emailTaken] = await db
        .select({ id: b2bResponsibles.id })
        .from(b2bResponsibles)
        .where(sql`lower(${b2bResponsibles.email}) = ${email} or lower(${b2bResponsibles.login}) = ${email}`)
        .limit(1);

      if (emailTaken) {
        return fail("Já existe um cadastro com este e-mail. Fale com o administrador.", 409);
      }

      if (!(await claimInvite(invite.id))) {
        return fail(INVITE_ERRORS.used, 409);
      }

      const now = new Date();
      let created: { id: string } | undefined;

      try {
        [created] = await db
          .insert(b2bResponsibles)
          .values({
            inviteId: invite.id,
            type: invite.responsibleType,
            status: "active",
            name: parsed.value.name,
            email,
            phone: parsed.value.phone,
            login: email,
            passwordHash: hashPassword(parsed.value.password),
            companyApprovedAt: now,
            // 7 dias para completar o cadastro; clientes, ofertas e links funcionam desde já.
            trialEndsAt: trialEndsFrom(now),
          })
          .returning({ id: b2bResponsibles.id });
      } catch (insertError) {
        await releaseInvite(invite.id);
        console.error("[b2b/invites/accept] insert rápido", insertError);
        return fail("Não foi possível concluir o cadastro (e-mail já em uso ou o SQL 26b não foi aplicado).", 409);
      }

      const response = NextResponse.json({
        ok: true,
        purpose: "onboarding",
        quick: true,
        login: email,
        status: "active",
        trialEndsAt: trialEndsFrom(now).toISOString(),
      });

      // Já entra no painel: sessão criada no próprio cadastro.
      response.cookies.set(B2B_SESSION_COOKIE, createB2BResponsibleSession(created.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: B2B_SESSION_MAX_AGE,
      });

      return response;
    }

    // ---------------------------------------------------- cadastro completo (mode: "full")
    const login = text(body.login).toLowerCase();
    const name = text(body.name) || invite.name;
    const phone = digits(body.phone);
    const personType = body.personType === "pj" ? "pj" : "pf";
    const cpf = digits(body.cpf);
    const rg = text(body.rg);
    const cnpj = digits(body.cnpj);
    const stateRegistration = text(body.stateRegistration);
    const postalCode = digits(body.postalCode);
    const street = text(body.street);
    const addressNumber = text(body.addressNumber);
    const neighborhood = text(body.neighborhood);
    const city = text(body.city);
    const state = text(body.state).toUpperCase();
    const pixKey = text(body.pixKey);

    if (!LOGIN_PATTERN.test(login)) {
      return fail("Login inválido: use de 3 a 40 letras minúsculas, números, ponto, hífen ou _.");
    }

    if (!name) return fail("Informe seu nome completo.");
    if (phone.length < 10) return fail("Informe um celular válido com DDD.");

    if (personType === "pf" && (cpf.length !== 11 || !rg)) {
      return fail("Informe CPF e RG válidos.");
    }

    if (personType === "pj" && (cnpj.length !== 14 || !stateRegistration)) {
      return fail("Informe CNPJ e Inscrição Estadual válidos.");
    }

    if (
      postalCode.length !== 8 ||
      !street ||
      !addressNumber ||
      !neighborhood ||
      !city ||
      !/^[A-Z]{2}$/.test(state)
    ) {
      return fail("Preencha o endereço completo.");
    }

    if (!pixKey) {
      return fail("Informe a chave Pix para recebimento das comissões.");
    }

    if (invite.responsibleType === "rca" && body.rcaTermsAccepted !== true) {
      return fail("É preciso aceitar o termo de adesão do RCA.");
    }

    const [loginTaken] = await db
      .select({ id: b2bResponsibles.id })
      .from(b2bResponsibles)
      .where(sql`lower(${b2bResponsibles.login}) = ${login}`)
      .limit(1);

    if (loginTaken) {
      return fail("Este login já está em uso. Escolha outro.", 409);
    }

    const [emailTaken] = await db
      .select({ id: b2bResponsibles.id })
      .from(b2bResponsibles)
      .where(sql`lower(${b2bResponsibles.email}) = ${invite.email.toLowerCase()}`)
      .limit(1);

    if (emailTaken) {
      return fail("Já existe um cadastro com este e-mail. Fale com o administrador.", 409);
    }

    if (!(await claimInvite(invite.id))) {
      return fail(INVITE_ERRORS.used, 409);
    }

    const now = new Date();

    try {
      await db.insert(b2bResponsibles).values({
        inviteId: invite.id,
        type: invite.responsibleType,
        status: "active",
        name,
        email: invite.email.toLowerCase(),
        phone,
        login,
        passwordHash: hashPassword(password),
        personType,
        cpf: personType === "pf" ? cpf : null,
        rg: personType === "pf" ? rg : null,
        cnpj: personType === "pj" ? cnpj : null,
        stateRegistration: personType === "pj" ? stateRegistration : null,
        pixKey,
        bankName: text(body.bankName) || null,
        bankAgency: text(body.bankAgency) || null,
        bankAccount: text(body.bankAccount) || null,
        postalCode,
        street,
        addressNumber,
        addressComplement: text(body.addressComplement) || null,
        neighborhood,
        city,
        state,
        rcaTermsAcceptedAt: invite.responsibleType === "rca" ? now : null,
        rcaTermsAcceptedIp:
          invite.responsibleType === "rca" ? (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null : null,
        rcaTermsVersion: invite.responsibleType === "rca" ? RCA_TERMS_VERSION : null,
        profileCompletedAt: now,
        onboardingCompletedAt: now,
        companyApprovedAt: now,
      });
    } catch (insertError) {
      // Ex.: login/e-mail gravado por outra requisição no meio do caminho.
      await releaseInvite(invite.id);
      console.error("[b2b/invites/accept] insert", insertError);
      return fail("Não foi possível concluir o cadastro (login ou e-mail já em uso).", 409);
    }

    return NextResponse.json({ ok: true, purpose: "onboarding", login, status: "active" });
  } catch (error) {
    console.error("[b2b/invites/accept]", error);
    return fail("Erro ao concluir o cadastro.", 500);
  }
}
