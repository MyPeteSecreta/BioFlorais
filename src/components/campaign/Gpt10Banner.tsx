"use client";

/**
 * Faixa "GPT10 aplicado: 10% na sua 1ª compra". Aparece igual para todo visitante (sem cloaking); só some depois do fim da
 * campanha (30/11/2026 23:59:59 BRT), o mesmo prazo do cupom.
 */

import { useEffect, useState } from "react";

import { CAMPAIGN_GPT10 } from "@/lib/campaign/gpt-pages";
import { isGpt10Open } from "@/lib/campaign/gpt10";

export default function Gpt10Banner() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(isGpt10Open());
  }, []);

  if (!open) return null;

  return (
    <div className="rounded-2xl border border-[#c39745] bg-[#fff6e0] px-4 py-3 text-[#422347]" data-testid="faixa-gpt10" role="note">
      <p className="text-[15px] font-extrabold leading-snug">{CAMPAIGN_GPT10.bannerText}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-[#6c5b69]">{CAMPAIGN_GPT10.fineprint}</p>
    </div>
  );
}
