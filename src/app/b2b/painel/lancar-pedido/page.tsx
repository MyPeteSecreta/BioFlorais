/**
 * BIO FLORAIS B2B — "Lançar pedido": o vendedor lança o pedido pelo cliente (na loja ou ao telefone),
 * pela MESMA loja do link, com as promoções que ele escolher. Só a área do vendedor; B2C intocado.
 */

import Link from "next/link";

import LaunchOrder from "@/components/b2b/LaunchOrder";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { loadDemoState } from "@/lib/b2b/demo";
import { getAppSqlRunner, listOwnedClients } from "@/lib/b2b/ownership";

export const dynamic = "force-dynamic";

export default async function LaunchOrderPage() {
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();
  const [clients, demo] = await Promise.all([listOwnedClients(run, responsible.id), loadDemoState(run, responsible.id)]);

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      <div className="max-w-3xl">
        <Link href="/b2b/painel" className="text-sm font-bold text-[#63326d] underline">
          ← Seus clientes
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#55245f]">Lançar pedido</h1>
        <p className="mt-2 text-[#746471]">
          Está com o cliente na loja ou ao telefone? Escolha o cliente e a oferta, monte o pedido na mesma loja do link e
          receba por Pix, boleto (empresa) ou link de pagamento no cartão.
        </p>
      </div>

      {demo.isDemo ? (
        <p className="mt-6 max-w-xl rounded-[24px] border border-amber-300 bg-amber-50 p-6 font-bold text-amber-950" role="status">
          Demonstração: o lançamento de pedido real não está disponível.
        </p>
      ) : (
        <LaunchOrder clients={clients.map((client) => ({ id: client.id, displayName: client.displayName }))} />
      )}
    </main>
  );
}
