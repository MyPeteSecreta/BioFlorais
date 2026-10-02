"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cartLineUnitCents, useB2BCart } from "@/lib/b2b/cart-context";
import { formatB2BCents } from "@/lib/b2b/format";
import { B2B_MIN_ORDER_CENTS } from "@/lib/b2b/pricing";

export default function B2BCartContent() {
  const token = useSearchParams().get("b2b") ?? "";
  const cart = useB2BCart();

  const tokenMatches = Boolean(token) && cart.state.offerToken === token;
  const lines = tokenMatches ? cart.state.lines : [];
  const missingCents = Math.max(0, B2B_MIN_ORDER_CENTS - cart.subtotalCents);

  if (!token) {
    return (
      <main className="min-h-screen bg-[#fffaf6] px-5 py-20 text-center text-[#422347]">
        <p>Link de oferta ausente. Abra o link enviado pelo seu representante.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] px-5 py-10 text-[#422347]">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/b2b/oferta/${encodeURIComponent(token)}`}
          className="text-sm font-bold text-[#63326d] underline underline-offset-4"
        >
          ← Voltar aos produtos
        </Link>

        <h1 className="mt-4 font-serif text-3xl font-semibold text-[#55245f]">Seu pedido B2B</h1>

        {!cart.hydrated ? null : lines.length === 0 ? (
          <p className="mt-6 text-[#746471]">Nenhum produto no pedido ainda.</p>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-[#eadfd9] rounded-[20px] border border-[#eadfd9] bg-white">
              {lines.map((line) => (
                <li key={line.productId} className="flex items-center gap-4 p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#fbf5f1]">
                    {line.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{line.name}</p>
                    <p className="text-xs text-[#8a7886]">
                      {line.discountPercent ? (
                        <>
                          <span className="line-through">{formatB2BCents(line.priceCents)}</span>{" "}
                          <strong className="text-[#55245f]">{formatB2BCents(cartLineUnitCents(line))}</strong> / un. · −{String(line.discountPercent).replace(".", ",")}%
                        </>
                      ) : (
                        <>{formatB2BCents(line.priceCents)} / un.</>
                      )}
                    </p>
                  </div>
                  <input
                    aria-label={`Quantidade de ${line.name}`}
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(event) =>
                      cart.setQty(line.productId, Number(event.target.value.replace(/\D/g, "")) || 0)
                    }
                    className="w-16 rounded-lg border border-[#d9c7dc] px-2 py-1 text-center text-sm font-bold"
                  />
                  <p className="w-24 text-right text-sm font-bold">
                    {formatB2BCents(cartLineUnitCents(line) * line.qty)}
                  </p>
                  <button
                    type="button"
                    onClick={() => cart.removeItem(line.productId)}
                    className="text-xs font-bold text-[#a33]"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-[20px] border border-[#eadfd9] bg-white p-5">
              <div className="flex items-center justify-between text-lg font-extrabold">
                <span>Produtos</span>
                <span>{formatB2BCents(cart.subtotalCents)}</span>
              </div>
              <p className="mt-1 text-xs text-[#8a7886]">
                Frete especial B2B a partir de R$ 450. Frete, cupom e o valor final de cada
                forma de pagamento aparecem no checkout.
              </p>

              {missingCents > 0 ? (
                <p className="mt-4 rounded-xl bg-[#fff4e5] p-3 text-sm font-semibold text-[#8a5a12]">
                  Faltam {formatB2BCents(missingCents)} para atingir o pedido mínimo de{" "}
                  {formatB2BCents(B2B_MIN_ORDER_CENTS)}.
                </p>
              ) : (
                <Link
                  href={`/b2b/checkout?b2b=${encodeURIComponent(token)}`}
                  className="mt-4 block rounded-full bg-[#55245f] py-3 text-center text-sm font-extrabold text-white"
                >
                  Ir para o checkout
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
