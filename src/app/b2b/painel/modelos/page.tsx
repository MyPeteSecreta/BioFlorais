/**
 * BIO FLORAIS B2B — L2 "Ofertas prontas" (era "Minhas ofertas padrão"): modelos do vendedor (nome + linhas + promoção/
 * elegibilidade por linha) e "Gerar link com minha oferta padrão".
 */

import Link from "next/link";

import TemplatesPanel, { type TemplateView } from "@/components/b2b/TemplatesPanel";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { loadDemoState } from "@/lib/b2b/demo";
import { listTemplates } from "@/lib/b2b/offer-templates";
import { getAppSqlRunner, listOwnedClients } from "@/lib/b2b/ownership";
import { promotionShortLabel } from "@/lib/b2b/commission";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const responsible = await requireResponsiblePage();
  const run = getAppSqlRunner();

  let templates: Awaited<ReturnType<typeof listTemplates>> = [];
  let missingTable = false;

  try {
    templates = await listTemplates(run, responsible.id);
  } catch (error) {
    console.error("[b2b/painel/modelos] sem b2b_offer_templates", error);
    missingTable = true;
  }

  const [clients, lines, demo] = await Promise.all([
    listOwnedClients(run, responsible.id),
    loadBuilderLines(new Date(), null),
    loadDemoState(run, responsible.id),
  ]);
  const lineById = new Map(lines.map((line) => [line.id, line]));

  const views: TemplateView[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.commercialGroupIds.map((groupId) => {
      const line = lineById.get(groupId);
      const chosen = template.promotions.find((item) => item.commercialGroupId === groupId);
      const name = line?.name ?? "Linha indisponível";

      if (!chosen) return `${name} · preço B2B normal`;

      const promotion = line?.promotions.find((item) => item.id === chosen.promotionId);
      const label = promotion
        ? promotion.percent !== null
          ? `${String(promotion.percent).replace(".", ",")}% OFF`
          : promotionShortLabel(promotion.buyQuantity, promotion.freeQuantity)
        : (chosen.promotionName ?? "Promoção");
      const eligibility = chosen.eligibilityMode === "uses" ? `${chosen.maxUses} compra(s)` : `${chosen.durationDays} dias`;

      return `${name} · ${label} · ${eligibility}`;
    }),
  }));

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10">
      <Link href="/b2b/painel" className="text-sm font-bold text-[#63326d]">
        ← Painel
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="font-serif text-4xl font-semibold text-[#55245f]">Ofertas prontas</h1>
          <p className="mt-2 text-[#746471]">
            Monte uma vez as linhas e promoções que você mais usa e aplique em qualquer cliente em 1 clique. Se uma promoção não
            estiver disponível para aquele cliente, você vê o aviso antes de gerar.
          </p>
        </div>
        <Link
          href="/b2b/painel/modelos/novo"
          className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#55245f] px-8 text-lg font-extrabold text-white shadow-lg sm:w-auto"
          data-testid="criar-oferta-pronta"
        >
          + Criar oferta pronta
        </Link>
      </div>

      {missingTable && (
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Os modelos de oferta ainda não estão disponíveis (falta aplicar o SQL 34b). Fale com o administrador.
        </p>
      )}

      <section className="mt-8 max-w-3xl">
        <TemplatesPanel demo={demo.isDemo} templates={views} clients={clients.map((client) => ({ id: client.id, displayName: client.displayName }))} />
      </section>
    </main>
  );
}
