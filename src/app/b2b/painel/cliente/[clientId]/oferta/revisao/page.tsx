/**
 * BIO FLORAIS B2B — revisão obrigatória da oferta antes do link.
 * Mostra cada linha com a condição comercial e a comissão do vendedor
 * (base + extra = total). Só depois daqui o link é gerado.
 */

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { findOwnedClient, findOwnedOffer, getAppSqlRunner } from "@/lib/b2b/ownership";
import { formatPercent, loadCommissionMatrix, promotionShortLabel } from "@/lib/b2b/commission";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { describeEligibility, loadOfferReviewLines } from "@/lib/b2b/offer-review";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function OfferReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ offerId?: string }>;
}) {
  const { clientId } = await params;
  const { offerId } = await searchParams;
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();

  const client = await findOwnedClient(run, responsible.id, clientId);
  const offer = client && offerId ? await findOwnedOffer(run, responsible.id, offerId, client.id) : null;

  if (!client || !offer) {
    notFound();
  }

  const [lines, matrix] = await Promise.all([
    loadBuilderLines(),
    loadCommissionMatrix(run, responsible.id, client.id),
  ]);

  const reviewLines = await loadOfferReviewLines(offer.id, lines, matrix);
  const isDraft = !offer.activatedAt && offer.status === "draft" && !offer.revokedAt;
  const promotions = reviewLines.filter((line) => line.condition.kind === "promotion").length;
  const blocked = reviewLines.some((line) => line.promotionUnavailable);

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-10 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b6c24]">
          {isDraft ? "Revisão obrigatória" : "Oferta ativa"}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#55245f] md:text-5xl">
          {isDraft ? "Revise antes de enviar" : "Condições da oferta"}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-[#746471]">
          {isDraft
            ? "Confira linhas, condições e sua comissão. O link do cliente só é gerado depois desta revisão."
            : "Esta oferta já foi revisada e ativada. Para mudar as condições, monte uma nova oferta."}
        </p>
      </div>

      <section className="mt-8 flex flex-col gap-4 rounded-[28px] border border-[#eadfd9] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#9b6c24]">Cliente</p>
          <p className="mt-1 text-2xl font-extrabold">{client.displayName}</p>
          <p className="mt-1 text-sm text-[#746471]">
            Atendido por <strong>{responsible.name}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-[#f6eef7] px-5 py-3 text-center">
            <p className="text-2xl font-black text-[#55245f]">{reviewLines.length}</p>
            <p className="text-xs font-bold">linhas</p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-5 py-3 text-center">
            <p className="text-2xl font-black text-blue-700">{promotions}</p>
            <p className="text-xs font-bold text-blue-700">promoções</p>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-5">
        {reviewLines.map((line) => {
          const hasPromotion = line.condition.kind === "promotion";

          return (
            <article
              key={line.id}
              className={[
                "overflow-hidden rounded-[28px] border bg-white shadow-sm",
                hasPromotion ? "border-blue-300 ring-2 ring-blue-100" : "border-[#eadfd9]",
              ].join(" ")}
            >
              <div className="grid md:grid-cols-[300px_1fr]">
                <div className="bg-[#fbf5f1]">
                  {line.image ? (
                    <Image src={line.image} alt={line.name} width={1672} height={941} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex min-h-[170px] items-center justify-center p-6 font-serif text-2xl text-[#55245f]">
                      {line.name}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#9b6c24]">{line.name}</p>
                    <h3 className="mt-2 text-2xl font-extrabold">
                      {line.promotion
                        ? promotionShortLabel(line.promotion.buyQuantity, line.promotion.freeQuantity)
                        : hasPromotion
                          ? "Promoção indisponível"
                          : "Preço B2B normal"}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-[#746471]">{describeEligibility(line.condition)}</p>
                    {line.promotion && line.promotion.onlyProducts.length > 0 && (
                      <p className="mt-3 inline-flex rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950">
                        Somente {line.promotion.onlyProducts.map((product) => product.name).join(", ")}
                      </p>
                    )}
                    {line.promotionUnavailable && (
                      <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
                        Esta promoção não está mais disponível (inativa, fora da vigência ou sem regra de
                        comissão). Volte e edite a oferta.
                      </p>
                    )}
                  </div>
                  <div className="min-w-[200px] rounded-[22px] bg-[#342737] px-5 py-4 text-white">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-white/60">Sua comissão</p>
                    {line.commission && matrix.configured ? (
                      <>
                        <p className="mt-1 text-sm font-bold">
                          {formatPercent(line.commission.basePercent)} + {formatPercent(line.commission.extraPercent)}
                        </p>
                        <p className="text-2xl font-black">= {formatPercent(line.commission.totalPercent)}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm font-bold">Não configurada</p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <p className="mt-6 text-center text-xs text-[#8a7886]">
        A comissão é exibida só para você. O cliente vê apenas os produtos e preços da oferta.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {isDraft ? (
          <ReviewActions clientId={client.id} offerId={offer.id} blocked={blocked} />
        ) : (
          <Link
            href={`/b2b/painel/cliente/${client.id}`}
            className="rounded-full border-2 border-[#55245f] px-6 py-3 text-sm font-extrabold text-[#55245f]"
          >
            ← Voltar ao cliente
          </Link>
        )}
      </div>
    </main>
  );
}
