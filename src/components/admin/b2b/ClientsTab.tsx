"use client";

/**
 * ADMIN B2B — aba "Clientes": busca por nome/razão social, CNPJ/CPF, e-mail, WhatsApp ou cidade; clicar abre o cadastro para
 * EDITAR (nome/razão social, CNPJ/CPF validado, e-mail, WhatsApp e endereço). Cada alteração registra quem fez e quando
 * (o admin informa o próprio nome, lembrado neste navegador) e aparece no histórico. Nunca apaga cadastro.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { CLIENT_FIELDS, CLIENT_FIELD_LABELS, type ClientField } from "@/lib/b2b/client-fields";

type Client = Record<ClientField, string | null> & { id: string; responsible: string | null; updatedAt: string | null };
type Edit = { id: string; changedBy: string; changedAt: string; changes: string[] };

const input = "w-full rounded-xl border border-[#d9c7dc] bg-white px-3 py-2.5 text-sm";
const NAME_KEY = "bio_admin_editor_name";

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

function formatDocument(digits: string | null) {
  const d = (digits ?? "").replace(/\D/g, "");

  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  return digits ?? "";
}

function emptyForm(): Record<ClientField, string> {
  return Object.fromEntries(CLIENT_FIELDS.map((field) => [field, ""])) as Record<ClientField, string>;
}

export default function ClientsTab() {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [selected, setSelected] = useState<Client | null>(null);
  const [form, setForm] = useState<Record<ClientField, string>>(emptyForm());
  const [editor, setEditor] = useState("");
  const [edits, setEdits] = useState<Edit[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; field?: string } | null>(null);

  const search = useCallback(async (text: string) => {
    setLoading(true);
    setListError("");

    try {
      const response = await fetch(`/api/admin/b2b/clients?q=${encodeURIComponent(text)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error ?? "Não foi possível buscar os clientes.");

      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Não foi possível buscar os clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setEditor(window.localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // sem armazenamento: o nome é digitado a cada edição
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), 300);

    return () => window.clearTimeout(timer);
  }, [query, search]);

  function open(client: Client) {
    setSelected(client);
    setMessage(null);
    setForm({
      ...emptyForm(),
      ...Object.fromEntries(CLIENT_FIELDS.map((field) => [field, field === "document" ? formatDocument(client[field]) : (client[field] ?? "")])),
    } as Record<ClientField, string>);
    setEdits([]);

    void fetch(`/api/admin/b2b/clients/${client.id}`)
      .then((response) => response.json())
      .then((data) => setEdits(Array.isArray(data.edits) ? data.edits : []))
      .catch(() => setEdits([]));
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!selected) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/b2b/clients/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, changedBy: editor }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ ok: false, text: data.error ?? "Não foi possível salvar o cadastro.", field: data.field });

        return;
      }

      try {
        window.localStorage.setItem(NAME_KEY, editor.trim());
      } catch {
        // ignorar
      }

      setSelected(data.client);
      setEdits(Array.isArray(data.edits) ? data.edits : []);
      setClients((list) => list.map((item) => (item.id === data.client.id ? data.client : item)));
      setMessage({ ok: true, text: data.changed ? `Cadastro atualizado: ${data.changes.join("; ")}.` : "Nada foi alterado." });
    } catch {
      setMessage({ ok: false, text: "Não foi possível salvar o cadastro." });
    } finally {
      setSaving(false);
    }
  }

  const field = (name: ClientField, props: { placeholder?: string; inputMode?: "numeric" | "email" | "tel" | "text"; maxLength?: number } = {}) => (
    <label className="block text-xs font-bold text-[#5b4a58]">
      {CLIENT_FIELD_LABELS[name]}
      <input
        className={`${input} mt-1 font-normal ${message && !message.ok && message.field === name ? "border-red-500" : ""}`}
        value={form[name]}
        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
        data-testid={`cliente-${name}`}
        {...props}
      />
    </label>
  );

  return (
    <section className="space-y-4" data-testid="clientes-tab">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <input
            className={input}
            type="search"
            placeholder="Buscar por nome, CNPJ/CPF, e-mail, WhatsApp ou cidade"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="clientes-busca"
          />
          {listError && <p className="text-sm font-semibold text-red-700">{listError}</p>}
          {loading && <p className="text-sm text-[#7b6a77]">Buscando…</p>}
          {!loading && !listError && clients.length === 0 && <p className="text-sm text-[#7b6a77]">Nenhum cliente encontrado.</p>}

          <ul className="space-y-2" data-testid="clientes-lista">
            {clients.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => open(client)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-[#55245f] ${selected?.id === client.id ? "border-[#55245f] bg-[#f6eef7]" : "border-[#eadfd9] bg-white"}`}
                >
                  <span className="block text-sm font-extrabold text-[#342737]">{client.displayName}</span>
                  <span className="block text-xs text-[#7b6a77]">
                    {[formatDocument(client.document), client.city && client.state ? `${client.city}/${client.state}` : client.city, client.responsible ? `Vendedor: ${client.responsible}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sem documento"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {!selected ? (
            <p className="rounded-2xl border border-dashed border-[#d9c7dc] p-6 text-sm text-[#7b6a77]">Escolha um cliente da lista para ver e editar o cadastro.</p>
          ) : (
            <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#eadfd9] bg-white p-4 sm:p-5" data-testid="cliente-form">
              <div>
                <h2 className="text-lg font-extrabold text-[#342737]">{selected.displayName}</h2>
                <p className="text-xs text-[#7b6a77]">
                  {selected.responsible ? `Vendedor: ${selected.responsible} · ` : ""}Última alteração: {formatDate(selected.updatedAt)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {field("displayName", { maxLength: 120 })}
                {field("contactName", { maxLength: 120 })}
                {field("document", { inputMode: "numeric", placeholder: "00.000.000/0000-00 ou 000.000.000-00" })}
                {field("email", { inputMode: "email" })}
                {field("phone", { inputMode: "tel", placeholder: "(00) 00000-0000" })}
              </div>

              <p className="text-xs font-extrabold uppercase tracking-wide text-[#a0742b]">Endereço</p>
              <div className="grid gap-3 sm:grid-cols-[140px_1fr_110px]">
                {field("postalCode", { inputMode: "numeric", placeholder: "00000-000" })}
                {field("street")}
                {field("addressNumber", { maxLength: 20 })}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_90px]">
                {field("addressComplement")}
                {field("neighborhood")}
                {field("city")}
                {field("state", { maxLength: 2 })}
              </div>

              <label className="block text-xs font-bold text-[#5b4a58]">
                Quem está alterando (fica no histórico)
                <input
                  className={`${input} mt-1 font-normal ${message && !message.ok && message.field === "changedBy" ? "border-red-500" : ""}`}
                  value={editor}
                  onChange={(event) => setEditor(event.target.value)}
                  placeholder="Seu nome"
                  data-testid="cliente-editor"
                />
              </label>

              {message && (
                <p className={`text-sm font-semibold ${message.ok ? "text-emerald-800" : "text-red-700"}`} role="status" data-testid="cliente-mensagem">
                  {message.text}
                </p>
              )}

              <button type="submit" disabled={saving} className="rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60" data-testid="cliente-salvar">
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>

              <div className="border-t border-[#eadfd9] pt-3">
                <h3 className="text-sm font-extrabold text-[#342737]">Histórico de alterações</h3>
                {edits.length === 0 ? (
                  <p className="mt-1 text-xs text-[#7b6a77]">Nenhuma alteração registrada.</p>
                ) : (
                  <ul className="mt-2 space-y-2" data-testid="cliente-historico">
                    {edits.map((edit) => (
                      <li key={edit.id} className="rounded-xl bg-[#fbf5f1] px-3 py-2 text-xs text-[#5b4a58]">
                        <strong>{edit.changedBy}</strong> · {formatDate(edit.changedAt)}
                        <span className="mt-1 block">{edit.changes.join("; ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
