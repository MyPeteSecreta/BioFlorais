"use client";

/**
 * ADMIN B2B → Vendedores: LINK PADRÃO PERMANENTE de demonstração, sempre visível (Copiar, QR e WhatsApp), para quem
 * contratar um vendedor ou falar com um representante (Luis, 10/11); e "Gerar link de demonstração" para campanhas (validade
 * em dias ou sem prazo). O link de campanha é mostrado UMA vez; a tabela mostra validade, acessos e situação, e permite revogar.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";

import QrCodeModal from "@/components/b2b/QrCodeModal";

import { useAdminApi } from "./useAdminApi";

type LinkRow = {
  id: string;
  campaign: string;
  expiresAt: string;
  noExpiry?: boolean;
  isDefault?: boolean;
  maxAccesses: number | null;
  accesses: number;
  revoked: boolean;
  expired: boolean;
};

const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";
const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function DemoLinksPanel() {
  const api = useAdminApi();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [campaign, setCampaign] = useState("");
  const [days, setDays] = useState("30");
  const [maxAccesses, setMaxAccesses] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ link: string; whatsappUrl: string } | null>(null);
  const [noExpiry, setNoExpiry] = useState(false);
  const [defaultLink, setDefaultLink] = useState<{ url: string; accesses: number; revoked: boolean } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await api("/api/admin/b2b/demo-links");

    if (ok) {
      setLinks(data.links ?? []);
      setDefaultLink(data.defaultLink ?? null);
      if (data.error) setMessage(data.error);
    }
  }, [api]);

  // O link padrão fica sempre visível: carrega ao abrir a aba (e de novo ao abrir o formulário de campanha).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [open, load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const { ok, data } = await api("/api/admin/b2b/demo-links", { method: "POST", body: { action: "create", campaign, days: noExpiry ? "sem-prazo" : days, maxAccesses, noExpiry } });

      if (!ok) {
        setMessage(data.error ?? "Não foi possível gerar o link.");
        return;
      }

      setCreated({ link: data.link, whatsappUrl: data.whatsappUrl });
      setCampaign("");
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row: LinkRow) {
    if (!window.confirm(`Revogar o link da campanha "${row.campaign}"? Ele deixa de abrir.`)) return;

    const { ok, data } = await api("/api/admin/b2b/demo-links", { method: "POST", body: { action: "revoke", id: row.id } });

    setMessage(ok ? "Link revogado." : (data.error ?? "Erro ao revogar."));
    void load();
  }

  async function reactivateDefault() {
    const { ok, data } = await api("/api/admin/b2b/demo-links", { method: "POST", body: { action: "reactivate-default" } });

    setMessage(ok ? "Link padrão reativado." : (data.error ?? "Erro ao reativar."));
    void load();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Link copiado.");
    } catch {
      setMessage("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4" data-testid="demo-links">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-[#342737]">Modo demonstração</h3>
          <p className="text-xs text-[#7b6a77]">Link de campanha (e-mail): cada pessoa que abrir ganha um vendedor de teste por 24 h, sem comprar nada.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border-2 border-[#342737] px-4 py-2 text-sm font-extrabold text-[#342737]"
        >
          {open ? "Fechar" : "Gerar link de demonstração"}
        </button>
      </div>

      {defaultLink && (
        <div className="mt-4 rounded-2xl border border-[#c9b37e] bg-white p-4" data-testid="demo-link-padrao">
          <p className="text-sm font-extrabold text-[#342737]">Link padrão de demonstração · sem prazo</p>
          <p className="mt-0.5 text-xs text-[#7b6a77]">
            Mande para quem você contratar ou para um representante: ele vê o Catálogo (linhas, preços ao lojista e promoções em vigor) sem cadastro.
            {" "}{defaultLink.accesses} acessos.
          </p>
          <input readOnly value={defaultLink.url} onFocus={(e) => e.target.select()} className={`${field} mt-2`} data-testid="demo-link-padrao-url" />
          {defaultLink.revoked ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#a12b2b]">Revogado: o link não abre.</span>
              <button type="button" onClick={reactivateDefault} className="rounded-full bg-[#342737] px-4 py-2 text-xs font-extrabold text-white">
                Reativar
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(defaultLink.url)} className="rounded-full bg-[#342737] px-4 py-2 text-xs font-extrabold text-white" data-testid="demo-link-padrao-copiar">
                Copiar link
              </button>
              <button type="button" onClick={() => setQrOpen(true)} className="rounded-full border-2 border-[#342737] px-4 py-2 text-xs font-extrabold text-[#342737]" data-testid="demo-link-padrao-qr">
                QR Code
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Conheça a plataforma comercial da Bio Florais (linhas, preços e promoções), sem cadastro: ${defaultLink.url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-extrabold text-white"
              >
                Enviar pelo WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {qrOpen && defaultLink && <QrCodeModal url={defaultLink.url} clientName="Demonstração Bio Florais" onClose={() => setQrOpen(false)} />}

      {open && (
        <div className="mt-4 space-y-4">
          <form onSubmit={create} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
            <label className="text-xs font-bold text-[#7b6a77]">
              Campanha
              <input className={field} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Ex.: Hafidme e-mail 1" required />
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              Validade (dias)
              <input className={field} inputMode="numeric" value={noExpiry ? "" : days} placeholder={noExpiry ? "sem prazo" : ""} disabled={noExpiry} onChange={(e) => setDays(e.target.value)} />
              <span className="mt-1 flex items-center gap-1.5 font-semibold">
                <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} data-testid="demo-sem-prazo" />
                Sem prazo
              </span>
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              Limite de acessos
              <input className={field} inputMode="numeric" value={maxAccesses} onChange={(e) => setMaxAccesses(e.target.value)} placeholder="sem limite" />
            </label>
            <button type="submit" disabled={busy} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
              {busy ? "Gerando…" : "Gerar link"}
            </button>
          </form>

          {created && (
            <div className="rounded-2xl border border-[#c9b37e] bg-[#fffaf0] p-4">
              <p className="text-sm font-extrabold">Link da campanha (aparece só agora)</p>
              <input readOnly value={created.link} onFocus={(e) => e.target.select()} className={`${field} mt-2`} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(created.link)} className="rounded-full bg-[#342737] px-4 py-2 text-xs font-extrabold text-white">
                  Copiar link
                </button>
                <a href={created.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-extrabold text-white">
                  Enviar pelo WhatsApp
                </a>
              </div>
            </div>
          )}

          {message && <p role="status" className="rounded-xl bg-white p-3 text-sm font-bold text-[#342737]">{message}</p>}

          {links.length > 0 && (
            <ul className="space-y-2">
              {links.map((row) => {
                const dead = row.revoked || row.expired || (row.maxAccesses !== null && row.accesses >= row.maxAccesses);

                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                    <span>
                      <strong>{row.campaign}</strong> · {row.noExpiry ? "sem prazo" : `até ${date(row.expiresAt)}`} · {row.accesses}
                      {row.maxAccesses !== null ? `/${row.maxAccesses}` : ""} acessos ·{" "}
                      <span className={dead ? "font-bold text-[#a12b2b]" : "font-bold text-[#1c6b35]"}>
                        {row.revoked ? "revogado" : row.expired ? "expirado" : dead ? "esgotado" : "ativo"}
                      </span>
                    </span>
                    {!row.revoked && !row.expired && (
                      <button type="button" onClick={() => revoke(row)} className="rounded-full border border-[#b33] px-3 py-1 text-xs font-extrabold text-[#b33]">
                        Revogar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
