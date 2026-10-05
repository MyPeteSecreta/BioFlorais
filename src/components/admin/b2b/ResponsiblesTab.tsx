"use client";

/**
 * ADMIN B2B — aba "Vendedores / RCAs": lista, gerar convite, revogar,
 * gerar novo link, desativar/reativar e redefinir acesso. O cadastro
 * pelo convite já nasce ativo (sem etapa de aprovação).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import ShareLink from "./ShareLink";

type Row = {
  kind: "responsible" | "invite";
  id: string;
  name: string;
  email: string;
  type: string;
  status: string;
  phone: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  clients: number;
  offers: number;
  paidOrders: number;
  situation?: string | null;
};

type SharedLink = {
  title: string;
  url: string;
  whatsappUrl: string;
  expiresAt?: string | null;
};

const TYPE_LABELS: Record<string, string> = { rca: "RCA", clt: "Vendedor" };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  invite_pending: { label: "Convite pendente", className: "bg-[#fff4db] text-[#8a5a12]" },
  invite_expired: { label: "Convite expirado", className: "bg-[#f3eef2] text-[#7b6a77]" },
  active: { label: "Ativo", className: "bg-[#e3f5e9] text-[#1f6b3a]" },
  inactive: { label: "Inativo", className: "bg-[#fbe7e7] text-[#8f2727]" },
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";

export default function ResponsiblesTab() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sharedLink, setSharedLink] = useState<SharedLink | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"rca" | "clt">("rca");
  const [whatsapp, setWhatsapp] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/b2b/responsibles", { cache: "no-store" });
      const data = await response.json();

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        setMessage(data.error ?? "Erro ao carregar.");
        return;
      }

      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setCreating(true);

    try {
      const { ok, data } = await post("/api/admin/b2b/invites", { name, email, type, whatsapp });

      if (!ok) {
        setMessage(data.error ?? "Erro ao gerar convite.");
        return;
      }

      setSharedLink({
        title: `Convite de ${TYPE_LABELS[type]} para ${name}`,
        url: data.url,
        whatsappUrl: data.whatsappUrl,
        expiresAt: data.expiresAt,
      });
      setName("");
      setEmail("");
      setWhatsapp("");
      void load();
    } finally {
      setCreating(false);
    }
  }

  async function act(row: Row, action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;

    setBusyId(row.id);
    setMessage("");

    try {
      const url =
        row.kind === "invite"
          ? `/api/admin/b2b/invites/${row.id}`
          : `/api/admin/b2b/responsibles/${row.id}`;

      const { ok, data } = await post(url, { action });

      if (!ok) {
        setMessage(data.error ?? "Erro ao executar a ação.");
        return;
      }

      if (data.url) {
        setSharedLink({
          title:
            action === "reset_access"
              ? `Link para ${row.name} definir nova senha`
              : action === "show_link"
                ? `Link de acesso de ${row.name}`
                : `Novo link de convite para ${row.name}`,
          url: data.url,
          whatsappUrl: data.whatsappUrl,
          expiresAt: data.expiresAt,
        });
      }

      void load();
    } finally {
      setBusyId(null);
    }
  }

  const actionButton = "rounded-full border px-3 py-1 text-xs font-extrabold disabled:opacity-40";

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleInvite}
        className="grid gap-3 rounded-2xl border border-[#eadfd9] bg-white p-5 md:grid-cols-[1fr_1fr_140px_1fr_auto] md:items-end"
      >
        <label className="text-xs font-bold text-[#7b6a77]">
          Nome
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          E-mail
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Tipo
          <select className={field} value={type} onChange={(e) => setType(e.target.value as "rca" | "clt")}>
            <option value="rca">RCA</option>
            <option value="clt">Vendedor</option>
          </select>
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          WhatsApp (opcional)
          <input className={field} inputMode="tel" placeholder="(11) 99999-9999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {creating ? "Gerando…" : "Gerar convite"}
        </button>
      </form>

      {sharedLink && <ShareLink {...sharedLink} onClose={() => setSharedLink(null)} />}

      {message && <p className="rounded-xl bg-[#fbe7e7] p-3 text-sm text-[#8f2727]">{message}</p>}

      <div className="overflow-x-auto rounded-2xl border border-[#eadfd9] bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Convite</th>
              <th className="px-4 py-3">Último acesso</th>
              <th className="px-4 py-3 text-right">Clientes</th>
              <th className="px-4 py-3 text-right">Ofertas</th>
              <th className="px-4 py-3 text-right">Pedidos pagos</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e9e4]">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[#7b6a77]">Carregando…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[#7b6a77]">
                  Nenhum vendedor ainda. Gere o primeiro convite acima.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const status = STATUS_LABELS[row.status] ?? { label: row.status, className: "bg-[#f3eef2]" };
              const busy = busyId === row.id;

              return (
                <tr key={`${row.kind}-${row.id}`}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#342737]">{row.name}</p>
                    <p className="text-xs text-[#7b6a77]">{row.email}</p>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABELS[row.type] ?? row.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${status.className}`}>
                      {status.label}
                    </span>
                    {row.kind === "responsible" && row.situation && (
                      <span
                        className={`mt-1 block text-xs font-bold ${
                          row.situation === "Teste vencido" ? "text-[#8f2727]" : row.situation === "Cadastro completo" ? "text-[#1f6b3a]" : "text-[#8a5a12]"
                        }`}
                      >
                        {row.situation}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDate(row.invitedAt)}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(row.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">{row.clients}</td>
                  <td className="px-4 py-3 text-right">{row.offers}</td>
                  <td className="px-4 py-3 text-right">{row.paidOrders}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.kind === "invite" && (
                        <>
                          <button type="button" disabled={busy} onClick={() => act(row, "show_link")} className={`${actionButton} border-[#1f6b3a] text-[#1f6b3a]`}>
                            Copiar link de acesso / WhatsApp
                          </button>
                          <button type="button" disabled={busy} onClick={() => act(row, "regenerate", "Gerar um novo link? O link anterior deixa de funcionar.")} className={`${actionButton} border-[#342737] text-[#342737]`}>
                            Gerar novo link
                          </button>
                          <button type="button" disabled={busy} onClick={() => act(row, "revoke", `Revogar o convite de ${row.name}?`)} className={`${actionButton} border-[#b33] text-[#b33]`}>
                            Revogar
                          </button>
                        </>
                      )}
                      {row.kind === "responsible" && row.status !== "inactive" && (
                        <button type="button" disabled={busy} onClick={() => act(row, "deactivate", `Desativar ${row.name}? O acesso e os links de oferta dele param de funcionar.`)} className={`${actionButton} border-[#b33] text-[#b33]`}>
                          Desativar
                        </button>
                      )}
                      {row.kind === "responsible" && row.status === "inactive" && (
                        <button type="button" disabled={busy} onClick={() => act(row, "reactivate")} className={`${actionButton} border-[#1f6b3a] text-[#1f6b3a]`}>
                          Reativar
                        </button>
                      )}
                      {row.kind === "responsible" && row.situation && row.situation !== "Cadastro completo" && (
                        <button type="button" disabled={busy} onClick={() => act(row, "extend_trial", `Estender o teste de ${row.name} por mais 7 dias?`)} className={`${actionButton} border-[#8a5a12] text-[#8a5a12]`}>
                          Estender teste +7 dias
                        </button>
                      )}
                      {row.kind === "responsible" && (
                        <button type="button" disabled={busy} onClick={() => act(row, "reset_access", `Gerar link para ${row.name} definir uma nova senha?`)} className={`${actionButton} border-[#342737] text-[#342737]`}>
                          Redefinir acesso
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
