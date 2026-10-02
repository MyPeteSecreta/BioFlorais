/**
 * BIO FLORAIS B2B — cliente do vendedor: ofertas e status do link.
 * Cliente de outro vendedor (ou id inválido) -> 404 (ownership.ts).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import {
  findOwnedClient,
  getAppSqlRunner,
  listOwnedOffersForClient,
} from "@/lib/b2b/ownership";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { loadClientLineSummary } from "@/lib/b2b/line-windows";
import OfferLinkActions from "@/components/b2b/OfferLinkActions";

export const dynamic = "force-dynamic";

function offerState(offer: { status: string; activatedAt: Date | null; revokedAt: Date | null; hasActiveLink: boolean }) {
  if (offer.revokedAt) return { label: "Oferta revogada", className: "bg-[#f3eef2] text-[#7b6a77]" };
  if (!offer.activatedAt || offer.status === "draft") {
    return { label: "Rascunho — falta revisar", className: "bg-[#fff4db] text-[#8a5a12]" };
  }
  return offer.hasActiveLink
    ? { label: "Link ativo", className: "bg-[#e3f5e9] text-[#1f6b3a]" }
    : { label: "Ativa, sem link", className: "bg-[#e8f0ff] text-[#274b8f]" };
}

export default async function B2BClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();
  const client = await findOwnedClient(run, responsible.id, clientId);

  if (!client) {
    notFound();
  }

  const [offers, matrix] = await Promise.all([
    listOwnedOffersForClient(run, responsible.id, client.id),
    loadCommissionMatrix(run, responsible.id, client.id),
  ]);
  const lineSummary = await loadClientLineSummary(run, client.id, matrix);

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-10 lg:px-10">
      <Link href="/b2b/painel" className="text-sm font-bold text-[#63326d] underline underline-offset-4">
        ← Meus clientes
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-[#55245f]">{client.displayName}</h1>
          <p className="mt-1 text-sm text-[#8a7886]">
            {[client.contactName, client.phone, client.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
          </p>
        </div>
        <Link
          href={`/b2b/painel/cliente/${client.id}/oferta`}
          className="rounded-full bg-[#55245f] px-6 py-3 text-sm font-extrabold text-white shadow"
        >
          Montar nova oferta →
        </Link>
      </div>

      {lineSummary.length > 0 && (
        <section className="mt-6 rounded-[20px] border border-[#d9c7dc] bg-white p-4 text-sm text-[#55245f]">
          <h2 className="font-extrabold">Compras por linha e comissão no preço normal</h2>
          <p className="mt-1 text-xs text-[#8a7886]">
            As regras e os prazos são do cliente: continuam os mesmos se ele trocar de vendedor.
          </p>
          <ul className="mt-3 space-y-1">
            {lineSummary.map((line) => (
              <li key={line.name}>
                <strong>{line.name}:</strong> {line.text || "comissão não configurada"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 space-y-3">
        <h2 className="font-extrabold">Ofertas</h2>
        {offers.length === 0 && (
          <p className="rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-6 text-sm text-[#746471]">
            Nenhuma oferta ainda. Clique em &quot;Montar nova oferta&quot;.
          </p>
        )}
        {offers.map((offer) => {
          const state = offerState(offer);
          const isDraft = !offer.activatedAt && !offer.revokedAt;

          return (
            <article key={offer.id} className="rounded-[20px] border border-[#eadfd9] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    {offer.lines} linha(s) · {offer.promotions} promoção(ões)
                  </p>
                  <p className="text-xs text-[#8a7886]">
                    Criada em {offer.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {offer.activatedAt
                      ? ` · ativada em ${offer.activatedAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                      : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${state.className}`}>{state.label}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {isDraft ? (
                  <>
                    <Link
                      href={`/b2b/painel/cliente/${client.id}/oferta/revisao?offerId=${offer.id}`}
                      className="rounded-full bg-[#55245f] px-4 py-2 text-xs font-extrabold text-white"
                    >
                      Revisar e gerar link →
                    </Link>
                    <Link
                      href={`/b2b/painel/cliente/${client.id}/oferta?offerId=${offer.id}`}
                      className="rounded-full border border-[#55245f] px-4 py-2 text-xs font-extrabold text-[#55245f]"
                    >
                      Editar rascunho
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/b2b/painel/cliente/${client.id}/oferta/revisao?offerId=${offer.id}`}
                      className="rounded-full border border-[#55245f] px-4 py-2 text-xs font-extrabold text-[#55245f]"
                    >
                      Ver condições
                    </Link>
                    {!offer.revokedAt && (
                      <OfferLinkActions offerId={offer.id} hasActiveLink={offer.hasActiveLink} />
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
