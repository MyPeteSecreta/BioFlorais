"use client";

/**
 * "Continuar compra" de um orçamento (Rodada 19b): vive no layout da loja (/b2b/oferta/<token>/…). Quando a URL traz
 * ?orcamento=<id>, restaura a SACOLA na loja (quantidades editáveis, dá para adicionar produtos) e guarda o rascunho (dados,
 * endereço e observações) para o checkout. Sem o parâmetro, só mostra a faixa "Orçamento em andamento" se houver rascunho.
 * O servidor decide o acesso (link pessoal, link geral ou sessão do representante) e recalcula os preços.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useB2BCart } from "@/lib/b2b/cart-context";
import { launchStorageKey } from "@/lib/b2b/launch-constants";
import { clearQuoteDraft, readQuoteDraft, writeQuoteDraft } from "@/lib/b2b/quote-draft";

export default function QuoteRestore({ token }: { token: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cart = useB2BCart();
  const quoteParam = params.get("orcamento") ?? "";
  const done = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (!cart.hydrated) return;

    try {
      setHasDraft(Boolean(readQuoteDraft(window.sessionStorage, token)));
    } catch {
      setHasDraft(false);
    }
  }, [cart.hydrated, token, notice]);

  useEffect(() => {
    if (!quoteParam || !cart.hydrated || done.current) return;

    done.current = true;

    if (params.get("lancar") === "1") {
      try {
        window.sessionStorage.setItem(launchStorageKey(token), "1");
      } catch {
        // o servidor valida a sessão do representante de qualquer forma
      }
    }

    fetch(`/api/b2b/orders/quote?b2b=${encodeURIComponent(token)}&id=${encodeURIComponent(quoteParam)}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? "Não foi possível abrir o orçamento.");

          return;
        }

        cart.setOfferToken(token);
        cart.load(data.lines ?? [], data.displays ?? []);

        const until = data.quote?.expiresAt ? new Date(data.quote.expiresAt).toLocaleDateString("pt-BR") : null;
        const message = data.quote?.expired
          ? `Este orçamento venceu em ${until ?? "—"}. A sacola foi restaurada com os preços de hoje: ajuste e feche o pedido ou salve um novo orçamento.`
          : `Orçamento restaurado${until ? ` (válido até ${until})` : ""}. Ajuste as quantidades, adicione produtos e continue para o checkout. Os preços foram recalculados.`;

        writeQuoteDraft(window.sessionStorage, token, {
          // Vencido não é convertido: o checkout trata como compra nova com os mesmos dados.
          quoteId: data.quote?.expired ? null : String(data.quote?.id ?? "") || null,
          notice: message,
          customer: data.customer ?? null,
          address: data.address ?? null,
          orderNote: data.quote?.orderNote ?? "",
          couponCode: data.quote?.couponCode ?? null,
        });
        setNotice(message);

        // Tira o parâmetro da URL (recarregar a página não restaura de novo por cima do que a pessoa editou).
        const next = new URLSearchParams(params.toString());
        next.delete("orcamento");
        router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
      })
      .catch(() => setError("Não foi possível abrir o orçamento."));
    // Roda uma vez, depois da hidratação da sacola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteParam, cart.hydrated, token]);

  if (error) {
    return (
      <p role="alert" data-testid="orcamento-erro" className="mx-auto mt-3 max-w-3xl rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
        {error}
      </p>
    );
  }

  if (!notice && !hasDraft) return null;

  const draft = typeof window !== "undefined" ? readQuoteDraft(window.sessionStorage, token) : null;

  return (
    <div role="status" data-testid="faixa-orcamento" className="sticky top-0 z-40 border-b-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-[240px] text-sm font-bold">{notice || draft?.notice || "Orçamento em andamento."}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/b2b/checkout?b2b=${encodeURIComponent(token)}`} className="rounded-full bg-[#55245f] px-5 py-2.5 text-sm font-extrabold text-white" data-testid="ir-checkout-orcamento">
            Ir para o checkout
          </Link>
          <button
            type="button"
            className="text-xs font-bold underline"
            onClick={() => {
              try {
                clearQuoteDraft(window.sessionStorage, token);
              } catch {
                // sem armazenamento
              }
              setNotice("");
              setHasDraft(false);
            }}
          >
            Descartar orçamento
          </button>
        </div>
      </div>
    </div>
  );
}
