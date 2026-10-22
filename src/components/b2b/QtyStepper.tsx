"use client";

/**
 * Quantidade editável (− / digitar / +) da sacola e do checkout B2B (Rodada 19e). Digitar não remove o item: o número só
 * muda quando há uma quantidade válida; ao sair do campo vazio, volta à quantidade atual. O pai revalida tudo na hora
 * (promoções, kit com display, mínimo e frete) porque a quantidade muda o estado da sacola.
 */

import { useEffect, useState } from "react";

import { QTY_MAX, QTY_MIN, parseQtyDraft, stepQty } from "@/lib/b2b/qty-input";

export default function QtyStepper({ qty, label, onChange }: { qty: number; label: string; onChange: (qty: number) => void }) {
  const [draft, setDraft] = useState(String(qty));

  // A sacola mudou por fora (kit, outro aparelho, revalidação): o campo acompanha.
  useEffect(() => {
    setDraft(String(qty));
  }, [qty]);

  const button =
    "flex h-9 w-9 items-center justify-center rounded-full border border-[#d9c7dc] bg-white text-lg font-bold leading-none text-[#55245f] transition hover:bg-[#f6eef7] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="inline-flex items-center gap-1.5" data-testid="qty-stepper">
      <button type="button" aria-label={`Diminuir ${label}`} className={button} disabled={qty <= QTY_MIN} onClick={() => onChange(stepQty(qty, -1))}>
        −
      </button>
      <input
        aria-label={`Quantidade de ${label}`}
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        onChange={(event) => {
          const text = event.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(text);

          const parsed = parseQtyDraft(text);
          if (parsed !== null && parsed !== qty) onChange(parsed);
        }}
        onBlur={() => setDraft(String(qty))}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-9 w-14 rounded-lg border border-[#d9c7dc] px-1 text-center text-sm font-bold text-[#422347]"
      />
      <button type="button" aria-label={`Aumentar ${label}`} className={button} disabled={qty >= QTY_MAX} onClick={() => onChange(stepQty(qty, 1))}>
        +
      </button>
    </div>
  );
}
