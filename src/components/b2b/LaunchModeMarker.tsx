"use client";

/**
 * BIO FLORAIS B2B — marca a aba como "Lançar pedido" quando a loja do link abre com ?lancar=1 (vindo do painel
 * do vendedor) e mostra a faixa de aviso. A marca só muda a TELA; quem autoriza o lançamento é o servidor
 * (sessão do vendedor dono da oferta), então um cliente que adicione ?lancar=1 não ganha nada.
 */

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LAUNCH_QUERY, launchStorageKey } from "@/lib/b2b/launch-constants";

export default function LaunchModeMarker({ token }: { token: string }) {
  const params = useSearchParams();
  const [active, setActive] = useState(false);
  const fromUrl = params.get(LAUNCH_QUERY) === "1";

  useEffect(() => {
    try {
      if (fromUrl) window.sessionStorage.setItem(launchStorageKey(token), "1");
      // Estado vindo do sessionStorage (só existe no navegador): lido depois da montagem.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(fromUrl || window.sessionStorage.getItem(launchStorageKey(token)) === "1");
    } catch {
      setActive(fromUrl);
    }
  }, [fromUrl, token]);

  if (!active) return null;

  return (
    <div className="sticky top-0 z-50 bg-[#55245f] px-4 py-2 text-center text-xs font-extrabold text-white" data-testid="modo-lancamento" role="status">
      Modo lançamento: você está montando o pedido pelo cliente. Escolha os itens e finalize no carrinho.
    </div>
  );
}
