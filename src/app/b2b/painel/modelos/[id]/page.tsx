/**
 * BIO FLORAIS B2B — L2: criar/editar um modelo de oferta com o MESMO Offer Builder (linhas, promoção e
 * elegibilidade por linha, comissão), sem cliente definido: tudo aparece disponível e é reconferido
 * contra o cliente na hora de gerar o link.
 */

import { notFound } from "next/navigation";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { loadCommissionMatrix } from "@/lib/b2b/commission";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { getTemplate } from "@/lib/b2b/offer-templates";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import OfferBuilder, { type BuilderChoice } from "../../cliente/[clientId]/oferta/OfferBuilder";

export const dynamic = "force-dynamic";

export default async function TemplateBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();

  const template = id === "novo" ? null : await getTemplate(run, responsible.id, id).catch(() => null);

  if (id !== "novo" && !template) notFound();

  const [lines, matrix] = await Promise.all([loadBuilderLines(new Date(), null), loadCommissionMatrix(run, responsible.id, null)]);

  const initialChoices: Record<string, BuilderChoice> = {};

  for (const item of template?.promotions ?? []) {
    initialChoices[item.commercialGroupId] = {
      promotionId: item.promotionId,
      eligibilityMode: item.eligibilityMode,
      maxUses: item.maxUses,
      durationDays: item.durationDays,
    };
  }

  return (
    <OfferBuilder
      clientId=""
      clientName="Modelo de oferta"
      responsibleName={responsible.name}
      offerId={null}
      lines={lines}
      matrix={matrix}
      windowTextByLine={{}}
      initialSelected={(template?.commercialGroupIds ?? []).filter((groupId) => lines.some((line) => line.id === groupId))}
      initialChoices={initialChoices}
      templateMode={{ id: template?.id ?? null, name: template?.name ?? "" }}
    />
  );
}
