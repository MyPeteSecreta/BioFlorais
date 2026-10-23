"use client";

/**
 * Aviso na sacola: quem passou por /para/* tem o GPT10 aplicado (a confirmação do valor é no checkout). Some se o cliente
 * removeu o cupom ou depois do fim da campanha.
 */

import { useEffect, useState } from "react";

import { CAMPAIGN_GPT10 } from "@/lib/campaign/gpt-pages";
import { isGpt10Open, readGpt10 } from "@/lib/campaign/gpt10";

export default function Gpt10CartNote() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    try {
      const state = readGpt10(window.localStorage);
      setActive(Boolean(state && !state.removed && isGpt10Open()));
    } catch {
      setActive(false);
    }
  }, []);

  if (!active) return null;

  return (
    <p className="mt-3 rounded-2xl border border-[#c39745] bg-[#fff6e0] px-3 py-2 text-xs font-semibold leading-5 text-[#422347]" data-testid="aviso-gpt10-sacola">
      {CAMPAIGN_GPT10.bannerText}. O desconto aparece no checkout e você pode removê-lo lá.
    </p>
  );
}
