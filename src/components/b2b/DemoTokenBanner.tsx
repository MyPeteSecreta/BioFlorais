"use client";

/**
 * Faixa de demonstração nas telas do CLIENTE (oferta, linha, carrinho, checkout): descobre o token da
 * oferta pelo caminho (/b2b/oferta/<token>) ou por ?b2b=<token> e pergunta ao servidor se é demo.
 */

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import DemoBanner from "@/components/b2b/DemoBanner";

export default function DemoTokenBanner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<{ token: string; demo: boolean; ctaUrl?: string } | null>(null);

  const fromPath = pathname?.match(/^\/b2b\/oferta\/([^/]+)/)?.[1];
  const token = fromPath ? decodeURIComponent(fromPath) : (searchParams.get("b2b") ?? "");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetch(`/api/b2b/demo-status?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((data: { demo?: boolean; ctaUrl?: string }) => {
        if (!cancelled) setState({ token, demo: data.demo === true, ctaUrl: data.ctaUrl });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || !state || state.token !== token || !state.demo) return null;

  return <DemoBanner ctaUrl={state.ctaUrl} />;
}
