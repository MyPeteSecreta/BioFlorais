import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Hero do B2B do lojista (link da oferta, loja /parceiros e página de linha): o MESMO banner do B2C da
 * Bio Florais (Hero.png, gradiente, eyebrow e serifa da Home), com texto de lojista. Sem o trio de cards,
 * quiz, convite UGC, depoimentos ou blocos institucionais (regra visual do Luis, 11/10).
 * Mobile: imagem 16:9 com eyebrow e título como no B2C; desktop: faixa mais baixa que a Home.
 */
export const B2B_HERO_FACTS = "Pedido mínimo R$ 250 · frete especial B2B a partir de R$ 450 · Pix, cartão em até 3x e boleto PJ";

export default function B2BHero({
  title,
  subtitle,
  facts = B2B_HERO_FACTS,
  compact = false,
  children,
}: {
  title: string;
  /** Linha curta abaixo do título (ex.: "Atendido por ..."). */
  subtitle?: string | null;
  facts?: string;
  /** Página de linha: faixa mais baixa. */
  compact?: boolean;
  /** Ações (Voltar, Meus pedidos...) numa barra sob o hero. */
  children?: ReactNode;
}) {
  return (
    <div data-testid="hero-b2b">
      {/* MOBILE: igual ao hero mobile do B2C */}
      <section className="bg-[#fffdf9] lg:hidden">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#fffaf6]">
          <Image src="/assets/home/hero/Hero.png" alt="Bio Florais" fill priority sizes="100vw" className="object-contain" />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#fffdf9]/80 via-transparent to-[#fffdf9]/20" />

          <p className="absolute left-4 top-4 text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#9b6c24]">
            Bio Florais · Desde 1997
          </p>

          <h1 className="absolute bottom-4 left-4 max-w-[245px] font-serif text-[27px] font-semibold leading-[0.95] tracking-[-0.04em] text-[#422347]">
            {title}
          </h1>
        </div>

        <div className="px-5 py-3">
          {subtitle && <p className="text-[13px] font-bold leading-5 text-[#422347]">{subtitle}</p>}
          <p className="text-[12px] leading-5 text-[#594b58]">{facts}</p>
        </div>
      </section>

      {/* DESKTOP: mesma imagem e gradiente do B2C, em faixa mais baixa */}
      <section className={`relative hidden overflow-hidden lg:block ${compact ? "min-h-[260px]" : "min-h-[380px]"}`}>
        <Image src="/assets/home/hero/Hero.png" alt="Bio Florais" fill priority sizes="100vw" className="object-cover object-center" />

        <div className="absolute inset-0 bg-gradient-to-r from-[#fffdf9]/96 via-[#fffdf9]/55 to-transparent" />

        <div
          className={`relative mx-auto flex max-w-[1440px] items-center px-6 py-10 lg:px-10 ${compact ? "min-h-[260px]" : "min-h-[380px]"}`}
        >
          <div className="max-w-[640px]">
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.28em] text-[#9b6c24]">Bio Florais · Desde 1997</p>

            <h1
              className={`font-serif font-semibold leading-[0.98] tracking-[-0.045em] text-[#422347] ${compact ? "text-[44px]" : "text-[56px]"}`}
            >
              {title}
            </h1>

            {subtitle && <p className="mt-4 text-lg font-bold text-[#422347]">{subtitle}</p>}

            <p className="mt-3 max-w-[430px] text-base leading-7 text-[#594b58]">{facts}</p>

            <div className="mt-5 hidden flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold uppercase tracking-[0.13em] text-[#6e596b] sm:flex">
              <span>Sem álcool</span>
              <span className="text-[#c39745]">•</span>
              <span>Flores frescas brasileiras</span>
              <span className="text-[#c39745]">•</span>
              <span>Desde 1997</span>
            </div>
          </div>
        </div>
      </section>

      {children && (
        <div className="border-y border-[#eadfd9] bg-white">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-2 px-5 py-3 lg:px-10">{children}</div>
        </div>
      )}
    </div>
  );
}
