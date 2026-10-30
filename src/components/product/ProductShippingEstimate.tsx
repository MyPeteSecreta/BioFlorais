"use client";

/**
 * "Frete e prazo para o seu CEP", junto da compra: usa a mesma cotação do carrinho (/api/shipping/quote) para UMA unidade e mostra a
 * opção mais barata e a mais rápida. Se falhar, não atrapalha: o frete continua sendo calculado no carrinho e no checkout.
 */

import { useState } from "react";

type Option = { serviceName: string; priceCents: number; etaDays: number };

const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function ProductShippingEstimate({ productSlug }: { productSlug: string }) {
  const [cep, setCep] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);

    setCep(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
  }

  async function calculate() {
    const digits = cep.replace(/\D/g, "");

    if (digits.length !== 8) {
      setError("Informe o CEP com 8 números.");
      return;
    }

    setBusy(true);
    setError(null);
    setOptions(null);

    try {
      const response = await fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cepDestino: digits, items: [{ productSlug, qty: 1 }] }) });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !Array.isArray(data.options) || data.options.length === 0) {
        setError("Não conseguimos calcular agora. Você vê o frete e o prazo no carrinho.");
        return;
      }

      setOptions(data.options as Option[]);
    } catch {
      setError("Sem conexão. Você vê o frete e o prazo no carrinho.");
    } finally {
      setBusy(false);
    }
  }

  const cheapest = options ? [...options].sort((a, b) => a.priceCents - b.priceCents)[0] : null;
  const fastest = options ? [...options].sort((a, b) => a.etaDays - b.etaDays || a.priceCents - b.priceCents)[0] : null;
  const days = (n: number) => (n === 1 ? "1 dia útil" : `${n} dias úteis`);

  return (
    <div className="mt-4 rounded-2xl border border-[#eadfd9] bg-white p-4" data-testid="frete-prazo">
      <p className="text-sm font-extrabold text-[#422347]">Frete e prazo para o seu CEP</p>
      <div className="mt-2 flex gap-2">
        <input
          value={cep}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          aria-label="CEP de entrega"
          className="min-w-0 flex-1 rounded-xl border border-[#d9c7dc] bg-[#fffdf9] px-3 py-3 text-base"
          data-testid="frete-cep"
        />
        <button type="button" onClick={calculate} disabled={busy} className="rounded-xl bg-[#63326d] px-5 text-sm font-extrabold text-white disabled:opacity-60" data-testid="frete-calcular">
          {busy ? "…" : "Calcular"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-[#8a4b12]">
          {error}
        </p>
      )}
      {cheapest && fastest && (
        <ul className="mt-3 grid gap-1 text-sm text-[#422347]" data-testid="frete-resultado">
          <li>
            <strong>{brl(cheapest.priceCents)}</strong> · {cheapest.serviceName}, entrega em até {days(cheapest.etaDays)}
          </li>
          {fastest.serviceName !== cheapest.serviceName && (
            <li>
              <strong>{brl(fastest.priceCents)}</strong> · {fastest.serviceName}, mais rápido: até {days(fastest.etaDays)}
            </li>
          )}
          <li className="text-xs text-[#746471]">Frete grátis nas compras a partir de R$ 100 (modalidade econômica). O prazo conta depois da confirmação do pagamento.</li>
        </ul>
      )}
    </div>
  );
}
