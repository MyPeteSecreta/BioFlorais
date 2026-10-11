"use client";

/** /parceiros — "Quero comprar": cadastro rápido do lojista; ao concluir abre o link padrão (preço B2B). */

import Link from "next/link";
import { useState, type FormEvent } from "react";

const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-3 text-base";

export default function PartnerSignupForm({ referralCode }: { referralCode: string | null }) {
  const [form, setForm] = useState({ name: "", document: "", phone: "", email: "", city: "", state: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/parceiros/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, v: referralCode }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error ?? "Não foi possível concluir o cadastro.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm" id="cadastro">
      <h2 className="font-serif text-2xl font-semibold text-[#422347]">Cadastro rápido do lojista</h2>
      <p className="text-sm text-[#746471]">Preencha e abrimos na hora a sua loja com os preços B2B.</p>

      <input className={input} placeholder="Nome da loja" value={form.name} onChange={set("name")} required autoComplete="organization" />
      <input className={input} placeholder="CNPJ ou CPF" inputMode="numeric" value={form.document} onChange={set("document")} required />
      <input className={input} placeholder="WhatsApp com DDD" inputMode="tel" value={form.phone} onChange={set("phone")} required autoComplete="tel" />
      <input className={input} type="email" placeholder="E-mail" value={form.email} onChange={set("email")} required autoComplete="email" />
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <input className={input} placeholder="Cidade" value={form.city} onChange={set("city")} required autoComplete="address-level2" />
        <input className={input} placeholder="UF" maxLength={2} value={form.state} onChange={set("state")} required autoComplete="address-level1" />
      </div>

      {/* campo-isca (invisível para pessoas) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-[#55245f] px-6 py-4 text-base font-extrabold text-white shadow disabled:opacity-60"
      >
        {busy ? "Abrindo sua loja…" : "Quero comprar"}
      </button>

      <p className="text-center text-xs leading-5 text-[#746471]" data-testid="lgpd">
        Seus dados serão usados para contato comercial, conforme nossa{" "}
        <Link href="/privacidade" className="font-bold text-[#63326d] underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </form>
  );
}
