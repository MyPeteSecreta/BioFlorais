"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useRef,
  useState,
} from "react";

import { archiveOrdersAsTest } from "./archive-orders";

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
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState("");

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

  async function archiveSelected() {
    const ids = getCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);

    setArchiving(true);
    setArchiveMessage("");

    try {
      const outcome = await archiveOrdersAsTest(ids);

      if (outcome.cancelled && !outcome.message) return;

      setArchiveMessage(outcome.message);

      if (outcome.archived > 0) {
        clearAll();
        router.refresh();
      }
    } finally {
      setArchiving(false);
    }
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
          Desmarcar todos
        </button>

        <button
          type="button"
          disabled={selectedCount === 0 || archiving}
          onClick={archiveSelected}
          className="rounded-full border-2 border-[#b33] px-5 py-2 text-sm font-extrabold text-[#b33] transition hover:bg-[#fbe7e7] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {archiving ? "Arquivando…" : `Marcar como teste e arquivar (${selectedCount})`}
        </button>

        <button
          type="submit"
          disabled={selectedCount === 0}
          className="rounded-full bg-[#422347] px-5 py-2 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Imprimir separação ({selectedCount})
        </button>

        {archiveMessage && (
          <p role="status" className="w-full text-sm font-bold text-[#422347]">
            {archiveMessage}
          </p>
        )}

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
