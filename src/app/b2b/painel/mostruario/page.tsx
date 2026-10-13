/**
 * BIO FLORAIS B2B — "Solicitar mostruário": loja interna do vendedor/RCA com os itens liberados,
 * preço de mostruário e limites por janela. Só aparece na área do vendedor; B2C intocado.
 */

import Link from "next/link";

import ShowcaseStore from "@/components/b2b/ShowcaseStore";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { buildShowcaseView, loadShowcaseState } from "@/lib/b2b/showcase-state";

export const dynamic = "force-dynamic";

export default async function ShowcasePage() {
  const responsible = await requireResponsiblePage();
  const state = await loadShowcaseState(getAppSqlRunner(), responsible.id);

  const header = (
    <div className="max-w-3xl">
      <Link href="/b2b/painel" className="text-sm font-bold text-[#63326d] underline">
        ← Seus clientes
      </Link>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-[#55245f]">Solicitar mostruário</h1>
    </div>
  );

  if (!state.config.available) {
    return (
      <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
        {header}
        <p className="mt-6 rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
          O mostruário estará disponível em breve.
        </p>
      </main>
    );
  }

  if (!state.eligibility.ok || !state.vendor) {
    const message = state.eligibility.ok ? "Cadastro do vendedor não encontrado." : state.eligibility.message;
    const canComplete = !state.eligibility.ok && state.eligibility.reason !== "demo";

    return (
      <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
        {header}
        <div className="mt-6 max-w-xl rounded-[24px] border border-amber-300 bg-amber-50 p-6" role="status" data-testid="showcase-blocked">
          <p className="font-bold text-amber-950">{message}</p>
          {canComplete && (
            <Link href="/b2b/painel/cadastro" className="mt-4 inline-block rounded-full bg-[#55245f] px-5 py-2.5 text-sm font-extrabold text-white">
              Completar cadastro
            </Link>
          )}
        </div>
      </main>
    );
  }

  const vendor = state.vendor;

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      {header}
      <ShowcaseStore
        sections={buildShowcaseView(state)}
        windowDays={state.config.windowDays}
        percent={state.config.percent}
        vendor={{
          name: vendor.name,
          email: vendor.email,
          postalCode: vendor.postalCode,
          street: vendor.street,
          addressNumber: vendor.addressNumber,
          addressComplement: vendor.addressComplement,
          neighborhood: vendor.neighborhood,
          city: vendor.city,
          state: vendor.state,
        }}
      />
    </main>
  );
}
