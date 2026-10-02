"use client";

/**
 * BIO FLORAIS B2B — Offer Builder (padrão My Pet, Especificação V1.29 §47/§48).
 *
 * - Cards reais das linhas da Home B2C; check circular no canto superior
 *   esquerdo; linha não selecionada esmaecida (quase marca-d'água).
 * - "Ver promoções" (canto superior direito, só em linha com promoção)
 *   abre MODAL: preço B2B normal + promoções da linha. Escolher promoção
 *   expande as elegibilidades CONFIGURADAS no banco (1x/2x/3x compras ou
 *   30/60/90/180 dias). Sem campo livre, sem "compras + prazo".
 * - Toda alternativa mostra "comissão-base + extra = total" (matriz lida
 *   de b2b_commission_rules; nada hard-coded). O cliente nunca vê isso.
 * - "Salvar esta condição": promoção salva = moldura azul; preço normal =
 *   selecionado sem moldura.
 * - "Salvar e revisar oferta →": grava o rascunho e abre a revisão
 *   obrigatória. O link só é gerado depois da revisão.
 */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  commissionFor,
  eligibilityOptions,
  formatPercent,
  promotionShortLabel,
  type CommissionMatrix,
  type EligibilityMode,
} from "@/lib/b2b/commission";
import type { BuilderLine, BuilderPromotion } from "@/lib/b2b/offer-builder";

export type BuilderChoice = {
  promotionId: string;
  eligibilityMode: EligibilityMode;
  maxUses: number | null;
  durationDays: number | null;
};

type DraftModalChoice = {
  promotionId: string;
  eligibilityMode: EligibilityMode | null;
  maxUses: number | null;
  durationDays: number | null;
} | null;

type Props = {
  clientId: string;
  clientName: string;
  responsibleName: string;
  offerId: string | null;
  lines: BuilderLine[];
  matrix: CommissionMatrix;
  /** Janela de 180 dias da comissão do preço normal, por linha (texto pronto, só vendedor). */
  windowTextByLine: Record<string, string>;
  initialSelected: string[];
  initialChoices: Record<string, BuilderChoice>;
};

function CommissionBadge({
  matrix,
  extraPercent,
  compact = false,
}: {
  matrix: CommissionMatrix;
  extraPercent: number | null;
  compact?: boolean;
}) {
  if (!matrix.configured || extraPercent === null) {
    return (
      <div className="rounded-2xl bg-[#f3eef2] px-4 py-2 text-xs font-bold text-[#7b6a77]">
        Comissão não configurada
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-[#342737] text-white ${compact ? "px-3 py-2" : "px-5 py-3"}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/60">Sua comissão</p>
      <p className="mt-0.5 text-sm font-bold">
        {formatPercent(matrix.basePercent)} + {formatPercent(extraPercent)}
      </p>
      <p className={`${compact ? "text-base" : "text-xl"} font-black`}>
        = {formatPercent(matrix.basePercent + extraPercent)}
      </p>
    </div>
  );
}

const PROMOTION_GROUPS: Array<{ type: "abertura_reconquista" | "recorrente"; title: string }> = [
  { type: "abertura_reconquista", title: "Promoção de abertura / reconquista" },
  { type: "recorrente", title: "Promoção para cliente recorrente" },
];

function promotionScopeText(promotion: BuilderPromotion) {
  return promotion.onlyProducts.length > 0
    ? `Somente ${promotion.onlyProducts.map((product) => product.name).join(", ")}`
    : "Linha inteira";
}

function choiceLabel(line: BuilderLine, choice: BuilderChoice) {
  const promotion = line.promotions.find((item) => item.id === choice.promotionId);
  const label = promotion ? promotionShortLabel(promotion.buyQuantity, promotion.freeQuantity) : "Promoção";
  const eligibility =
    choice.eligibilityMode === "uses"
      ? `${choice.maxUses} compra${choice.maxUses === 1 ? "" : "s"}`
      : `${choice.durationDays} dias`;
  return `${label} · ${eligibility}`;
}

export default function OfferBuilder({
  clientId,
  clientName,
  responsibleName,
  offerId,
  lines,
  matrix,
  windowTextByLine,
  initialSelected,
  initialChoices,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [choices, setChoices] = useState<Record<string, BuilderChoice>>(initialChoices);
  const [modalLineId, setModalLineId] = useState<string | null>(null);
  const [draftChoice, setDraftChoice] = useState<DraftModalChoice>(null);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const modalLine = useMemo(
    () => lines.find((line) => line.id === modalLineId) ?? null,
    [lines, modalLineId]
  );

  // Só conta linha que existe na tela (id antigo de rascunho não entra).
  const selectedCount = lines.filter((line) => selected.has(line.id)).length;

  const normalCommission = commissionFor(matrix, { kind: "normal" });

  function toggleLine(lineId: string) {
    const wasSelected = selected.has(lineId);
    const nextSelected = new Set(selected);

    if (wasSelected) nextSelected.delete(lineId);
    else nextSelected.add(lineId);

    setSelected(nextSelected);

    // Tirar a linha da oferta descarta a condição promocional dela.
    if (wasSelected) {
      setChoices((current) => {
        const next = { ...current };
        delete next[lineId];
        return next;
      });
    }
  }

  function openPromotions(line: BuilderLine) {
    setModalLineId(line.id);
    setModalError("");
    const saved = choices[line.id];
    setDraftChoice(saved ? { ...saved } : null);
  }

  function closeModal() {
    setModalLineId(null);
    setDraftChoice(null);
    setModalError("");
  }

  function saveModalCondition() {
    if (!modalLine) return;

    if (draftChoice && !draftChoice.eligibilityMode) {
      setModalError("Escolha por número de compras ou por período.");
      return;
    }

    const lineId = modalLine.id;
    const saved =
      draftChoice && draftChoice.eligibilityMode ? (draftChoice as BuilderChoice) : null;

    // Salvar a condição também inclui a linha na oferta.
    setSelected((current) => new Set(current).add(lineId));
    setChoices((current) => {
      const next = { ...current };
      if (saved) next[lineId] = saved;
      else delete next[lineId];
      return next;
    });
    closeModal();
  }

  async function saveAndReview() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/b2b/offers/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          offerId,
          commercialGroupIds: lines.filter((line) => selected.has(line.id)).map((line) => line.id),
          promotions: Object.entries(choices)
            .filter(([lineId]) => lines.some((line) => line.id === lineId) && selected.has(lineId))
            .map(([commercialGroupId, choice]) => ({ commercialGroupId, ...choice })),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.offerId) {
        setError(data.error ?? "Erro ao salvar a oferta.");
        return;
      }

      router.push(`/b2b/painel/cliente/${clientId}/oferta/revisao?offerId=${data.offerId}`);
    } catch {
      setError("Erro ao salvar a oferta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">
          Área comercial B2B
        </span>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#55245f] md:text-5xl">Escolha as linhas</h1>
        <p className="mx-auto mt-4 max-w-2xl text-[#746471]">
          Marque as linhas que o cliente poderá acessar. Nas linhas com condição especial, clique em Ver
          promoções.
        </p>
        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-2 rounded-full border border-[#eadfd9] bg-white px-5 py-2.5 text-sm shadow-sm">
          <strong>{clientName}</strong>
          <span>·</span>
          <span>
            Atendido por <strong>{responsibleName}</strong>
          </span>
        </div>
      </div>

      {!matrix.configured && (
        <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          As regras de comissão ainda não foram configuradas no banco. As linhas podem ser oferecidas
          pelo preço B2B normal; as promoções ficam disponíveis assim que a matriz de comissão existir.
        </p>
      )}

      {lines.length === 0 ? (
        <p className="mt-10 rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
          Nenhuma linha B2B ativa no momento.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {lines.map((line) => {
            const isSelected = selected.has(line.id);
            const choice = choices[line.id];
            const promotionSaved = isSelected && Boolean(choice);
            const pointPromotion = line.promotions.find((promotion) => promotion.onlyProducts.length > 0);

            return (
              <article
                key={line.id}
                className={[
                  "group relative overflow-hidden rounded-[28px] border border-[#eadfda] bg-white transition duration-300",
                  isSelected
                    ? "opacity-100 shadow-[0_22px_50px_rgba(61,35,65,0.15)]"
                    : "opacity-40 grayscale shadow-sm hover:opacity-70",
                  promotionSaved ? "ring-[5px] ring-blue-500 ring-offset-2 ring-offset-[#fffaf6]" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => toggleLine(line.id)}
                  aria-pressed={isSelected}
                  aria-label={isSelected ? `Remover ${line.name}` : `Selecionar ${line.name}`}
                  className={[
                    "absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white shadow-lg transition",
                    isSelected ? "bg-[#55245f] text-white" : "bg-white/95 text-transparent",
                  ].join(" ")}
                >
                  {isSelected ? <span className="text-xl font-black">✓</span> : null}
                </button>

                {line.promotions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openPromotions(line)}
                    className="absolute right-4 top-4 z-20 rounded-full border-2 border-white bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700"
                  >
                    {promotionSaved ? "Promoção escolhida ✓" : "Ver promoções"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => toggleLine(line.id)}
                  className="block w-full text-left"
                  aria-label={line.name}
                >
                  {line.image ? (
                    <Image
                      src={line.image}
                      alt={`Bio Florais ${line.name}`}
                      width={1672}
                      height={941}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="h-auto w-full bg-[#fffaf6] transition duration-500 group-hover:scale-[1.012]"
                    />
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-[#fbf5f1] p-8">
                      <strong className="font-serif text-3xl text-[#55245f]">{line.name}</strong>
                    </div>
                  )}
                </button>

                {promotionSaved && choice && (
                  <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20">
                    <span className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg">
                      Condição promocional: {choiceLabel(line, choice)}
                    </span>
                  </div>
                )}

                {!promotionSaved && pointPromotion && (
                  <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[280px] rounded-2xl border border-white/70 bg-amber-50/95 px-4 py-2 text-right shadow-lg">
                    <p className="text-[11px] font-extrabold leading-tight text-amber-950">
                      Promoções somente em {pointPromotion.onlyProducts.map((product) => product.name).join(", ")}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</p>
      )}

      <div className="sticky bottom-4 z-30 mt-10 rounded-[28px] border border-[#eadfd9] bg-white/95 px-6 py-5 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-extrabold">{selectedCount} {selectedCount === 1 ? "linha selecionada" : "linhas selecionadas"}</p>
            <p className="mt-1 text-sm text-[#746471]">
              Você revisa as condições antes de gerar qualquer link para o cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={saveAndReview}
            disabled={saving || selectedCount === 0}
            className="rounded-full bg-[#55245f] px-8 py-4 font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Salvando…" : "Salvar e revisar oferta →"}
          </button>
        </div>
      </div>

      {modalLine && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#342737]/55 p-4 backdrop-blur-sm"
          onMouseDown={closeModal}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Promoções de ${modalLine.name}`}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-[#fffaf6] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#eadfd9] bg-white/95 px-6 py-5 backdrop-blur sm:px-8">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#9b6c24]">Condição comercial</p>
                <h2 className="mt-1 font-serif text-3xl font-semibold text-[#55245f]">{modalLine.name}</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6eef7] text-xl font-black text-[#55245f]"
              >
                ×
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {modalLine.promotions.some((promotion) => promotion.onlyProducts.length > 0) && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-extrabold text-amber-950">Promoção pontual por produto</p>
                  <p className="mt-1 text-sm text-amber-900">
                    As promoções desta linha valem somente para os produtos indicados. Os demais
                    produtos da linha continuam pelo preço B2B normal.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setDraftChoice(null);
                  setModalError("");
                }}
                className={[
                  "w-full rounded-[24px] border-2 p-5 text-left transition",
                  draftChoice === null ? "border-[#55245f] bg-[#f6eef7]" : "border-[#eadfd9] bg-white hover:border-[#c9a8cf]",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xl font-extrabold">Preço B2B normal</p>
                    <p className="mt-1 text-sm text-[#746471]">Sem promoção de quantidade.</p>
                    {windowTextByLine[modalLine.id] && (
                      <p className="mt-2 text-xs font-semibold text-[#55245f]">{windowTextByLine[modalLine.id]}</p>
                    )}
                  </div>
                  <CommissionBadge matrix={matrix} extraPercent={normalCommission?.extraPercent ?? null} />
                </div>
              </button>

              {PROMOTION_GROUPS.map((group) => {
                const groupPromotions = modalLine.promotions.filter((promotion) => promotion.promoType === group.type);
                if (groupPromotions.length === 0) return null;

                return (
                <div key={group.type} className="mt-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#9b6c24]">{group.title}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {groupPromotions.map((promotion) => {
                  const active = draftChoice?.promotionId === promotion.id;
                  const options = eligibilityOptions(matrix, promotion.id);
                  const hasRules = options.uses.length + options.days.length > 0;

                  return (
                    <button
                      type="button"
                      key={promotion.id}
                      disabled={!hasRules || !promotion.available}
                      onClick={() => {
                        setModalError("");
                        setDraftChoice({ promotionId: promotion.id, eligibilityMode: null, maxUses: null, durationDays: null });
                      }}
                      className={[
                        "rounded-[24px] border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                        active ? "border-blue-500 bg-blue-50" : "border-[#eadfd9] bg-white hover:border-blue-300",
                      ].join(" ")}
                    >
                      <p className="text-2xl font-black">{active ? "✓ " : ""}{promotionShortLabel(promotion.buyQuantity, promotion.freeQuantity)}</p>
                      <p className="mt-2 text-sm font-bold text-blue-700">{promotionScopeText(promotion)}</p>
                      <p className="mt-3 text-sm text-[#746471]">
                        Compre <strong>{promotion.buyQuantity}</strong> e ganhe <strong>{promotion.freeQuantity}</strong> do mesmo produto.
                      </p>
                      {promotion.reason && (
                        <p className={`mt-2 text-xs font-bold ${promotion.available ? "text-emerald-700" : "text-[#b33]"}`}>
                          {promotion.reason}
                        </p>
                      )}
                      {!hasRules && (
                        <p className="mt-2 text-xs font-bold text-[#b33]">Sem regra de comissão configurada.</p>
                      )}
                    </button>
                  );
                })}
                </div>
                </div>
                );
              })}

              {draftChoice && (() => {
                const promotion = modalLine.promotions.find((item) => item.id === draftChoice.promotionId);
                if (!promotion) return null;
                const options = eligibilityOptions(matrix, promotion.id);

                const option = (
                  mode: EligibilityMode,
                  value: number,
                  extraPercent: number,
                  label: string
                ) => {
                  const isActive =
                    draftChoice.eligibilityMode === mode &&
                    (mode === "uses" ? draftChoice.maxUses === value : draftChoice.durationDays === value);

                  return (
                    <button
                      type="button"
                      key={`${mode}-${value}`}
                      onClick={() => {
                        setModalError("");
                        setDraftChoice({
                          promotionId: promotion.id,
                          eligibilityMode: mode,
                          maxUses: mode === "uses" ? value : null,
                          durationDays: mode === "days" ? value : null,
                        });
                      }}
                      className={[
                        "rounded-2xl border-2 p-4 text-left transition",
                        isActive ? "border-blue-600 bg-blue-600 text-white" : "border-[#eadfd9] bg-[#fffaf6]",
                      ].join(" ")}
                    >
                      <p className="text-lg font-black">{isActive ? "✓ " : ""}{label}</p>
                      <p className="mt-2 text-xs">Comissão</p>
                      <p className="mt-1 text-sm font-bold">
                        {formatPercent(matrix.basePercent)} + {formatPercent(extraPercent)}
                      </p>
                      <p className="mt-1 text-lg font-black">= {formatPercent(matrix.basePercent + extraPercent)}</p>
                    </button>
                  );
                };

                return (
                  <div className="mt-6 rounded-[26px] border border-blue-200 bg-white p-5 sm:p-6">
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-blue-700">Configure a promoção</p>
                    <h3 className="mt-1 text-xl font-extrabold">Escolha a elegibilidade</h3>

                    {options.uses.length > 0 && (
                      <div className="mt-5">
                        <p className="font-extrabold">Por número de compras</p>
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          {options.uses.map((rule) =>
                            option("uses", rule.maxUses!, rule.extraPercent, `${rule.maxUses}x`)
                          )}
                        </div>
                      </div>
                    )}

                    {options.days.length > 0 && (
                      <div className="mt-6">
                        <p className="font-extrabold">Por período</p>
                        <p className="mt-1 text-sm text-[#746471]">Compras ilimitadas durante o período, a partir da geração do link.</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {options.days.map((rule) =>
                            option("days", rule.durationDays!, rule.extraPercent, `${rule.durationDays} dias`)
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {modalError && <p className="mt-4 text-sm font-bold text-red-700">{modalError}</p>}
            </div>

            <div className="sticky bottom-0 border-t border-[#eadfd9] bg-white/95 px-6 py-5 backdrop-blur sm:px-8">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border-2 border-[#55245f]/20 bg-white px-6 py-3.5 font-bold text-[#55245f]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveModalCondition}
                  className="rounded-full bg-blue-600 px-7 py-3.5 font-extrabold text-white shadow-lg transition hover:bg-blue-700"
                >
                  Salvar esta condição
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
