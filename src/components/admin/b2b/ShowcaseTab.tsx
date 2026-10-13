"use client";

/**
 * ADMIN B2B — aba "Mostruário": % do preço de mostruário, janela em dias, grupos (itens que entram,
 * limite por janela, por linha, só menor volume, ativo) e a lista dos pedidos de mostruário.
 * Grupo novo nasce DESATIVADO. Condicionador fica fora de tudo (regra fixa do sistema).
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useAdminApi } from "./useAdminApi";

type Group = {
  id: string | null;
  name: string;
  lineSlugs: string;
  categories: string;
  nameIncludes: string;
  nameExcludes: string;
  limitQty: number;
  perLine: boolean;
  lowestVolumeOnly: boolean;
  active: boolean;
};

type ApiGroup = Omit<Group, "lineSlugs" | "categories" | "nameIncludes" | "nameExcludes"> & {
  lineSlugs: string[];
  categories: string[];
  nameIncludes: string[];
  nameExcludes: string[];
};

type ShowcaseOrder = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  seller: string | null;
  items: number;
  paymentMethod: string | null;
};

const EMPTY: Group = {
  id: null,
  name: "",
  lineSlugs: "",
  categories: "",
  nameIncludes: "",
  nameExcludes: "",
  limitQty: 1,
  perLine: false,
  lowestVolumeOnly: true,
  active: false,
};

const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const toGroup = (group: ApiGroup): Group => ({
  ...group,
  lineSlugs: group.lineSlugs.join(", "),
  categories: group.categories.join(", "),
  nameIncludes: group.nameIncludes.join(", "),
  nameExcludes: group.nameExcludes.join(", "),
});

export default function ShowcaseTab() {
  const api = useAdminApi();
  const [available, setAvailable] = useState(true);
  const [percent, setPercent] = useState("15");
  const [windowDays, setWindowDays] = useState("45");
  const [groups, setGroups] = useState<Group[]>([]);
  const [orders, setOrders] = useState<ShowcaseOrder[]>([]);
  const [draft, setDraft] = useState<Group | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await api("/api/admin/b2b/showcase");

    if (!ok) {
      setMessage(data.error ?? "Erro ao carregar o mostruário.");
      return;
    }

    setAvailable(data.available !== false);
    setPercent(String(data.percent ?? 15));
    setWindowDays(String(data.windowDays ?? 45));
    setGroups(((data.groups ?? []) as ApiGroup[]).map(toGroup));
    setOrders((data.orders ?? []) as ShowcaseOrder[]);
  }, [api]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveSettings() {
    const { ok, data } = await api("/api/admin/b2b/showcase", {
      method: "POST",
      body: { action: "save_settings", percent, windowDays },
    });
    setMessage(ok ? "Percentual e janela salvos." : data.error ?? "Erro ao salvar.");
    if (ok) void load();
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;

    setSaving(true);
    setMessage("");

    try {
      const { ok, data } = await api("/api/admin/b2b/showcase", { method: "POST", body: { action: "save_group", ...draft } });

      if (!ok) {
        setMessage(data.error ?? "Erro ao salvar o grupo.");
        return;
      }

      setDraft(null);
      setMessage("Grupo salvo.");
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(group: Group) {
    const { ok, data } = await api("/api/admin/b2b/showcase", {
      method: "POST",
      body: { action: "save_group", ...group, active: !group.active },
    });
    setMessage(ok ? (group.active ? "Grupo desativado." : "Grupo ativado.") : data.error ?? "Erro ao salvar.");
    if (ok) void load();
  }

  async function remove(group: Group) {
    if (!group.id || !window.confirm(`Excluir o grupo "${group.name}"? Os itens dele deixam de estar disponíveis no mostruário.`)) return;
    const { ok, data } = await api("/api/admin/b2b/showcase", { method: "POST", body: { action: "delete_group", id: group.id } });
    setMessage(ok ? "Grupo excluído." : data.error ?? "Erro ao excluir.");
    if (ok) void load();
  }

  return (
    <div className="space-y-5" data-testid="showcase-tab">
      <p className="max-w-3xl text-sm text-[#7b6a77]">
        Mostruário do vendedor/RCA: loja interna só com os itens liberados abaixo, em preço de mostruário (percentual do
        preço B2C, arredondado em &quot;reais + 0,90&quot;). Item que não está em nenhum grupo ativo fica indisponível, e{" "}
        <strong>linha nova entra desativada</strong>. Condicionador fica fora de tudo. Frete sempre pela tarifa regional
        especial; sem mínimo, sem cupom e sem comissão.
      </p>

      {!available && (
        <p className="rounded-xl bg-[#fff4e5] p-3 text-sm font-semibold">
          O SQL 39b ainda não foi aplicado: rode o 39a (preflight) e depois o 39b no Neon para usar o mostruário.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#eadfd9] bg-white p-4">
        <label className="text-xs font-bold text-[#7b6a77]">
          Preço de mostruário (% do preço B2C)
          <input className={`${field} w-36`} inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-[#7b6a77]">
          Janela móvel (dias)
          <input className={`${field} w-28`} type="number" min={1} max={365} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} />
        </label>
        <button type="button" onClick={saveSettings} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white">
          Salvar
        </button>
        <p className="max-w-md text-xs text-[#7b6a77]">
          Padrão Bio: 15% e 45 dias. O vendedor só repete um grupo depois da janela contada da compra anterior.
        </p>
      </div>

      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-extrabold text-[#342737]">Grupos do mostruário</h2>
        {!draft && (
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="rounded-full border-2 border-[#342737] px-5 py-2 text-sm font-extrabold text-[#342737]"
          >
            Novo grupo
          </button>
        )}
      </div>

      {draft && (
        <form onSubmit={saveGroup} className="space-y-3 rounded-2xl border border-[#eadfd9] bg-white p-5">
          <h3 className="font-extrabold">{draft.id ? "Editar grupo" : "Novo grupo (nasce desativado)"}</h3>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Nome do grupo
            <input className={field} maxLength={80} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Linhas que entram (códigos separados por vírgula: adulto, pet, cosmeticos, cosmeticos-pet…)
            <input className={field} value={draft.lineSlugs} onChange={(e) => setDraft({ ...draft, lineSlugs: e.target.value })} />
          </label>
          <label className="block text-xs font-bold text-[#7b6a77]">
            Categorias que entram (ex.: Shampoo, Creme Mãos, Perfume Spray)
            <input className={field} value={draft.categories} onChange={(e) => setDraft({ ...draft, categories: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-[#7b6a77]">
              Nome contém (qualquer um; opcional)
              <input className={field} value={draft.nameIncludes} onChange={(e) => setDraft({ ...draft, nameIncludes: e.target.value })} />
            </label>
            <label className="block text-xs font-bold text-[#7b6a77]">
              Nome NÃO contém (opcional)
              <input className={field} value={draft.nameExcludes} onChange={(e) => setDraft({ ...draft, nameExcludes: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs font-bold text-[#7b6a77]">
              Limite por janela (unidades)
              <input
                className={`${field} w-32`}
                type="number"
                min={0}
                max={99}
                value={draft.limitQty}
                onChange={(e) => setDraft({ ...draft, limitQty: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={draft.perLine} onChange={(e) => setDraft({ ...draft, perLine: e.target.checked })} />
              Limite por LINHA (cada linha tem a sua cota)
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={draft.lowestVolumeOnly}
                onChange={(e) => setDraft({ ...draft, lowestVolumeOnly: e.target.checked })}
              />
              Só o menor volume
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Ativo
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar grupo"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-[#eadfd9] px-5 py-2.5 text-sm font-extrabold">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#eadfd9] bg-white p-6 text-center text-sm text-[#7b6a77]">
          Nenhum grupo cadastrado: o mostruário fica vazio até você criar e ativar grupos.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id} className="rounded-2xl border border-[#eadfd9] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-extrabold text-[#342737]">{group.name}</p>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                    group.active ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {group.active ? "ativo" : "desativado"}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#7b6a77]">
                Limite <strong>{group.limitQty}</strong>
                {group.perLine ? " por linha" : " no grupo"} · {group.lowestVolumeOnly ? "só menor volume" : "todos os volumes"}
              </p>
              <p className="mt-1 text-xs text-[#7b6a77]">
                Linhas: {group.lineSlugs || "—"} · Categorias: {group.categories || "—"}
                {group.nameIncludes ? ` · contém: ${group.nameIncludes}` : ""}
                {group.nameExcludes ? ` · sem: ${group.nameExcludes}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setDraft({ ...group })} className="rounded-full border border-[#342737] px-3 py-1 text-xs font-extrabold">
                  Editar
                </button>
                <button type="button" onClick={() => toggle(group)} className="rounded-full border border-[#eadfd9] px-3 py-1 text-xs font-extrabold">
                  {group.active ? "Desativar" : "Ativar"}
                </button>
                <button type="button" onClick={() => remove(group)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-extrabold text-red-700">
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="font-extrabold text-[#342737]">Pedidos de mostruário</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-[#7b6a77]">Nenhum pedido de mostruário ainda.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-2xl border border-[#eadfd9] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#faf6f2] text-xs uppercase text-[#7b6a77]">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Itens</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Pedido</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-[#f0e8e3]">
                    <td className="px-3 py-2">{new Date(order.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                    <td className="px-3 py-2 font-bold">{order.seller ?? "—"}</td>
                    <td className="px-3 py-2">{order.items}</td>
                    <td className="px-3 py-2">{money(order.totalCents)}</td>
                    <td className="px-3 py-2">{order.status === "paid" ? "Pago" : order.status === "pending" ? "Aguardando pagamento" : order.status}</td>
                    <td className="px-3 py-2">
                      <a href={`/admin/pedidos/${order.id}`} className="font-bold text-[#55245f] underline">
                        abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
