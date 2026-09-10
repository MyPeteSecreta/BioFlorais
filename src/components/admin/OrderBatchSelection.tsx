"use client";

import {
  type ReactNode,
  useRef,
  useState,
} from "react";

type Props = {
  children: ReactNode;
};

export default function OrderBatchSelection({
  children,
}: Props) {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [selectedCount, setSelectedCount] =
    useState(0);

  function getCheckboxes() {
    if (!formRef.current) return [];

    return Array.from(
      formRef.current.querySelectorAll<HTMLInputElement>(
        'input[name="ids"]'
      )
    );
  }

  function syncCount() {
    const count =
      getCheckboxes().filter(
        (checkbox) => checkbox.checked
      ).length;

    setSelectedCount(count);
  }

  function selectAll() {
    for (const checkbox of getCheckboxes()) {
      if (!checkbox.disabled) {
        checkbox.checked = true;
      }
    }

    syncCount();
  }

  function clearAll() {
    for (const checkbox of getCheckboxes()) {
      checkbox.checked = false;
    }

    syncCount();
  }

  return (
    <form
      ref={formRef}
      action="/admin/pedidos/imprimir"
      method="GET"
      target="_blank"
      onChange={syncCount}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[22px] border border-[#eadfd9] bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={selectAll}
          className="rounded-full border border-[#d9cac2] px-4 py-2 text-sm font-extrabold text-[#422347] transition hover:bg-[#f8f3ef]"
        >
          Selecionar todos
        </button>

        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border border-[#d9cac2] px-4 py-2 text-sm font-extrabold text-[#756674] transition hover:bg-[#f8f3ef]"
        >
          Limpar seleção
        </button>

        <button
          type="submit"
          disabled={selectedCount === 0}
          className="rounded-full bg-[#422347] px-5 py-2 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Imprimir separação ({selectedCount})
        </button>

        <span className="ml-auto text-xs font-bold text-[#8a7a87]">
          {selectedCount === 0
            ? "Nenhum pedido selecionado"
            : selectedCount === 1
              ? "1 pedido selecionado"
              : `${selectedCount} pedidos selecionados`}
        </span>
      </div>

      {children}
    </form>
  );
}
