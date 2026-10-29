"use client";

/** "Meu cadastro": o vendedor troca o seu próprio WhatsApp (o que vai no PDF carimbado e é usado pelo lojista para falar com ele). */

import { useState } from "react";

import { formatWhatsApp } from "@/lib/b2b/sales-materials";

export default function ContactWhatsAppForm({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone);
  const [draft, setDraft] = useState(formatWhatsApp(initialPhone) ?? initialPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/b2b/profile/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ whatsapp: draft }) });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ tone: "error", text: data.error ?? "Não foi possível salvar." });
        return;
      }

      setPhone(data.phone ?? null);
      setDraft(formatWhatsApp(data.phone) ?? draft);
      setMessage({ tone: "ok", text: data.changed ? "WhatsApp atualizado." : "O WhatsApp já era esse." });
    } catch {
      setMessage({ tone: "error", text: "Sem conexão. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-[760px] rounded-[24px] border border-[#eadfd9] bg-white p-5 sm:p-6" data-testid="meu-whatsapp">
      <h2 className="text-xl font-extrabold text-[#422347]">Meu WhatsApp</h2>
      <p className="mt-1 text-sm text-[#746471]">
        É o número que aparece nos PDFs que você encaminha e que o lojista usa para falar com você. Atual: <strong data-testid="whatsapp-atual">{formatWhatsApp(phone) ?? "não informado"}</strong>
      </p>
      <label className="mt-3 grid gap-1 text-sm font-bold text-[#422347]">
        WhatsApp com DDD
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-8888"
          className="rounded-xl border border-[#eadfd9] bg-white px-3 py-3 text-base font-normal"
          data-testid="whatsapp-campo"
        />
      </label>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-2 text-sm font-bold ${message.tone === "error" ? "text-red-700" : "text-emerald-700"}`} data-testid="whatsapp-mensagem">
          {message.text}
        </p>
      )}
      <button type="button" disabled={busy} onClick={save} className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#55245f] px-6 text-sm font-extrabold text-white disabled:opacity-60" data-testid="whatsapp-salvar">
        {busy ? "Salvando…" : "Salvar WhatsApp"}
      </button>
    </section>
  );
}
