"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CheckoutPagamentoContent() {
  const searchParams = useSearchParams();

  const orderId =
    searchParams.get("orderId") ?? "";

  return (
    <main className="min-h-screen bg-[#f8f5ee] px-5 py-12 text-[#26352c]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#26352c]/50">
          Bio Florais
        </p>

        <h1 className="mt-2 text-3xl font-medium md:text-4xl">
          Pagamento
        </h1>

        <section className="mt-8 rounded-[28px] border border-[#26352c]/10 bg-white p-7 shadow-sm md:p-9">
          <p className="text-sm text-[#26352c]/60">
            Pedido criado com sucesso.
          </p>

          <div className="mt-5 rounded-2xl bg-[#f8f5ee] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#26352c]/45">
              Pedido
            </p>

            <p className="mt-2 break-all text-sm font-medium">
              {orderId || "Pedido nao identificado"}
            </p>
          </div>

          <h2 className="mt-7 text-xl font-medium">
            Pagamento via Pix
          </h2>

          <p className="mt-3 text-sm leading-6 text-[#26352c]/65">
            O pedido esta registrado e aguardando pagamento.
          </p>

          <div className="mt-7 rounded-2xl border border-[#26352c]/10 p-5">
            <p className="text-sm font-medium">
              Aguardando pagamento
            </p>

            <p className="mt-2 text-xs leading-5 text-[#26352c]/55">
              Nenhuma cobranca foi realizada ate este momento.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-[#26352c] px-6 py-3 text-sm font-medium text-white"
            >
              Voltar para a loja
            </Link>

            <Link
              href="/carrinho"
              className="rounded-full border border-[#26352c]/20 px-6 py-3 text-sm font-medium"
            >
              Ver sacola
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CheckoutPagamentoPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPagamentoContent />
    </Suspense>
  );
}
