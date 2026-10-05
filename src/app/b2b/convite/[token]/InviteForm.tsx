"use client";

/**
 * Convite do vendedor/RCA.
 *  - onboarding: cadastro RÁPIDO (nome, WhatsApp, e-mail e senha). Entra direto no painel e
 *    tem 7 dias de teste; o cadastro completo (documento, endereço, Pix, termo) vem depois.
 *  - password_reset: só a nova senha.
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Props = {
  token: string;
  purpose: "onboarding" | "password_reset";
  name: string;
  email: string;
  requiresRcaTerms: boolean;
  expiresAt: string;
};

const input =
  "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-3 text-base outline-none focus:border-[#63326d]";

export default function InviteForm({ token, purpose, name: invitedName, email: invitedEmail, expiresAt }: Props) {
  const [name, setName] = useState(invitedName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetDone, setResetDone] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/b2b/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          purpose === "onboarding"
            ? { token, mode: "quick", name, phone, email, password }
            : { token, password, passwordConfirmation }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir.");
        return;
      }

      if (purpose === "onboarding") {
        // Já entra no painel (a sessão foi criada no cadastro).
        window.location.href = "/b2b/painel";
        return;
      }

      setResetDone(data.login ?? "");
    } catch {
      setError("Não foi possível concluir. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (resetDone !== null) {
    return (
      <section className="mt-8 rounded-[20px] border border-[#eadfd9] bg-white p-6">
        <h2 className="text-lg font-bold">Senha definida</h2>
        <p className="mt-2 text-sm">
          Entre com o login <strong>{resetDone}</strong> e a nova senha.
        </p>
        <Link href="/b2b/login" className="mt-4 inline-block rounded-full bg-[#55245f] px-5 py-2.5 text-sm font-extrabold text-white">
          Ir para o login
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <section className="space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-5">
        {purpose === "onboarding" ? (
          <>
            <h2 className="font-bold">Cadastro rápido</h2>
            <p className="text-sm text-[#6c5b69]">
              Leva menos de 1 minuto. Você já entra, cadastra clientes e gera links. Tem <strong>7 dias de teste</strong> para
              completar o cadastro e receber suas comissões.
            </p>
            <input className={input} placeholder="Nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className={input} inputMode="tel" autoComplete="tel" placeholder="WhatsApp com DDD" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <input className={input} type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </>
        ) : (
          <h2 className="font-bold">Nova senha</h2>
        )}

        <input
          className={input}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Senha (mínimo 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {purpose === "password_reset" && (
          <input className={input} type="password" autoComplete="new-password" placeholder="Repita a senha" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required />
        )}
        <label className="flex items-center gap-2 text-xs text-[#6c5b69]">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Mostrar senha
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="w-full rounded-full bg-[#55245f] py-3.5 text-base font-extrabold text-white disabled:opacity-50">
        {submitting ? "Enviando…" : purpose === "onboarding" ? "Entrar e começar" : "Salvar nova senha"}
      </button>

      <p className="text-center text-xs text-[#8a7886]">Link válido até {new Date(expiresAt).toLocaleString("pt-BR")}.</p>
    </form>
  );
}
