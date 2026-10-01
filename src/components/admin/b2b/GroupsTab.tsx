"use client";

/**
 * ADMIN B2B — aba "Linhas comerciais": listar, criar e editar (nome,
 * slug, ativa, visível no B2B, ordem e produtos).
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";

import ProductPicker, { type PickerProduct } from "./ProductPicker";
import { useAdminApi } from "./useAdminApi";

type Group = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  b2bVisible: boolean;
  sortOrder: number;
  productIds: string[];
  offers: number;
};

type Draft = {
  id: string | null;
  name: string;
  slug: string;
  active: boolean;
  b2bVisible: boolean;
  sortOrder: number;
  productIds: string[];
};

const EMPTY: Draft = {
  id: null,
  name: "",
  slug: "",
  active: true,
  b2bVisible: true,
  sortOrder: 0,
  productIds: [],
};

const field = "w-full rounded-xl border border-[#eadfd9] bg-white px-3 py-2 text-sm";

export default function GroupsTab() {
  const api = useAdminApi();
  const [groups, setGroups] = useState<Group[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [groupsResult, productsResult] = await Promise.all([
      api("/api/admin/b2b/commercial-groups"),
      api("/api/admin/b2b/products"),
    ]);

    if (groupsResult.ok) setGroups(groupsResult.data.groups ?? []);
    else setMessage(groupsResult.data.error ?? "Erro ao carregar linhas.");

    if (productsResult.ok) setProducts(productsResult.data.products ?? []);
  }, [api]);

  useEffect(() => {
    // Carga inicial vinda da API: o setState só ocorre depois do fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;

    setSaving(true);
    setMessage("");

    try {
      const { ok, data } = await api(
        draft.id ? `/api/admin/b2b/commercial-groups/${draft.id}` : "/api/admin/b2b/commercial-groups",
        {
          method: draft.id ? "PATCH" : "POST",
          body: {
            name: draft.name,
            slug: draft.slug,
            active: draft.active,
            b2bVisible: draft.b2bVisible,
            sortOrder: draft.sortOrder,
            productIds: draft.productIds,
          },
        }
      );

      if (!ok) {
        setMessage(data.error ?? "Erro ao salvar.");
        return;
      }

      setDraft(null);
      setMessage("Linha salva.");
      void load();
    } finally {
      setSaving(false);
    }
  }

  const productName = new Map(products.map((product) => [product.id, product.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#7b6a77]">
          As linhas ativas e visíveis no B2B são as que o vendedor escolhe ao montar a oferta.
        </p>
        {!draft && (
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY, sortOrder: groups.length })}
            className="rounded-full bg-[#342737] px-5 py-2.5 text-sm font-extrabold text-white"
          >
            Nova linha
          </button>
        )}
      </div>

      {message && <p className="rounded-xl bg-[#f6eef7] p-3 text-sm font-semibold">{message}</p>}

      {draft && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#eadfd9] bg-white p-5">
          <h2 className="font-extrabold">{draft.id ? "Editar linha" : "Nova linha"}</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
            <label className="text-xs font-bold text-[#7b6a77]">
              Nome
              <input className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              Slug (vazio = gerado pelo nome)
              <input className={field} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} />
            </label>
            <label className="text-xs font-bold text-[#7b6a77]">
              Ordem
              <input className={field} type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Ativa
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.b2bVisible} onChange={(e) => setDraft({ ...draft, b2bVisible: e.target.checked })} />
              Visível no B2B
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-[#7b6a77]">Produtos da linha</p>
            <ProductPicker
              products={products}
              selectedIds={draft.productIds}
              onChange={(productIds) => setDraft({ ...draft, productIds })}
            />
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
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-[#fbf7f4] text-xs uppercase tracking-wide text-[#7b6a77]">
            <tr>
              <th className="px-4 py-3">Ordem</th>
              <th className="px-4 py-3">Linha</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Produtos</th>
              <th className="px-4 py-3 text-right">Ofertas</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e9e4]">
            {groups.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#7b6a77]">Nenhuma linha cadastrada.</td></tr>
            )}
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="px-4 py-3">{group.sortOrder}</td>
                <td className="px-4 py-3">
                  <p className="font-bold">{group.name}</p>
                  <p className="text-xs text-[#7b6a77]">{group.slug}</p>
                </td>
                <td className="px-4 py-3 text-xs font-bold">
                  {group.active ? "Ativa" : "Inativa"} · {group.b2bVisible ? "visível no B2B" : "oculta no B2B"}
                </td>
                <td className="px-4 py-3 text-xs" title={group.productIds.map((id) => productName.get(id) ?? id).join("\n")}>
                  {group.productIds.length} produto(s)
                </td>
                <td className="px-4 py-3 text-right">{group.offers}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: group.id,
                        name: group.name,
                        slug: group.slug,
                        active: group.active,
                        b2bVisible: group.b2bVisible,
                        sortOrder: group.sortOrder,
                        productIds: group.productIds,
                      })
                    }
                    className="rounded-full border border-[#342737] px-3 py-1 text-xs font-extrabold"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
