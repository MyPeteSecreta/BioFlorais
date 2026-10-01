"use client";

import { useMemo, useState } from "react";

export type PickerProduct = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  priceCents: number;
  active: boolean;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Seleção de produtos por categoria e por busca (nome ou slug). */
export default function ProductPicker({
  products,
  selectedIds,
  onChange,
}: {
  products: PickerProduct[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category ?? "Sem categoria"))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [products]
  );

  const filtered = useMemo(() => {
    const term = normalize(query.trim());

    return products.filter(
      (product) =>
        (!category || (product.category ?? "Sem categoria") === category) &&
        (!term || normalize(`${product.name} ${product.slug}`).includes(term)) &&
        (!onlySelected || selected.has(product.id))
    );
  }, [products, category, query, onlySelected, selected]);

  function toggle(id: string) {
    onChange(selected.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function setFiltered(checked: boolean) {
    const ids = new Set(selectedIds);
    for (const product of filtered) {
      if (checked) ids.add(product.id);
      else ids.delete(product.id);
    }
    onChange(Array.from(ids));
  }

  return (
    <div className="rounded-xl border border-[#eadfd9]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#eadfd9] bg-[#fbf7f4] p-3">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-lg border border-[#eadfd9] bg-white px-2 py-1.5 text-sm"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {categories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar produto…"
          className="min-w-[180px] flex-1 rounded-lg border border-[#eadfd9] bg-white px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1 text-xs font-bold">
          <input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} />
          Só selecionados
        </label>
        <button type="button" onClick={() => setFiltered(true)} className="rounded-full border border-[#342737] px-3 py-1 text-xs font-extrabold">
          Marcar {filtered.length} filtrados
        </button>
        <button type="button" onClick={() => setFiltered(false)} className="rounded-full border border-[#b33] px-3 py-1 text-xs font-extrabold text-[#b33]">
          Desmarcar filtrados
        </button>
        <span className="text-xs font-bold text-[#7b6a77]">{selectedIds.length} selecionado(s)</span>
      </div>

      <ul className="max-h-72 divide-y divide-[#f1e9e4] overflow-y-auto">
        {filtered.map((product) => (
          <li key={product.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[#fffaf6]">
              <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggle(product.id)} />
              <span className="flex-1">
                {product.name}
                {!product.active && <span className="ml-2 text-xs font-bold text-[#b33]">(inativo)</span>}
              </span>
              <span className="text-xs text-[#7b6a77]">{product.category ?? "Sem categoria"}</span>
            </label>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-3 py-4 text-sm text-[#7b6a77]">Nenhum produto.</li>}
      </ul>
    </div>
  );
}
