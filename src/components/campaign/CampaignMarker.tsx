"use client";

/**
 * Marca, só neste navegador, que o visitante passou por uma página de campanha (/para/*): o GPT10 passa a ser aplicado
 * sozinho na sacola (e pode ser removido no checkout). Não altera o conteúdo da página: todo visitante vê o mesmo.
 */

import { useEffect } from "react";

import { markGpt10 } from "@/lib/campaign/gpt10";

export default function CampaignMarker() {
  useEffect(() => {
    try {
      markGpt10(window.localStorage);
    } catch {
      // sem localStorage: a página funciona igual, só sem a aplicação automática do cupom
    }
  }, []);

  return null;
}
