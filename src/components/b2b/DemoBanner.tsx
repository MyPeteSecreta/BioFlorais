import { DEMO_BANNER_TEXT } from "@/lib/b2b/demo";

/**
 * Faixa FIXA no topo de todas as telas do demo e do link do cliente de demonstração.
 * Sem hooks: serve para o layout do vendedor (servidor) e para o componente do cliente.
 */
export default function DemoBanner({ ctaUrl }: { ctaUrl?: string }) {
  return (
    <div role="status" className="sticky top-0 z-[90] border-b-2 border-amber-400 bg-amber-100" data-testid="faixa-demo">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="text-xs font-extrabold leading-snug text-amber-950 sm:text-sm">{DEMO_BANNER_TEXT}</p>

        {ctaUrl ? (
          <a href={ctaUrl} className="shrink-0 rounded-full bg-[#55245f] px-5 py-2 text-xs font-extrabold text-white sm:text-sm">
            Quero ser representante
          </a>
        ) : null}
      </div>
    </div>
  );
}
