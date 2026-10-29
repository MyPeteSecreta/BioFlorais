"use client";

/** "?" com a explicação curta de um termo. Toque/clique abre e fecha; o texto aparece logo abaixo (funciona bem no celular). */

import { useId, useState } from "react";

export default function HelpTip({ text, label = "O que é isto?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="inline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#c9a8cf] bg-white align-middle text-xs font-black text-[#55245f]"
        data-testid="ajuda"
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className="mt-2 block rounded-xl bg-[#f6eef7] p-3 text-xs font-normal leading-5 text-[#422347]" data-testid="ajuda-texto">
          {text}
        </span>
      )}
    </span>
  );
}
