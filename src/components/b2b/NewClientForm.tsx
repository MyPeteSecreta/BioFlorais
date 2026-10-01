"use client";

/** Cadastro de cliente do vendedor: só o nome é obrigatório. */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-2.5 text-sm";

export default function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/b2b/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, contactName, phone, email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Erro ao cadastrar cliente.");
        return;
      }

      router.push(`/b2b/painel/cliente/${data.clientId}/oferta`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white shadow"
      >
        + Novo cliente
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-3 rounded-[24px] border border-[#eadfd9] bg-white p-5">
      <h2 className="font-extrabold">Novo cliente</h2>
      <input
        className={input}
        placeholder="Nome do cliente (obrigatório)"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        autoFocus
        required
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={input} placeholder="Contato (opcional)" value={contactName} onChange={(event) => setContactName(event.target.value)} />
        <input className={input} inputMode="tel" placeholder="WhatsApp (opcional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <input className={input} type="email" placeholder="E-mail (opcional)" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-full bg-[#55245f] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
          {saving ? "Salvando…" : "Cadastrar e montar oferta →"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[#d9c7dc] px-5 py-2.5 text-sm font-bold">
          Cancelar
        </button>
      </div>
    </form>
  );
}
