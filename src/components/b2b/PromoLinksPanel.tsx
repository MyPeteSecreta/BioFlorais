"use client";

/**
 * "Criar link com promoção" (dentro de "Link geral para divulgar"): o vendedor escolhe UMA promoção ATIVA do admin (ou um kit
 * display), dá um nome, define a validade do link e gera um link próprio (/parceiros?v=<código>&promo=<código curto>). Vários
 * links por vendedor, cada um com Copiar, WhatsApp e QR. O servidor revalida tudo (promoção ativa, elegibilidade liberada).
 */

import { useState } from "react";

import HelpTip from "@/components/b2b/HelpTip";
import QrCodeModal from "@/components/b2b/QrCodeModal";
import { HELP } from "@/lib/b2b/promo-explain";

export type PromoChoice = { value: string; mode: "uses" | "days"; title: string; hint: string; commission: string };
export type PromoOption = {
  id: string;
  name: string;
  label: string;
  priceText: string | null;
  summary: string;
  math: string | null;
  lines: string[];
  kind: "abertura_reconquista" | "recorrente";
  choices: PromoChoice[];
};
export type DisplayOption = { key: string; name: string };
export type PromoLinkView = {
  id: string;
  name: string;
  kind: "promotion" | "display";
  promotionName: string | null;
  displayKey: string | null;
  expiresAt: string | null;
  status: "active" | "expired" | "revoked";
  url: string;
};

const STATUS_TEXT = { active: "Ativo", expired: "Vencido", revoked: "Apagado" } as const;

const brDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export default function PromoLinksPanel({
  promotions,
  displays,
  initialLinks,
}: {
  promotions: PromoOption[];
  displays: DisplayOption[];
  initialLinks: PromoLinkView[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"promotion" | "display">(promotions.length > 0 ? "promotion" : "display");
  const [promotionId, setPromotionId] = useState(promotions[0]?.id ?? "");
  const [displayKey, setDisplayKey] = useState(displays[0]?.key ?? "");
  const [eligibility, setEligibility] = useState("");
  const [validityDays, setValidityDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const promotion = promotions.find((item) => item.id === promotionId) ?? null;
  const eligibilityChoices = promotion?.choices ?? [];
  const chosenEligibility = eligibilityChoices.some((item) => item.value === eligibility) ? eligibility : (eligibilityChoices[0]?.value ?? "");

  async function create() {
    setBusy(true);
    setError(null);

    const [mode, value] = chosenEligibility.split(":");
    const payload =
      kind === "promotion"
        ? { name, kind, promotionId, eligibilityMode: mode, eligibilityValue: Number(value), validityDays: Number(validityDays) }
        : { name, kind, displayKey, validityDays: Number(validityDays) };

    try {
      const response = await fetch("/api/b2b/promo-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Não foi possível criar o link.");
        return;
      }

      setLinks((current) => [data.link as PromoLinkView, ...current]);
      setName("");
      setOpen(false);
    } catch {
      setError("Sem conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Apagar este link? Quem abrir depois verá a loja normal com o aviso de que a promoção terminou.")) return;

    const response = await fetch(`/api/b2b/promo-links?id=${encodeURIComponent(id)}`, { method: "DELETE" });

    if (response.ok) setLinks((current) => current.filter((item) => item.id !== id));
  }

  async function copy(link: PromoLinkView) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(link.id);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mt-5 border-t border-[#eadfd9] pt-4" data-testid="links-com-promocao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-extrabold text-[#422347]">Links com promoção</h4>
          <p className="text-sm text-[#746471]">A loja abre com a promoção aplicada. O lojista novo fica na sua carteira e a comissão segue a regra de sempre.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-[44px] items-center rounded-full bg-[#0b5cad] px-5 text-sm font-extrabold text-white"
          data-testid="criar-link-promocao"
        >
          {open ? "Fechar" : "Criar link com promoção"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm" data-testid="form-link-promocao">
          <label className="grid gap-1 font-bold">
            Nome do link
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="Ex.: Campanha de novembro"
              className="rounded-xl border border-[#eadfd9] bg-white px-3 py-2 font-normal"
              data-testid="link-promocao-nome"
            />
          </label>

          <div className="flex flex-wrap gap-4 font-bold">
            <label className="flex items-center gap-2">
              <input type="radio" checked={kind === "promotion"} disabled={promotions.length === 0} onChange={() => setKind("promotion")} /> Promoção
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={kind === "display"} disabled={displays.length === 0} onChange={() => setKind("display")} /> Kit display
            </label>
          </div>

          {kind === "promotion" ? (
            <>
              <label className="grid gap-1 font-bold">
                Promoção ativa
                <select
                  value={promotionId}
                  onChange={(event) => setPromotionId(event.target.value)}
                  className="rounded-xl border border-[#eadfd9] bg-white px-3 py-2 font-normal"
                  data-testid="link-promocao-promo"
                >
                  {promotions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {promotion && (
                <div className="rounded-2xl border border-[#eadfd9] bg-white p-4" data-testid="promocao-explicada">
                  {promotion.priceText && (
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#9b6c24]">
                      Preço B2B <HelpTip text={HELP.price} />
                      <span className="mt-1 block text-lg font-black normal-case tracking-normal text-[#55245f]">{promotion.priceText}</span>
                    </p>
                  )}
                  <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[#9b6c24]">
                    O que o cliente ganha <HelpTip text={HELP.deal} />
                  </p>
                  <p className="mt-1 text-base font-black text-[#422347]">{promotion.label}</p>
                  <p className="text-sm text-[#422347]">{promotion.summary}</p>
                  {promotion.math && (
                    <p className="mt-2 rounded-xl bg-[#f6eef7] px-3 py-2 font-bold text-[#55245f]" data-testid="conta-pronta">
                      {promotion.math}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#746471]">
                    Vale nas linhas: {promotion.lines.join(", ")}. {promotion.kind === "abertura_reconquista" ? "Para quem nunca comprou a linha ou está há meses sem comprar." : "Vale para qualquer cliente."}
                    <HelpTip text={HELP.opening} />
                  </p>
                </div>
              )}
              <fieldset className="grid gap-2">
                <legend className="font-bold">
                  Por quanto tempo vale para o cliente? <HelpTip text={HELP.duration} />
                </legend>
                <p className="text-xs text-[#746471]">
                  Ao lado de cada opção, quanto você ganha. <HelpTip text={HELP.commission} label="Como funciona a comissão?" />
                </p>
                {eligibilityChoices.map((item) => (
                  <label
                    key={item.value}
                    className={`grid cursor-pointer gap-0.5 rounded-xl border-2 p-3 font-normal ${chosenEligibility === item.value ? "border-blue-600 bg-blue-50" : "border-[#eadfd9] bg-white"}`}
                  >
                    <span className="flex items-center gap-2 font-extrabold">
                      <input type="radio" name="elegibilidade-link" checked={chosenEligibility === item.value} onChange={() => setEligibility(item.value)} data-testid="link-promocao-elegibilidade" />
                      {item.title}
                    </span>
                    <span className="text-xs text-[#746471]">{item.hint}</span>
                    <span className="text-sm font-bold text-[#55245f]" data-testid="comissao-frase">
                      {item.commission}
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          ) : (
            <label className="grid gap-1 font-bold">
              Kit display (grátis na compra do kit completo)
              <select value={displayKey} onChange={(event) => setDisplayKey(event.target.value)} className="rounded-xl border border-[#eadfd9] bg-white px-3 py-2 font-normal">
                {displays.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1 font-bold">
            Validade do link (dias)
            <input
              type="number"
              min={1}
              max={365}
              value={validityDays}
              onChange={(event) => setValidityDays(event.target.value)}
              className="w-32 rounded-xl border border-[#eadfd9] bg-white px-3 py-2 font-normal"
              data-testid="link-promocao-validade"
            />
          </label>

          {error && (
            <p role="alert" className="font-bold text-red-700" data-testid="link-promocao-erro">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={create}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#55245f] px-6 text-sm font-extrabold text-white disabled:opacity-60"
            data-testid="gerar-link-promocao"
          >
            {busy ? "Gerando…" : "Gerar link"}
          </button>
        </div>
      )}

      {links.length > 0 && (
        <ul className="mt-4 grid gap-3" data-testid="lista-links-promocao">
          {links.map((link) => (
            <li key={link.id} className="rounded-2xl border border-[#eadfd9] bg-[#fbf7f4] p-4" data-testid="link-promocao-item">
              <p className="font-extrabold text-[#422347]">{link.name}</p>
              <p className="text-xs text-[#746471]">
                {link.kind === "display" ? "Kit display" : (link.promotionName ?? "Promoção")} · {STATUS_TEXT[link.status]}
                {link.expiresAt ? ` · válido até ${brDate(link.expiresAt)}` : ""}
              </p>
              <input readOnly value={link.url} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-xs" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(link)} className="inline-flex min-h-[40px] items-center rounded-full bg-[#55245f] px-4 text-xs font-extrabold text-white">
                  {copied === link.id ? "Copiado ✓" : "Copiar"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${link.name}: ${link.url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[40px] items-center rounded-full bg-[#1f9d55] px-4 text-xs font-extrabold text-white"
                >
                  WhatsApp
                </a>
                <button type="button" onClick={() => setQrUrl(link.url)} className="inline-flex min-h-[40px] items-center rounded-full bg-[#26352c] px-4 text-xs font-extrabold text-white">
                  QR Code
                </button>
                <button type="button" onClick={() => remove(link.id)} className="inline-flex min-h-[40px] items-center rounded-full border border-red-300 px-4 text-xs font-extrabold text-red-700">
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {qrUrl && <QrCodeModal url={qrUrl} clientName={null} onClose={() => setQrUrl(null)} />}
    </div>
  );
}
