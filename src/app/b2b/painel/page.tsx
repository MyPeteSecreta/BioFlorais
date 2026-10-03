/**
 * BIO FLORAIS B2B — área do vendedor: SÓ os clientes dele.
 * Fluxo (Especificação V1.26–V1.29): cliente -> Offer Builder ->
 * revisão obrigatória -> link.
 */

import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { b2bClients, b2bCommercialGroups, b2bOfferLineViews } from "@/lib/db/schema";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { getAppSqlRunner, listOwnedClients } from "@/lib/b2b/ownership";
import NewClientForm from "@/components/b2b/NewClientForm";

export const dynamic = "force-dynamic";

async function loadInterests(responsibleId: string) {
  try {
    const lastViewedAt = sql<Date>`max(${b2bOfferLineViews.viewedAt})`;

    return await db
      .select({
        clientId: b2bOfferLineViews.clientId,
        clientName: b2bClients.displayName,
        lineId: b2bOfferLineViews.commercialGroupId,
        lineName: b2bCommercialGroups.name,
        views: sql<number>`count(*)::int`,
        lastViewedAt,
      })
      .from(b2bOfferLineViews)
      .innerJoin(b2bClients, eq(b2bClients.id, b2bOfferLineViews.clientId))
      .innerJoin(b2bCommercialGroups, eq(b2bCommercialGroups.id, b2bOfferLineViews.commercialGroupId))
      .where(eq(b2bOfferLineViews.responsibleId, responsibleId))
      .groupBy(
        b2bOfferLineViews.clientId,
        b2bClients.displayName,
        b2bOfferLineViews.commercialGroupId,
        b2bCommercialGroups.name
      )
      .orderBy(desc(lastViewedAt))
      .limit(30);
  } catch (error) {
    // Tabela ainda não criada (SQL 05b): painel segue sem o bloco.
    console.error("[b2b/painel] interesses indisponíveis", error);
    return [];
  }
}

export default async function B2BPanelPage() {
  const responsible = await requireResponsiblePage();
  const [clients, interests] = await Promise.all([
    listOwnedClients(getAppSqlRunner(), responsible.id),
    loadInterests(responsible.id),
  ]);

  const ownedIds = new Set(clients.map((client) => client.id));

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      <div className="max-w-3xl">
        <h1 className="font-serif text-4xl font-semibold text-[#55245f]">Seus clientes</h1>
        <p className="mt-2 text-[#746471]">
          Escolha um cliente para montar a oferta: linhas, condição comercial de cada uma e revisão
          antes de gerar o link.
        </p>
      </div>

      <NewClientForm />

      {interests.filter((item) => ownedIds.has(item.clientId)).length > 0 && (
        <section className="mt-8 rounded-[24px] border border-blue-200 bg-blue-50/60 p-5">
          <h2 className="font-extrabold text-blue-900">Interesses dos clientes</h2>
          <p className="mt-1 text-sm text-blue-900/80">
            Linhas que o cliente abriu pelo link e que não estavam na oferta.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {interests
              .filter((item) => ownedIds.has(item.clientId))
              .map((interest) => (
                <li
                  key={`${interest.clientId}-${interest.lineId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3"
                >
                  <span>
                    <strong>{interest.clientName}</strong> visualizou a linha <strong>{interest.lineName}</strong> fora da
                    oferta ({Number(interest.views)} {Number(interest.views) === 1 ? "vez" : "vezes"}), em{" "}
                    {new Date(interest.lastViewedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
                    <span className="mt-1 block text-xs font-bold text-blue-900">
                      Que tal mandar uma nova oferta com essa linha?
                    </span>
                  </span>
                  <Link
                    href={`/b2b/painel/cliente/${interest.clientId}/oferta?linha=${interest.lineId}`}
                    className="rounded-full bg-[#55245f] px-4 py-1.5 text-xs font-extrabold text-white"
                  >
                    Montar nova oferta
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        {clients.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
            Você ainda não tem clientes. Cadastre o primeiro acima — só o nome é obrigatório.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/b2b/painel/cliente/${client.id}`}
                  className="block h-full rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-lg font-extrabold text-[#422347]">{client.displayName}</p>
                  <p className="mt-1 text-sm text-[#8a7886]">
                    {[client.contactName, client.phone, client.email].filter(Boolean).join(" · ") ||
                      "Sem contato cadastrado"}
                  </p>
                  <span className="mt-4 inline-block text-sm font-extrabold text-[#63326d]">
                    Abrir cliente →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
