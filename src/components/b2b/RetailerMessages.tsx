"use client";

/**
 * Marketing ao lojista no link da oferta (C11 + A8):
 *  (a) POP-UP no 1º acesso do cliente com a 1ª mensagem ativa (uma vez; "Entendi" registra);
 *  (b) FAIXA no topo com o texto completo, trocando de mensagem a cada N segundos (padrão 60);
 *  (c) BOTÃO FLUTUANTE com a "chamada curta" (até ~30 caracteres), girando por conta própria
 *      a cada N segundos; ao clicar abre o texto completo da mensagem em exibição.
 * No celular nada cobre os botões de compra: faixa no fluxo da página (não fixa) e o botão
 * fica dentro da faixa, só com o ícone.
 */

import { useEffect, useState } from "react";

export type RetailerMessageView = { id: string; title: string; body: string; shortCall: string };

export default function RetailerMessages({
  token,
  messages,
  showPopup,
  rotation,
}: {
  token: string;
  messages: RetailerMessageView[];
  showPopup: boolean;
  rotation: { bannerSeconds: number; buttonSeconds: number };
}) {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [buttonIndex, setButtonIndex] = useState(0);
  const [popup, setPopup] = useState(showPopup && messages.length > 0);
  const [openId, setOpenId] = useState<string | null>(null);

  // Faixa e botão giram em tempos independentes pelas mensagens ativas.
  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(() => setBannerIndex((current) => (current + 1) % messages.length), rotation.bannerSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [messages.length, rotation.bannerSeconds]);

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(() => setButtonIndex((current) => (current + 1) % messages.length), rotation.buttonSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [messages.length, rotation.buttonSeconds]);

  if (messages.length === 0) return null;

  const banner = messages[bannerIndex % messages.length];
  const button = messages[buttonIndex % messages.length];
  const opened = messages.find((message) => message.id === openId) ?? null;

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
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-full bg-[#55245f] py-3 text-sm font-extrabold text-white">
          {label}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* (b) Faixa no topo: texto completo, trocando a cada N segundos. */}
      <div className="relative border-b border-[#eadfd9] bg-[#55245f] py-2 pl-4 pr-14 text-center text-white md:px-4" aria-live="polite">
        <p className="mx-auto max-w-[1180px] text-xs leading-5 sm:text-sm">
          <strong className="font-extrabold">{banner.title}</strong>{" "}
          <span className="text-white/85">{banner.body}</span>
        </p>
        {/* Celular: o botão fica DENTRO da faixa (não flutua), então nunca cobre botões de compra. */}
        <button
          type="button"
          onClick={() => setOpenId(button.id)}
          aria-label={`Abrir mensagem: ${button.shortCall}`}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#c9a24a] text-lg shadow md:hidden"
        >
          <span aria-hidden="true">✨</span>
        </button>
      </div>

      {/* (c) Botão flutuante (computador): chamada curta, gira sozinha. */}
      <button
        type="button"
        onClick={() => setOpenId(button.id)}
        aria-label={`Abrir mensagem: ${button.shortCall}`}
        className="hidden items-center gap-2 rounded-full border-2 border-white bg-[#8a5f12] px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:scale-105 md:fixed md:bottom-24 md:right-5 md:z-[90] md:flex"
      >
        <span aria-hidden="true">✨</span>
        <span>{button.shortCall}</span>
      </button>

      {opened && modal(opened.title, opened.body, () => setOpenId(null), "Fechar")}

      {/* (a) Pop-up do 1º acesso (uma vez por cliente): a 1ª mensagem ativa pela ordem. */}
      {popup && modal(messages[0].title, messages[0].body, closePopup, "Entendi")}
    </>
  );
}
