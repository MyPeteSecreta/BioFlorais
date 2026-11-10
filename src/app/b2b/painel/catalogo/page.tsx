import Image from "next/image";
import Link from "next/link";

import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { loadDemoState } from "@/lib/b2b/demo";
import { loadBuilderLines } from "@/lib/b2b/offer-builder";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { describeDeal, priceRangeText } from "@/lib/b2b/promo-explain";
import {
  CATALOG_COMMISSION_SEAL,
  CATALOG_CONDITIONS,
  CATALOG_MATERIAL_BY_LINE,
  CATALOG_TRY_PATH,
  CATALOG_VIDEO_URL,
  groupCatalogLines,
  promotionValidityText,
} from "@/lib/b2b/rep-catalog";
import { findMaterial } from "@/lib/b2b/sales-materials";

export const dynamic = "force-dynamic";

/**
 * CATÁLOGO DO REPRESENTANTE: só leitura. Linhas, preço ao lojista, promoções vigentes com validade, PDFs de Materiais de venda
 * e o vídeo "Como funciona em 1 minuto". Nada se cria aqui; o botão do fim leva ao fluxo de cliente que já existe no painel.
 */
export default async function CatalogPage() {
  const responsible = await requireResponsiblePage();
  const [demo, lines] = await Promise.all([loadDemoState(getAppSqlRunner(), responsible.id), loadBuilderLines(new Date(), null)]);
  const groups = groupCatalogLines(lines);

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-10 lg:px-10" data-testid="catalogo-representante">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f] sm:text-4xl">Catálogo</h1>
      <p className="mt-2 max-w-[760px] text-sm leading-6 text-[#746471]">
        As linhas da Bio Florais, o preço para o lojista e as promoções que você pode oferecer hoje. Aqui você só consulta: nada é criado.
      </p>

      <section className="mt-5 rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm" data-testid="catalogo-condicoes">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#9b6c24]">Condições para o lojista</p>
        <ul className="mt-3 grid gap-2 text-sm font-bold text-[#422347] sm:grid-cols-3">
          {CATALOG_CONDITIONS.map((condition) => (
            <li key={condition} className="rounded-2xl bg-[#fbf5f1] px-4 py-3">
              {condition}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex self-start rounded-full bg-[#55245f] px-4 py-2 text-sm font-extrabold text-white" data-testid="selo-comissao">
            {CATALOG_COMMISSION_SEAL}
          </p>
          <a
            href={CATALOG_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center rounded-full border-2 border-[#55245f] px-5 text-center text-sm font-extrabold text-[#55245f]"
            data-testid="catalogo-video"
          >
            ▶ Como funciona em 1 minuto
          </a>
        </div>
      </section>

      {groups.length === 0 ? (
        <p className="mt-8 rounded-[24px] border border-dashed border-[#d9c7dc] bg-white p-8 text-center text-[#746471]">
          O catálogo está sendo atualizado. Volte em instantes.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="mt-8" data-testid={`catalogo-grupo-${group.key}`}>
          <h2 className="text-xl font-extrabold text-[#422347]">{group.title}</h2>
          <ul className="mt-3 grid gap-4 lg:grid-cols-2">
            {group.lines.map((line) => {
              const material = findMaterial(CATALOG_MATERIAL_BY_LINE[line.slug] ?? "");
              const price = priceRangeText(line.priceRange);

              return (
                <li key={line.id} className="flex flex-col rounded-[24px] border border-[#eadfd9] bg-white p-5 shadow-sm" data-testid="catalogo-linha">
                  <div className="flex gap-4">
                    {line.image ? (
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-[#fbf5f1] sm:h-24 sm:w-36">
                        <Image src={line.image} alt={line.name} fill sizes="144px" className="object-cover" />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-[#55245f]">{line.name}</p>
                      <p className="mt-1 text-sm text-[#422347]" data-testid="catalogo-preco">
                        <span className="text-[#746471]">Preço ao lojista: </span>
                        <strong>{price ?? "consulte"}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-[#fbf5f1] p-4" data-testid="catalogo-promocoes">
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#9b6c24]">Promoções vigentes</p>
                    {line.promotions.length === 0 ? (
                      <p className="mt-2 text-sm text-[#746471]">Sem promoção agora: vale o preço ao lojista.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {line.promotions.map((promotion) => {
                          const deal = describeDeal(promotion, promotion.priceRange);

                          return (
                            <li key={promotion.id} className="text-sm text-[#422347]">
                              <p>
                                <strong className="text-[#55245f]">{deal.headline}</strong> · {deal.summary}
                              </p>
                              {promotion.scopeText ? <p className="text-xs text-[#746471]">Oferta válida para {promotion.scopeText}.</p> : null}
                              <p className="text-xs font-bold text-[#8a5a12]" data-testid="catalogo-validade">
                                {promotionValidityText(promotion.endsAt)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {material ? (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row" data-testid="catalogo-pdfs">
                      {demo.isDemo ? (
                        <span className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border-2 border-[#d9c7dc] px-4 text-center text-xs font-extrabold text-[#8a7886]">
                          PDF do lojista (após o cadastro)
                        </span>
                      ) : (
                        <a
                          href={`/api/b2b/materiais/${material.id}?versao=lojista`}
                          className="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[#55245f] px-4 text-center text-xs font-extrabold text-white"
                          data-testid="catalogo-pdf-lojista"
                        >
                          PDF para o lojista
                        </a>
                      )}
                      <a
                        href={`/api/b2b/materiais/${material.id}?versao=representante`}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border-2 border-[#9b1c1c] px-4 text-center text-xs font-extrabold text-[#9b1c1c]"
                        data-testid="catalogo-pdf-representante"
                      >
                        PDF do representante · uso interno
                      </a>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-10 rounded-[24px] bg-[#55245f] p-6 text-center text-white" data-testid="catalogo-quero-testar">
        <p className="text-lg font-extrabold">Quer ver na prática?</p>
        <p className="mt-1 text-sm text-white/85">Crie um cliente de exemplo (só o nome) e monte uma oferta para ver como o lojista recebe.</p>
        <Link
          href={CATALOG_TRY_PATH}
          className="mx-auto mt-4 flex min-h-[48px] max-w-[420px] items-center justify-center rounded-full bg-white px-6 text-center text-sm font-extrabold text-[#55245f]"
          data-testid="catalogo-criar-exemplo"
        >
          Quero testar: criar um cliente de exemplo
        </Link>
      </section>
    </main>
  );
}
