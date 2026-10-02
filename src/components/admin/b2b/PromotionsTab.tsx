"use client";

/**
 * ADMIN B2B — aba "Promoções": "compre X, leve Y grátis" (único tipo com
 * efeito no servidor da Bio). Vincular a linhas e/ou produtos, ativa,
 * selecionável pelo vendedor, início/fim (calendário de São Paulo).
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { toSaoPauloDateInput } from "@/lib/b2b/admin-input";
import ProductPicker, { type PickerProduct } from "./ProductPicker";
import { useAdminApi } from "./useAdminApi";

type Promotion = {
  id: string;
  name: string;
  type: string;
  promoType: "abertura_reconquista" | "recorrente";
  supported: boolean;
  buyQuantity: number | null;
  freeQuantity: number | null;
  active: boolean;
  sellerSelectable: boolean;
  startsAt: string | null;
  endsAt: string | null;
  groupIds: string[];
  productIds: string[];
  offers: number;
  uses: number;
};

type Group = { id: string; name: string; active: boolean; b2bVisible: boolean };

type Draft = {
  id: string | null;
  name: string;
  promoType: "" | "abertura_reconquista" | "recorrente";
  buyQuantity: number;
  freeQuantity: number;
  active: boolean;
  sellerSelectable: boolean;
  startsAt: string;
  endsAt: string;
  groupIds: string[];
  productIds: string[];
};

const EMPTY: Draft = {
  id: null,
  name: "",
  promoType: "",
  buyQuantity: 3,
  freeQuantity: 1,
  active: true,
  sellerSelectable: true,
  startsAt: "",
  endsAt: "",
  groupIds: [],
  productIds: [],
};

const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";

function period(promotion: Promotion) {
  const start = toSaoPauloDateInput(promotion.startsAt);
  const end = toSaoPauloDateInput(promotion.endsAt);
  const fmt = (value: string) => value.split("-").reverse().join("/");
  if (!start && !end) return "Sem prazo";
  if (start && end) return `${fmt(start)} a ${fmt(end)}`;
  return start ? `A partir de ${fmt(start)}` : `Até ${fmt(end)}`;
}

export default function PromotionsTab() {
  const api = useAdminApi();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reconquistaMeses, setReconquistaMeses] = useState(6);

  const load = useCallback(async () => {
    const [promotionsResult, groupsResult, productsResult] = await Promise.all([
      api("/api/admin/b2b/promotions"),
      api("/api/admin/b2b/commercial-groups"),
      api("/api/admin/b2b/products"),
    ]);

    if (promotionsResult.ok) setPromotions(promotionsResult.data.promotions ?? []);
    else setMessage(promotionsResult.data.error ?? "Erro ao carregar promoções.");
    if (groupsResult.ok) setGroups(groupsResult.data.groups ?? []);
    if (productsResult.ok) setProducts(productsResult.data.products ?? []);

    const settingsResult = await api("/api/admin/b2b/settings");
    if (settingsResult.ok) setReconquistaMeses(Number(settingsResult.data.reconquistaMeses) || 6);
  }, [api]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveMonths() {
    const { ok, data } = await api("/api/admin/b2b/settings", { method: "PUT", body: { reconquistaMeses } });
    setMessage(ok ? `Reconquista: ${data.reconquistaMeses} meses sem comprar a linha.` : data.error ?? "Erro ao salvar.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;

    setSaving(true);
    setMessage("");

    try {
      const { ok, data } = await api(
        draft.id ? `/api/admin/b2b/promotions/${draft.id}` : "/api/admin/b2b/promotions",
        {
          method: draft.id ? "PATCH" : "POST",
          body: {
            name: draft.name,
            promoType: draft.promoType,
            buyQuantity: draft.buyQuantity,
            freeQuantity: draft.freeQuantity,
            active: draft.active,
            sellerSelectable: draft.sellerSelectable,
            startsAt: draft.startsAt,
            endsAt: draft.endsAt,
            groupIds: draft.groupIds,
            productIds: draft.productIds,
          },
        }
      );

      if (!ok) {
        setMessage(data.error ?? "Erro ao salvar.");
        return;
      }

      setDraft(null);
      setMessage("Promoção salva.");
      void load();
    } finally {
      setSaving(false);
    }
  }

  const groupName = new Map(groups.map((group) => [group.id, group.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[#7b6a77]">
          Tipo disponível: <strong>compre X, leve Y grátis</strong> (mesmo produto), o único com
          efeito real no cálculo do servidor. Sem produtos nem linhas selecionados, a promoção
          vale para todos os produtos da oferta.
        </p>
        {!draft && (
          <button type="button" onClick={() => setDraft({ ...EMPTY })} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white">
            Nova promoção
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#eadfd9] bg-white p-4 text-sm">
        <label className="text-xs font-bold text-[#7b6a77]">
          Reconquista: meses sem comprar a linha
          <input className={`${field} w-32`} type="number" min={1} max={60} value={reconquistaMeses} onChange={(e) => setReconquistaMeses(Number(e.target.value))} />
        </label>
        <button type="button" onClick={saveMonths} className="rounded-full border border-[#342737] px-4 py-2 text-xs font-extrabold">
          Salvar
        </button>
        <p className="max-w-xl text-xs text-[#7b6a77]">
          Vale para a promoção de abertura / reconquista e para o início de um novo ciclo de 180 dias na linha.
        </p>
      </div>

      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

      {draft && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#eadfd9] bg-white p-5">
          <h2 className="font-extrabold">{draft.id ? "Editar promoção" : "Nova promoção"}</h2>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Tipo da promoção (obrigatório)
            <select className={field} value={draft.promoType} required onChange={(e) => setDraft({ ...draft, promoType: e.target.value as Draft["promoType"] })}>
              <option value="">Escolha…</option>
              <option value="abertura_reconquista">Abertura / reconquista: só cliente que nunca comprou a linha ou está há {reconquistaMeses}+ meses sem comprar</option>
              <option value="recorrente">Recorrente: qualquer cliente B2B (ex.: Black Friday)</option>
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_140px_140px]">
            <label className="text-xs font-bold text-[#7b6a77]">
              Nome
              <input className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              A cada (pagas)
              <input className={field} type="number" min={1} value={draft.buyQuantity} onChange={(e) => setDraft({ ...draft, buyQuantity: Number(e.target.value) })} />
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              Ganha (grátis)
              <input className={field} type="number" min={1} value={draft.freeQuantity} onChange={(e) => setDraft({ ...draft, freeQuantity: Number(e.target.value) })} />
            </label>
          </div>
          <p className="text-xs text-[#7b6a77]">
            Exemplo: a cada {draft.buyQuantity || "X"} unidades pagas de um produto, o cliente leva
            mais {draft.freeQuantity || "Y"} do mesmo produto sem custo.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-bold text-[#7b6a77]">
              Início (opcional)
              <input className={field} type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              Fim (opcional, inclui o dia todo)
              <input className={field} type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Ativa
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.sellerSelectable} onChange={(e) => setDraft({ ...draft, sellerSelectable: e.target.checked })} />
              Selecionável pelo vendedor
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-[#7b6a77]">Linhas (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 rounded-full border border-[#eadfd9] px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.groupIds.includes(group.id)}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        groupIds: draft.groupIds.includes(group.id)
                          ? draft.groupIds.filter((id) => id !== group.id)
                          : [...draft.groupIds, group.id],
                      })
                    }
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-[#7b6a77]">
              Produtos específicos (opcional — se marcar, têm prioridade sobre as linhas)
            </p>
            <ProductPicker products={products} selectedIds={draft.productIds} onChange={(productIds) => setDraft({ ...draft, productIds })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-[#eadfd9] px-5 py-2.5 text-sm font-bold">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#eadfd9] bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
            <tr>
              <th className="px-4 py-3">Promoção</th>
              <th className="px-4 py-3">Regra</th>
              <th className="px-4 py-3">Vale para</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Ofertas / usos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e9e4]">
            {promotions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[#7b6a77]">Nenhuma promoção cadastrada.</td></tr>
            )}
            {promotions.map((promotion) => (
              <tr key={promotion.id} className={promotion.supported ? "" : "opacity-60"}>
                <td className="px-4 py-3 font-bold">{promotion.name}</td>
                <td className="px-4 py-3 text-xs">
                  {promotion.supported
                    ? `A cada ${promotion.buyQuantity}, +${promotion.freeQuantity} grátis`
                    : `Tipo "${promotion.type}" — sem efeito na Bio`}
                </td>
                <td className="px-4 py-3 text-xs">
                  {promotion.productIds.length > 0
                    ? `${promotion.productIds.length} produto(s)`
                    : promotion.groupIds.length > 0
                      ? promotion.groupIds.map((id) => groupName.get(id) ?? "?").join(", ")
                      : "Todos os produtos da oferta"}
                </td>
                <td className="px-4 py-3 text-xs">{period(promotion)}</td>
                <td className="px-4 py-3 text-xs font-bold">
                  {promotion.promoType === "recorrente" ? "Recorrente" : "Abertura / reconquista"} ·{" "}
                  {promotion.active ? "Ativa" : "Inativa"}
                  {promotion.sellerSelectable ? " · selecionável" : " · oculta ao vendedor"}
                </td>
                <td className="px-4 py-3 text-right">{promotion.offers} / {promotion.uses}</td>
                <td className="px-4 py-3 text-right">
                  {promotion.supported && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          id: promotion.id,
                          name: promotion.name,
                          promoType: promotion.promoType,
                          buyQuantity: promotion.buyQuantity ?? 1,
                          freeQuantity: promotion.freeQuantity ?? 1,
                          active: promotion.active,
                          sellerSelectable: promotion.sellerSelectable,
                          startsAt: toSaoPauloDateInput(promotion.startsAt),
                          endsAt: toSaoPauloDateInput(promotion.endsAt),
                          groupIds: promotion.groupIds,
                          productIds: promotion.productIds,
                        })
                      }
                      className="rounded-full border border-[#342737] px-3 py-1 text-xs font-extrabold"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
