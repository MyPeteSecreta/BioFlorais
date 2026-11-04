"use client";

/**
 * Fase da campanha no navegador (as páginas são estáticas: a decisão é pela hora do visitante e se atualiza a cada minuto).
 * Antes de montar, devolve null: o HTML do servidor mostra o preço do site e a campanha entra logo depois.
 */

import { useEffect, useState } from "react";

import { activeCampaign, type CampaignPhase } from "@/lib/campaign/esquenta-black";

export function useCampaign(): CampaignPhase | null {
  const [phase, setPhase] = useState<CampaignPhase | null>(null);

  useEffect(() => {
    const tick = () => setPhase((current) => {
      const next = activeCampaign(Date.now());

      return current?.key === next?.key ? current : next;
    });
    const timer = window.setInterval(tick, 60_000);

    tick();
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return phase;
}
