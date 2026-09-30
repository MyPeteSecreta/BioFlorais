/**
 * BIO FLORAIS B2B — página do convite (cadastro do vendedor/RCA ou
 * redefinição de senha). O token é validado no servidor antes de
 * mostrar o formulário; o envio revalida tudo em /api/b2b/invites/accept.
 */

import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bResponsibles } from "@/lib/db/schema";
import { B2B_RESPONSIBLE_TYPES, loadInviteByToken } from "@/lib/b2b/invites";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REASONS = {
  invalid: "Este link de convite não existe.",
  expired: "Este link de convite expirou. Peça um novo ao administrador da Bio Florais.",
  revoked: "Este link foi substituído por um mais novo ou revogado. Use o link mais recente que você recebeu.",
  used: "Este link já foi usado. Se você já tem cadastro, entre pela página de login.",
} as const;

export default async function B2BInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await loadInviteByToken(token);

  if (!lookup.ok) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <h1 className="font-serif text-3xl font-semibold text-[#55245f]">Link indisponível</h1>
        <p className="mx-auto mt-3 max-w-md text-[#746471]">{REASONS[lookup.reason]}</p>
        <Link
          href="/b2b/login"
          className="mt-6 inline-block text-sm font-bold text-[#63326d] underline underline-offset-4"
        >
          Ir para o login
        </Link>
      </main>
    );
  }

  const { invite } = lookup;

  let resetLogin: string | null = null;

  if (invite.purpose === "password_reset" && invite.responsibleId) {
    const [responsible] = await db
      .select({ login: b2bResponsibles.login })
      .from(b2bResponsibles)
      .where(eq(b2bResponsibles.id, invite.responsibleId))
      .limit(1);

    resetLogin = responsible?.login ?? null;
  }

  const typeLabel =
    B2B_RESPONSIBLE_TYPES[invite.responsibleType as keyof typeof B2B_RESPONSIBLE_TYPES] ??
    invite.responsibleType;

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">
          Bio Florais · Área B2B
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#55245f]">
          {invite.purpose === "password_reset" ? "Definir nova senha" : `Cadastro de ${typeLabel}`}
        </h1>
        <p className="mt-2 text-sm text-[#746471]">
          {invite.purpose === "password_reset"
            ? `Olá, ${invite.name}. Crie uma nova senha para o login ${resetLogin ?? ""}.`
            : `Olá, ${invite.name}. Complete seus dados e crie seu login. Depois do envio, o cadastro passa pela aprovação da Bio Florais.`}
        </p>

        <InviteForm
          token={token}
          purpose={invite.purpose === "password_reset" ? "password_reset" : "onboarding"}
          name={invite.name}
          email={invite.email}
          requiresRcaTerms={invite.responsibleType === "rca"}
          expiresAt={invite.expiresAt.toISOString()}
        />
      </div>
    </main>
  );
}
