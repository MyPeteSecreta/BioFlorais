"use client";

import { useEffect, useState } from "react";

const KEY = "bioflorais:b2b-demo-welcome";

/* Boas-vindas curtas na primeira entrada do demo: 3 passos + lembrete das 24 h. */
export default function DemoWelcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function close() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* sem armazenamento: só fecha */
    }

    setOpen(false);
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Boas-vindas" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-2xl font-extrabold text-[#422347]">Bem-vindo(a) à demonstração</h2>

        <ol className="mt-4 space-y-3 text-base text-[#422347]">
          <li>
            <strong>1.</strong> Crie um cliente fictício (só o nome).
          </li>
          <li>
            <strong>2.</strong> Escolha linhas e promoções e veja a sua comissão.
          </li>
          <li>
            <strong>3.</strong> Gere o link e abra para ver como o seu cliente vai ver.
          </li>
        </ol>

        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Nada aqui é real e as compras estão desativadas. Seus dados de teste ficam por 24 horas e depois são apagados automaticamente.
        </p>

        <button type="button" onClick={close} className="mt-5 min-h-12 w-full rounded-full bg-[#55245f] text-base font-extrabold text-white">
          Começar
        </button>
      </div>
    </div>
  );
}
