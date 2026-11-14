"use client";

/**
 * Calcular frete na SACOLA (Luis, 14/11): CEP + "Calcular" mostra o frete e o total com frete, com a MESMA regra do checkout
 * (src/lib/checkout/shipping-b2c.ts: grátis a partir de R$ 70; abaixo, 65% da cotação mais barata com teto por estado) e a mesma
 * cotação (/api/shipping/quote). O CEP vai para o rascunho do checkout, que já abre com ele preenchido (e calcula sozinho).
 * A ordem dos campos do checkout não muda.
 */

import { useEffect, useState } from "react";

import { computeB2CShipping, ufFromCep } from "@/lib/checkout/shipping-b2c";
import { formatCep, onlyCepDigits as onlyDigits, readCepFromCheckoutDraft, saveCepToCheckoutDraft } from "@/lib/checkout-draft-cep";

export type ShippingEstimate = { cep: string; customerCents: number; free: boolean; etaDays: number | null };

export default function CartShippingEstimate({
  items,
  baseCents,
  onEstimate,
}: {
  items: Array<{ productSlug: string; qty: number }>;
  baseCents: number;
  onEstimate: (estimate: ShippingEstimate | null) => void;
}) {
  const [cep, setCep] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cheapest, setCheapest] = useState<{ cep: string; costCents: number; etaDays: number | null } | null>(null);

  useEffect(() => {
    try {
      const saved = readCepFromCheckoutDraft(window.sessionStorage);
      // Efeito único na montagem: só existe no navegador.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.length === 8) setCep(saved);
    } catch {
      // sem armazenamento
    }
  }, []);

  // A sacola mudou: a cotação antiga não vale mais.
  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheapest(null);
  }, [itemsKey]);

  // Mesma regra do checkout, recalculada quando muda o valor dos produtos (ex.: passou de R$ 70).
  useEffect(() => {
    if (!cheapest) {
      onEstimate(null);
      return;
    }

    const rule = computeB2CShipping({
      subtotalCents: baseCents,
      optionCostCents: cheapest.costCents,
      cheapestCostCents: cheapest.costCents,
      uf: ufFromCep(cheapest.cep),
    });

    onEstimate({ cep: cheapest.cep, customerCents: rule.customerCents, free: rule.free || rule.customerCents === 0, etaDays: cheapest.etaDays });
  }, [cheapest, baseCents, onEstimate]);

  async function calculate() {
    const digits = onlyDigits(cep);

    if (digits.length !== 8) {
      setError("Digite os 8 números do CEP.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cepDestino: digits, items }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; options?: Array<{ priceCents: number; etaDays?: number }> };

      if (!response.ok) throw new Error(data.error ?? "Não foi possível calcular o frete.");

      const options = (data.options ?? []).filter((option) => Number.isFinite(option.priceCents));
      if (options.length === 0) throw new Error("Nenhuma entrega disponível para este CEP.");

      const best = options.reduce((min, option) => (option.priceCents < min.priceCents ? option : min));
      setCheapest({ cep: digits, costCents: best.priceCents, etaDays: Number.isFinite(best.etaDays) ? Number(best.etaDays) : null });

      try {
        saveCepToCheckoutDraft(window.sessionStorage, digits);
      } catch {
        // sem armazenamento: o checkout pede o CEP de novo
      }
    } catch (err) {
      setCheapest(null);
      setError(err instanceof Error ? err.message : "Não foi possível calcular o frete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1" data-testid="calcular-frete-sacola">
      <div className="flex gap-2">
        <input
          value={formatCep(onlyDigits(cep))}
          onChange={(event) => setCep(onlyDigits(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void calculate();
            }
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Seu CEP"
          aria-label="CEP para calcular o frete"
          className="min-w-0 flex-1 rounded-full border border-[#26352c]/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#26352c]/40"
        />
        <button
          type="button"
          onClick={() => void calculate()}
          disabled={busy}
          className="shrink-0 rounded-full border border-[#26352c] px-4 py-2.5 text-sm font-medium transition hover:bg-[#26352c] hover:text-white disabled:opacity-50"
        >
          {busy ? "Calculando..." : "Calcular"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
