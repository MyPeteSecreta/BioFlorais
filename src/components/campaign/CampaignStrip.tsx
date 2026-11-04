"use client";

/**
 * Faixa do Esquenta Black / Black Friday no topo do B2C (fora do B2B, do admin e de /parceiros). Decide no navegador pela hora,
 * então entra e sai no horário certo mesmo com a página em cache. Fora da campanha não aparece nem ocupa espaço.
 */

import { usePathname } from "next/navigation";

import { isCampaignPath } from "@/lib/campaign/esquenta-black";

import { useCampaign } from "./useCampaign";

export default function CampaignStrip() {
  const pathname = usePathname();
  const phase = useCampaign();

  if (!phase || !isCampaignPath(pathname)) return null;

  return (
    <div data-testid="faixa-campanha" role="status" className="bg-[#2f231f] px-4 py-2 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-white sm:text-sm">
      {phase.strip}
    </div>
  );
}
