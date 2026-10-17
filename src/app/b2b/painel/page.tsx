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
import { getAppSqlRunner, listOwnedClients, listOwnedOffersForClient } from "@/lib/b2b/ownership";
import ClientCardActions from "@/components/b2b/ClientCardActions";
import LinkChooser from "@/components/b2b/LinkChooser";
import OfferForClientCard from "@/components/b2b/OfferForClientCard";
import QuickLinkPanel from "@/components/b2b/QuickLinkPanel";
import { loadDemoState } from "@/lib/b2b/demo";
import ReferralLinkPanel from "@/components/b2b/ReferralLinkPanel";
import { ensureReferralCode, partnersPath } from "@/lib/b2b/partners";
import { getSiteUrl } from "@/lib/seo/site-url";

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
  const firstName = responsible.name.trim().split(/\s+/)[0] || "representante";

  // Oferta ativa (com link) mais recente de cada cliente: "Oferta ativa desde dd/mm" e os botões de link.
  const activeOfferByClient = new Map<string, { offerId: string; since: Date }>();
  await Promise.all(
    clients.map(async (client) => {
      const offers = await listOwnedOffersForClient(getAppSqlRunner(), responsible.id, client.id).catch(() => []);
      const active = offers.find((offer) => offer.activatedAt && !offer.revokedAt && offer.hasActiveLink);
      if (active && active.activatedAt) activeOfferByClient.set(client.id, { offerId: active.id, since: active.activatedAt });
    })
  );
  const demo = await loadDemoState(getAppSqlRunner(), responsible.id);
  // Demonstração não tem link de captação (não recebe lojistas reais).
  const referralCode = demo.isDemo ? null : await ensureReferralCode(getAppSqlRunner(), responsible.id);

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f] sm:text-4xl" data-testid="saudacao">
        Olá, {firstName}. O que você quer fazer agora?
      </h1>

      {/* 1. Card principal: a oferta personalizada é o que mais vende. */}
      <OfferForClientCard clients={clients.map((client) => ({ id: client.id, displayName: client.displayName }))} />

      {/* 2. Lançar pedido */}
      {!demo.isDemo && (
        <section className="mt-5 rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm" data-testid="card-lancar-pedido">
          <h2 className="text-xl font-extrabold text-[#422347]">Lançar pedido</h2>
          <p className="mt-1 text-sm text-[#746471]">
            O lojista está com você (na loja ou ao telefone) e não quer link? Lance o pedido por ele: Pix para mostrar ou enviar,
            boleto PJ ou link de pagamento do cartão.
          </p>
          <Link
            href="/b2b/painel/lancar-pedido"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#55245f] px-6 text-base font-extrabold text-white sm:w-auto sm:inline-flex"
            data-testid="lancar-pedido-botao"
          >
            Lançar pedido
          </Link>
        </section>
      )}

      {/* 3. Links rápidos */}
      <section className="mt-8" data-testid="links-rapidos">
        <h2 className="text-xl font-extrabold text-[#422347]">Links rápidos — preço de lojista, sem promoção</h2>
        <p className="mt-1 text-sm text-[#746471]">Todas as linhas, preço B2B cheio (sem promoção). Comissão normal para você.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <QuickLinkPanel demo={demo.isDemo} clients={clients.map((client) => ({ id: client.id, displayName: client.displayName }))} />
          {referralCode && <ReferralLinkPanel url={`${getSiteUrl()}${partnersPath(referralCode)}`} />}
        </div>
        <LinkChooser />
      </section>

      {/* 4. Mostruário */}
      {!demo.isDemo && (
        <section className="mt-8 rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm" data-testid="card-mostruario">
          <h2 className="text-xl font-extrabold text-[#422347]">Mostruário</h2>
          <p className="mt-1 text-sm text-[#746471]">
            Peça amostras para mostrar aos lojistas, com preço de mostruário e limite por linha a cada 45 dias.
          </p>
          <Link
            href="/b2b/painel/mostruario"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-[#55245f] px-6 text-base font-extrabold text-[#55245f] sm:w-auto sm:inline-flex"
          >
            Solicitar mostruário
          </Link>
        </section>
      )}


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

      <section className="mt-10" data-testid="meus-clientes">
        <h2 className="text-xl font-extrabold text-[#422347]">Meus clientes</h2>
        {clients.length === 0 ? (
          <p className="mt-4 rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
            Você ainda não tem clientes. Toque em &quot;+ Cliente novo&quot; no card acima — só o nome é obrigatório.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => {
              const active = activeOfferByClient.get(client.id) ?? null;

              return (
                <li key={client.id} className="flex h-full flex-col rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm">
                  <Link href={`/b2b/painel/cliente/${client.id}`} className="block">
                    <p className="text-lg font-extrabold text-[#422347]">{client.displayName}</p>
                    <p className="mt-1 text-sm text-[#8a7886]">
                      {[client.contactName, client.phone, client.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                    </p>
                  </Link>
                  {active ? (
                    <p className="mt-2 text-xs font-bold text-[#1f6b3a]" data-testid="oferta-ativa-desde">
                      Oferta ativa desde {active.since.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-[#8a7886]">Ainda sem oferta ativa</p>
                  )}
                  <div className="mt-auto">
                    <ClientCardActions
                      clientId={client.id}
                      clientName={client.displayName}
                      offerId={active?.offerId ?? null}
                      demo={demo.isDemo}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
