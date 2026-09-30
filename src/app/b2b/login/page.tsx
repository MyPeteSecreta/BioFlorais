"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function B2BLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/b2b/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }

      router.push("/b2b/painel");
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-[#422347]">
      <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">Bio Florais · B2B</p>
        <h1 className="font-serif text-2xl font-semibold text-[#55245f]">Acesso do representante</h1>
        <input
          autoComplete="username"
          placeholder="Login"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          className="w-full rounded-xl border border-[#d9c7dc] px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-[#d9c7dc] px-3 py-2.5 text-sm"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
