"use client";

/**
 * ADMIN B2B — aba "Vendedores / RCAs": uma tela por pessoa (cartão), com a situação em destaque,
 * busca por nome/e-mail e as ações sempre visíveis. Convite pendente: copiar link, WhatsApp, gerar
 * novo link, revogar. Vendedor cadastrado: copiar acesso, WhatsApp, redefinir senha, desativar/
 * reativar, estender teste, editar e-mail/login, desativar e liberar e-mail e "Vendedor no Omie".
 * O cadastro pelo convite já nasce ativo (sem etapa de aprovação). Regras puras: seller-card.ts.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import ShareLink from "./ShareLink";
import { accessText, accessWhatsAppUrl, isReleasedEmail, matchesSearch, sellerBadge, type SellerBadge } from "@/lib/b2b/seller-card";

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
  omieVendor?: string | null;
  login?: string | null;
  emailOriginal?: string | null;
};

type SharedLink = {
  title: string;
  url: string;
  whatsappUrl: string;
  expiresAt?: string | null;
};

const TYPE_LABELS: Record<string, string> = { rca: "RCA", clt: "Vendedor" };

const BADGE_CLASS: Record<SellerBadge["tone"], string> = {
  pending: "bg-[#fff3d6] text-[#8a5a00]",
  trial: "bg-[#e8f0fe] text-[#1b4a9c]",
  complete: "bg-[#e3f6e8] text-[#1c6b35]",
  inactive: "bg-[#fde8e8] text-[#a12b2b]",
  muted: "bg-[#f3eeee] text-[#7b5a63]",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";
const bigBase = "min-h-10 rounded-full px-4 py-2 text-sm font-extrabold transition disabled:opacity-50";
const bigDark = `${bigBase} bg-[#342737] text-white`;
const bigLight = `${bigBase} border border-[#d9c9c1] bg-white text-[#342737]`;
const bigGreen = `${bigBase} border border-[#25d366] bg-white text-[#0e7a3d]`;
const bigDanger = `${bigBase} border border-[#e5b4b4] bg-white text-[#a12b2b]`;
const smallBase = "rounded-full border px-3 py-1 text-xs font-extrabold disabled:opacity-40";

export default function ResponsiblesTab() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sharedLink, setSharedLink] = useState<SharedLink | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [omieDraft, setOmieDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

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
      const url = row.kind === "invite" ? `/api/admin/b2b/invites/${row.id}` : `/api/admin/b2b/responsibles/${row.id}`;
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

  /** Convite pendente: copia ou envia pelo WhatsApp o MESMO link vigente (a rota devolve o link guardado). */
  async function shareInvite(row: Row, how: "copy" | "whatsapp") {
    setBusyId(row.id);
    setMessage("");

    try {
      const { ok, data } = await post(`/api/admin/b2b/invites/${row.id}`, { action: "show_link" });

      if (!ok || !data.url) {
        setMessage(data.error ?? 'Este link não pode ser recuperado. Use "Gerar novo link": o anterior deixa de valer.');
        return;
      }

      if (how === "whatsapp") {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
        return;
      }

      try {
        await navigator.clipboard.writeText(data.url);
        setMessage(`Link do convite de ${row.name} copiado.`);
      } catch {
        setSharedLink({ title: `Link de acesso de ${row.name}`, url: data.url, whatsappUrl: data.whatsappUrl, expiresAt: data.expiresAt });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function copyAccess(row: Row) {
    try {
      await navigator.clipboard.writeText(accessText(row.email));
      setMessage(`Texto de acesso de ${row.name} copiado: "${accessText(row.email)}"`);
    } catch {
      setMessage("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  async function editIdentity(row: Row) {
    const newEmail = window.prompt(`E-mail de ${row.name}:`, row.email);

    if (newEmail === null) return;

    const login = window.prompt("Login (pode ser o próprio e-mail):", row.login || newEmail);

    if (login === null) return;

    setBusyId(row.id);
    setMessage("");

    try {
      const { ok, data } = await post(`/api/admin/b2b/responsibles/${row.id}`, { action: "edit_identity", email: newEmail, login });

      setMessage(ok ? `E-mail/login de ${row.name} atualizados.` : (data.error ?? "Erro ao editar."));
      if (ok) void load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveOmieVendor(row: Row) {
    const value = omieDraft[row.id] ?? row.omieVendor ?? "";

    setBusyId(row.id);
    setMessage("");

    try {
      const { ok, data } = await post(`/api/admin/b2b/responsibles/${row.id}`, { action: "set_omie_vendor", omieVendor: value });

      if (!ok) {
        setMessage(data.error ?? "Erro ao salvar o Vendedor no Omie.");
        return;
      }

      setOmieDraft((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setMessage(`Vendedor no Omie de ${row.name} salvo.`);
      void load();
    } finally {
      setBusyId(null);
    }
  }

  /** Ações principais (sempre visíveis, por pessoa). */
  function mainActions(row: Row) {
    const busy = busyId === row.id;

    if (row.kind === "invite") {
      return (
        <>
          {row.status === "invite_pending" && (
            <>
              <button type="button" disabled={busy} className={bigDark} onClick={() => shareInvite(row, "copy")} data-testid="copiar-convite">
                Copiar link do convite
              </button>
              <button type="button" disabled={busy} className={bigGreen} onClick={() => shareInvite(row, "whatsapp")} data-testid="whatsapp-convite">
                WhatsApp
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            className={bigLight}
            data-testid="novo-link"
            onClick={() => act(row, "regenerate", `Gerar novo link para ${row.name}? O link anterior será REVOGADO e deixa de funcionar.`)}
          >
            Gerar novo link
          </button>
          {row.status === "invite_pending" && (
            <button
              type="button"
              disabled={busy}
              className={bigDanger}
              data-testid="revogar-convite"
              onClick={() => act(row, "revoke", `Revogar o convite de ${row.name}? O link deixa de funcionar.`)}
            >
              Revogar
            </button>
          )}
        </>
      );
    }

    if (isReleasedEmail(row.email)) return null;

    return (
      <>
        <button type="button" className={bigDark} onClick={() => copyAccess(row)} data-testid="copiar-acesso">
          Copiar acesso
        </button>
        <a href={accessWhatsAppUrl(row)} target="_blank" rel="noopener noreferrer" className={`${bigGreen} inline-flex items-center`} data-testid="whatsapp-acesso">
          WhatsApp
        </a>
        <button
          type="button"
          disabled={busy}
          className={bigLight}
          data-testid="redefinir-senha"
          onClick={() => act(row, "reset_access", `Gerar link de nova senha para ${row.name}? Um link anterior deixa de valer.`)}
        >
          Redefinir senha
        </button>
      </>
    );
  }

  /** Ações menos frequentes (também visíveis, em segunda linha). */
  function otherActions(row: Row) {
    const busy = busyId === row.id;

    if (row.kind === "invite" || isReleasedEmail(row.email)) return null;

    return (
      <>
        {row.status === "inactive" ? (
          <button type="button" disabled={busy} onClick={() => act(row, "reactivate")} className={`${smallBase} border-[#1f6b3a] text-[#1f6b3a]`}>
            Reativar
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(row, "deactivate", `Desativar ${row.name}? O acesso e os links de oferta dele param de funcionar.`)}
            className={`${smallBase} border-[#b33] text-[#b33]`}
          >
            Desativar
          </button>
        )}
        {row.situation && row.situation !== "Cadastro completo" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(row, "extend_trial", `Estender o teste de ${row.name} por mais 7 dias?`)}
            className={`${smallBase} border-[#8a5a12] text-[#8a5a12]`}
          >
            Estender teste +7 dias
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => editIdentity(row)} className={`${smallBase} border-[#342737] text-[#342737]`} data-testid="editar-identidade">
          Editar e-mail/login
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            act(row, "release_email", `Desativar ${row.name} e LIBERAR o e-mail ${row.email}? Ele perde o acesso; os pedidos e comissões dele continuam. O e-mail poderá ser cadastrado de novo.`)
          }
          className={`${smallBase} border-[#b33] text-[#b33]`}
        >
          Desativar e liberar e-mail
        </button>
      </>
    );
  }

  const visibleRows = rows.filter((row) => matchesSearch(row, search));

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
        <button type="submit" disabled={creating} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
          {creating ? "Gerando…" : "Gerar convite"}
        </button>
      </form>

      {sharedLink && <ShareLink {...sharedLink} onClose={() => setSharedLink(null)} />}

      {message && (
        <p role="status" className="rounded-xl bg-[#fbe7e7] p-3 text-sm text-[#8f2727]">
          {message}
        </p>
      )}

      {loading && <p className="text-sm text-[#7b6a77]">Carregando…</p>}

      {!loading && rows.length === 0 && (
        <p className="rounded-2xl border border-[#eadfd9] bg-white p-6 text-sm text-[#7b6a77]">Nenhum vendedor ainda. Gere o primeiro convite acima.</p>
      )}

      {rows.length > 0 && (
        <>
          <div>
            <label className="sr-only" htmlFor="busca-vendedor">
              Buscar por nome ou e-mail
            </label>
            <input
              id="busca-vendedor"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              data-testid="busca-vendedor"
              className="w-full rounded-xl border border-[#d9c9c1] bg-white p-3 text-sm md:max-w-md"
            />
            <p className="mt-1 text-xs text-[#7b6a77]">
              {visibleRows.length} de {rows.length} {rows.length === 1 ? "pessoa" : "pessoas"}
            </p>
          </div>

          {visibleRows.length === 0 && (
            <p className="rounded-2xl border border-[#eadfd9] bg-white p-6 text-sm text-[#7b6a77]">Ninguém encontrado para &quot;{search}&quot;.</p>
          )}

          <ul className="space-y-3">
            {visibleRows.map((row) => {
              const badge = sellerBadge(row);
              const released = isReleasedEmail(row.email);
              const main = mainActions(row);
              const other = otherActions(row);
              const busy = busyId === row.id;

              return (
                <li key={`${row.kind}-${row.id}`} className="rounded-2xl border border-[#eadfd9] bg-white p-4 sm:p-5" data-testid="cartao-pessoa">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-[#342737]">{row.name}</p>
                      <p className="break-all text-sm text-[#594740]">
                        {released ? (
                          <>
                            e-mail liberado {row.emailOriginal && <span className="text-xs text-[#7b6a77]">(era {row.emailOriginal})</span>}
                          </>
                        ) : (
                          row.email
                        )}
                        <span className="text-[#7b6a77]"> · {TYPE_LABELS[row.type] ?? row.type}</span>
                        {row.phone && <span className="text-[#7b6a77]"> · WhatsApp {row.phone}</span>}
                      </p>
                      {!released && row.emailOriginal && <p className="text-[11px] text-[#8a5a12]">e-mail anterior: {row.emailOriginal}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${BADGE_CLASS[badge.tone]}`} data-testid="situacao-pessoa">
                      {badge.text}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[#7b6a77]">
                    {row.kind === "responsible" ? (
                      <>
                        {row.login && <>login: {row.login} · </>}último acesso: {formatDate(row.lastLoginAt)} · {row.clients} cliente(s) · {row.offers} oferta(s) · {row.paidOrders} pedido(s) pago(s)
                      </>
                    ) : (
                      <>convite enviado em {formatDate(row.invitedAt)}</>
                    )}
                  </p>

                  {main && <div className="mt-4 flex flex-wrap gap-2">{main}</div>}
                  {other && <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f1e8e3] pt-3">{other}</div>}

                  {row.kind === "responsible" && !released && (
                    <div className="mt-3 border-t border-[#f1e8e3] pt-3">
                      <p className="mb-1 text-xs font-bold text-[#7b6a77]">Vendedor no Omie</p>
                      <div className="w-full max-w-[420px]" data-testid="omie-vendor-field">
                        <div className="flex gap-1.5">
                          <input
                            className={field}
                            maxLength={70}
                            placeholder="Nome completo no Omie"
                            aria-label={`Vendedor no Omie de ${row.name}`}
                            value={omieDraft[row.id] ?? row.omieVendor ?? ""}
                            onChange={(e) => setOmieDraft((current) => ({ ...current, [row.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            disabled={busy || omieDraft[row.id] === undefined}
                            onClick={() => saveOmieVendor(row)}
                            className={`${smallBase} shrink-0 border-[#1f6b3a] text-[#1f6b3a]`}
                          >
                            Salvar
                          </button>
                        </div>
                        {!row.omieVendor && <p className="mt-1 text-[11px] font-bold text-[#8f2727]">Sem isso o pedido B2B não é exportado ao Omie.</p>}
                        <p className="mt-1 text-[11px] text-[#7b6a77]">Nome completo exatamente como no cadastro de Vendedores do Omie (máx. 70 caracteres).</p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
