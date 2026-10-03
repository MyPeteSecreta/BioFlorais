"use client";

/** Página pública "Acompanhe seu pedido": número do pedido + e-mail ou CPF/CNPJ. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function TrackOrderPage() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, contact }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error ?? "Não foi possível consultar agora.");
        return;
      }

      router.push(data.url);
    } catch {
      setError("Não foi possível consultar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 block w-full rounded-xl border border-[#d9ccc4] bg-white px-4 py-3 text-base";

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">Bio Florais</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#55245f]">Acompanhe seu pedido</h1>
        <p className="mt-2 text-sm text-[#6c5b69]">
          Informe o número do pedido (está na confirmação da compra, ex.: 3F9A21C4) e o e-mail ou o CPF/CNPJ usado na compra.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm">
          <label className="block text-sm font-bold">
            Número do pedido
            <input className={field} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex.: 3F9A21C4" autoCapitalize="characters" required />
          </label>
          <label className="block text-sm font-bold">
            E-mail ou CPF/CNPJ
            <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="voce@email.com ou 000.000.000-00" required />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="w-full rounded-full bg-[#55245f] py-3.5 text-base font-extrabold text-white disabled:opacity-60">
            {busy ? "Consultando…" : "Acompanhar"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#6c5b69]">
          Precisa de ajuda? Fale com o{" "}
          <Link href="/atendimento" className="font-bold text-[#63326d] underline">
            atendimento
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
