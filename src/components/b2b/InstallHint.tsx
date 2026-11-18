"use client";

/**
 * Item 14e (18/11): aviso discreto na home do painel do vendedor para instalar o app no celular. Só aparece no celular, só se
 * ainda não abriu como app e some de vez ao tocar em "Agora não" (lembrado neste aparelho). O passo a passo fica em
 * /b2b/painel/instalar (InstallApp).
 */

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "bio-vendas-install-hint-dismissed";

export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(mobile && !standalone && !dismissed);
    } catch {
      // sem acesso ao navegador: não mostra
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignora
    }
    setShow(false);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#eadfd9] bg-[#fff8f3] p-4" data-testid="dica-instalar-app">
      <p className="flex-1 text-sm font-bold text-[#422347]">Use o painel como app: instale o ícone Bio Vendas na tela do celular.</p>
      <Link href="/b2b/painel/instalar" className="rounded-full bg-[#55245f] px-4 py-2 text-sm font-extrabold text-white" data-testid="dica-instalar-ver">
        Ver como instalar
      </Link>
      <button type="button" onClick={dismiss} className="text-sm font-bold text-[#63326d] underline underline-offset-4" data-testid="dica-instalar-fechar">
        Agora não
      </button>
    </div>
  );
}
