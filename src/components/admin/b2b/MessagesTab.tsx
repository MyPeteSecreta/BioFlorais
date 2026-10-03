"use client";

/** ADMIN B2B — aba "Mensagens ao lojista" (C11): título, texto, ativa e ordem. */

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useAdminApi } from "./useAdminApi";

type Message = { id: string | null; title: string; body: string; shortCall: string; active: boolean; sortOrder: number };

const EMPTY: Message = { id: null, title: "", body: "", shortCall: "", active: true, sortOrder: 10 };
const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";

export default function MessagesTab() {
  const api = useAdminApi();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState<Message | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rotation, setRotation] = useState({ bannerSeconds: 60, buttonSeconds: 60 });

  const load = useCallback(async () => {
    const { ok, data } = await api("/api/admin/b2b/messages");

    if (ok) {
      setMessages(data.messages ?? []);
      if (data.rotation) setRotation(data.rotation);
    } else setMessage(data.error ?? "Erro ao carregar.");
  }, [api]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveRotation() {
    const { ok, data } = await api("/api/admin/b2b/messages/settings", { method: "PUT", body: rotation });
    setMessage(ok ? "Tempos de troca salvos." : data.error ?? "Erro ao salvar os tempos.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;

    setSaving(true);
    setMessage("");

    try {
      const { ok, data } = await api("/api/admin/b2b/messages", { method: "POST", body: draft });

      if (!ok) {
        setMessage(data.error ?? "Erro ao salvar.");
        return;
      }

      setDraft(null);
      setMessage("Mensagem salva.");
      void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[#7b6a77]">
          Mensagens que o lojista vê no link da oferta: pop-up no 1º acesso (a primeira da ordem), faixa no topo
          alternando as ativas a cada ~8 s e botão flutuante. Não use &quot;frete grátis&quot;: diga &quot;frete
          especial B2B&quot;.
        </p>
        {!draft && (
          <button type="button" onClick={() => setDraft({ ...EMPTY })} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white">
            Nova mensagem
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#eadfd9] bg-white p-4">
        <label className="text-xs font-bold text-[#7b6a77]">
          Faixa do topo: trocar a cada (segundos)
          <input className={`${field} w-32`} type="number" min={5} max={3600} value={rotation.bannerSeconds} onChange={(e) => setRotation({ ...rotation, bannerSeconds: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Botão flutuante: trocar a cada (segundos)
          <input className={`${field} w-32`} type="number" min={5} max={3600} value={rotation.buttonSeconds} onChange={(e) => setRotation({ ...rotation, buttonSeconds: Number(e.target.value) })} />
        </label>
        <button type="button" onClick={saveRotation} className="rounded-full border border-[#342737] px-4 py-2 text-xs font-extrabold">
          Salvar tempos
        </button>
        <p className="max-w-md text-xs text-[#7b6a77]">Padrão: 60 s. Ambos giram pelas mensagens ativas, cada um no seu tempo. O pop-up do 1º acesso usa a 1ª mensagem ativa pela ordem.</p>
      </div>

      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

      {draft && (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-[#eadfd9] bg-white p-5">
          <h2 className="font-extrabold">{draft.id ? "Editar mensagem" : "Nova mensagem"}</h2>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Título
            <input className={field} maxLength={120} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Chamada curta (botão flutuante, até 30 caracteres)
            <input className={field} maxLength={30} value={draft.shortCall} onChange={(e) => setDraft({ ...draft, shortCall: e.target.value })} placeholder="Ex.: Novidades para você" />
          </label>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Texto
            <textarea className={`${field} min-h-[120px]`} maxLength={1200} required value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Ativa
            </label>
            <label className="flex items-center gap-2 text-xs text-[#7b6a77]">
              Ordem
              <input className="w-20 rounded-lg border border-[#eadfd9] px-2 py-1 text-right text-sm" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </label>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-[#342737] px-5 py-2.5 text-sm font-extrabold">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {messages.length === 0 && <li className="rounded-2xl border border-dashed border-[#d9c7dc] bg-white p-6 text-sm text-[#7b6a77]">Nenhuma mensagem (cadastre as suas).</li>}
        {messages.map((item) => (
          <li key={item.id} className={`rounded-2xl border bg-white p-4 ${item.active ? "border-[#eadfd9]" : "border-[#eadfd9] opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="font-extrabold">{item.title}</p>
                {item.shortCall && <p className="mt-1 text-xs font-bold text-[#8a5f12]">Botão: {item.shortCall}</p>}
                <p className="mt-1 text-sm text-[#6c5b69]">{item.body}</p>
                <p className="mt-2 text-xs font-bold text-[#8a7886]">
                  {item.active ? "Ativa" : "Inativa"} · ordem {item.sortOrder}
                </p>
              </div>
              <button type="button" onClick={() => setDraft({ ...item })} className="rounded-full border border-[#342737] px-4 py-1.5 text-xs font-extrabold">
                Editar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
