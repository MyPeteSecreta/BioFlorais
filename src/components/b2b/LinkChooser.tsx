"use client";

/**
 * "Não sabe qual usar?" — comparativo entre Oferta para o cliente, Link com o nome do cliente e Link geral
 * para divulgar, com uma MINIATURA leve (HTML/CSS, sem foto) de como o cliente vê. Fechado por padrão.
 */

import { useState } from "react";

function MiniPhone({ greeting, headline, badge, note }: { greeting?: string; headline: string; badge?: string; note?: string }) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-[120px] rounded-[16px] border-2 border-[#d9c7dc] bg-[#fffaf6] p-2 shadow-sm"
      data-testid="miniatura"
    >
      <div className="mx-auto mb-1.5 h-1 w-8 rounded-full bg-[#d9c7dc]" />
      {greeting && <p className="text-[9px] font-bold leading-tight text-[#422347]">{greeting}</p>}
      <p className="mt-0.5 text-[10px] font-extrabold leading-tight text-[#55245f]">{headline}</p>
      {badge && <span className="mt-1.5 inline-block rounded-full bg-blue-600 px-1.5 py-0.5 text-[8px] font-extrabold leading-tight text-white">{badge}</span>}
      {note && <p className="mt-1.5 rounded-md bg-[#f6eef7] px-1 py-0.5 text-[8px] font-bold leading-tight text-[#55245f]">{note}</p>}
      <div className="mt-2 grid grid-cols-2 gap-1">
        <div className="h-6 rounded-md bg-[#f1e6ef]" />
        <div className="h-6 rounded-md bg-[#f1e6ef]" />
      </div>
    </div>
  );
}

const COLUMNS = [
  {
    key: "oferta",
    title: "Oferta para o cliente",
    thumb: <MiniPhone greeting="Olá, Pet Honjo" headline="Sua oferta" badge="Leve 3 pague 2" />,
    rows: ["Sim, você escolhe por linha", "Sim", "Negociação, abertura, reconquista", "Base + extra da promoção"],
  },
  {
    key: "nome",
    title: "Link com o nome do cliente",
    thumb: <MiniPhone greeting="Olá, Pet Honjo" headline="Preço de lojista" />,
    rows: ["Não", "Sim", "Cliente pediu a tabela", "Normal"],
  },
  {
    key: "geral",
    title: "Link geral para divulgar",
    thumb: <MiniPhone headline="Preço de lojista" note="Identifique-se ao finalizar" />,
    rows: ["Não", "Não (ele se identifica ao comprar)", "Flyer, Instagram, cliente novo", "Normal"],
  },
];

const ROW_LABELS = ["Promoção", "Nome do cliente", "Quando usar", "Sua comissão"];

export default function LinkChooser() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4" data-testid="qual-link">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="min-h-[44px] text-sm font-bold text-[#63326d] underline underline-offset-4"
      >
        Não sabe qual usar?
      </button>

      {open && (
        <div className="mt-3 grid gap-4 md:grid-cols-3" data-testid="comparativo">
          {COLUMNS.map((column) => (
            <article key={column.key} className="rounded-[20px] border border-[#eadfd9] bg-white p-4">
              <h3 className="text-center text-sm font-extrabold text-[#422347]">{column.title}</h3>
              <div className="mt-3">{column.thumb}</div>
              <dl className="mt-4 space-y-2 text-sm">
                {ROW_LABELS.map((label, index) => (
                  <div key={label}>
                    <dt className="text-[11px] font-extrabold uppercase tracking-wide text-[#9b6c24]">{label}</dt>
                    <dd className="font-semibold text-[#422347]">{column.rows[index]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
