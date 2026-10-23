"use client";

/**
 * "Já sou cliente" (Rodada 19c): o lojista não tem senha. Informa e-mail ou CNPJ/CPF e, se houver cadastro, recebe o link
 * pessoal por e-mail. A resposta é sempre a mesma, exista o cadastro ou não.
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function EntrarPage() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/b2b/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json().catch(() => ({}));

      setMessage(data.message ?? "Se encontrarmos o seu cadastro, enviaremos o seu link de compra para o e-mail cadastrado.");
    } catch {
      setMessage("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-16 text-[#422347]">
      <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-[20px] border border-[#eadfd9] bg-white p-6" data-testid="form-entrar">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">Bio Florais · B2B</p>
        <h1 className="font-serif text-2xl font-semibold text-[#55245f]">Já sou cliente</h1>
        <p className="text-sm text-[#6c5b69]">Informe o seu e-mail ou CNPJ. Se houver cadastro, enviamos o seu link de compra para o e-mail cadastrado.</p>
        <label className="block text-xs font-bold text-[#6c5b69]" htmlFor="entrar-identificador">
          E-mail ou CNPJ
        </label>
        <input
          id="entrar-identificador"
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          placeholder="voce@loja.com ou 00.000.000/0000-00"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          className="w-full rounded-xl border border-[#d9c7dc] px-3 py-3 text-base"
          data-testid="entrar-identificador"
        />
        <button type="submit" disabled={busy || identifier.trim().length < 5} className="w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white disabled:opacity-60" data-testid="entrar-enviar">
          {busy ? "Enviando…" : "Receber meu link"}
        </button>
        {message && (
          <p role="status" className="rounded-xl bg-[#f4fbf6] p-3 text-sm text-[#2f5a3c]" data-testid="entrar-mensagem">
            {message}
          </p>
        )}
        <p className="pt-2 text-center text-xs text-[#8a7886]">
          É representante?{" "}
          <Link href="/b2b/login" className="font-bold text-[#63326d] underline">
            Acesso do representante
          </Link>
        </p>
      </form>
    </main>
  );
}
