"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewSettingsForm({ enabled, url }: { enabled: boolean; url: string }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [link, setLink] = useState(url);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/review-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: on, url: link }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      setMessage(response.ok ? "Salvo." : data.error ?? "Não foi possível salvar.");
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="avaliacao-form">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
        Pedir avaliação 7 dias depois de entregue (B2C)
      </label>
      <label className="block text-sm font-bold">
        Link onde a avaliação cai
        <input
          type="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://g.page/r/.../review"
          className="mt-1 w-full rounded-xl border border-[#e5dccf] px-3 py-2 font-normal"
        />
        <span className="mt-1 block text-xs font-normal text-[#6c5b69]">
          Recomendado: o link &quot;Pedir avaliações&quot; do Perfil da Empresa no Google. Sem brinde ou desconto em troca (o Google não permite).
        </span>
      </label>
      <button type="button" onClick={save} disabled={busy} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
        {busy ? "Salvando..." : "Salvar"}
      </button>
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
    </div>
  );
}
