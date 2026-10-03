"use client";

/**
 * Marketing ao lojista no link da oferta (C11):
 *  (a) POP-UP no 1º acesso do cliente (uma vez; "Entendi" registra que viu);
 *  (b) FAIXA no topo alternando as mensagens ativas a cada ~8 s;
 *  (c) BOTÃO FLUTUANTE (mesmo visual do convite UGC do B2C) que abre a mensagem atual.
 * No celular nada cobre os botões de compra: faixa no fluxo da página (não fixa) e
 * botão pequeno fixo no alto, fora da área dos cards e da barra "Ver pedido".
 */

import { useEffect, useState } from "react";

export type RetailerMessageView = { id: string; title: string; body: string };

const ROTATE_MS = 8000;

export default function RetailerMessages({
  token,
  messages,
  showPopup,
}: {
  token: string;
  messages: RetailerMessageView[];
  showPopup: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [popup, setPopup] = useState(showPopup && messages.length > 0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % messages.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [messages.length]);

  if (messages.length === 0) return null;

  const current = messages[index % messages.length];

  function closePopup() {
    setPopup(false);
    // Registra que o cliente viu (o pop-up não volta). Falha silenciosa: no máximo aparece de novo.
    void fetch("/api/b2b/retailer-messages/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b2bToken: token, messageId: messages[0].id }),
    }).catch(() => undefined);
  }

  const modal = (title: string, body: string, onClose: () => void, label: string) => (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#342737]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9b6c24]">Bio Florais</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-[#55245f]">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#6c5b69]">{body}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white"
        >
          {label}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* (b) Faixa no topo, alternando as mensagens ativas. */}
      <div className="relative border-b border-[#eadfd9] bg-[#55245f] py-2 pl-4 pr-14 text-center text-white md:px-4" aria-live="polite">
        <p className="mx-auto max-w-[1180px] text-xs leading-5 sm:text-sm">
          <strong className="font-extrabold">{current.title}</strong>{" "}
          <span className="text-white/85">{current.body}</span>
        </p>
        {/* Celular: o botão fica DENTRO da faixa (não flutua), então nunca cobre botões de compra. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir mensagem da Bio Florais"
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#c9a24a] text-lg shadow md:hidden"
        >
          <span aria-hidden="true">✨</span>
        </button>
      </div>

      {/* (c) Botão flutuante: abre a mensagem atual. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir mensagem da Bio Florais"
        className="hidden items-center gap-2 rounded-full border-2 border-white bg-[#c9a24a] px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:scale-105 md:fixed md:bottom-24 md:right-5 md:z-[90] md:flex"
      >
        <span aria-hidden="true">✨</span>
        <span>Novidades para você</span>
      </button>

      {open && modal(current.title, current.body, () => setOpen(false), "Fechar")}

      {/* (a) Pop-up do 1º acesso (uma vez por cliente). */}
      {popup && modal(messages[0].title, messages[0].body, closePopup, "Entendi")}
    </>
  );
}
