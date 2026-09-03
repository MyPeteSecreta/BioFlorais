import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#eadfd9] bg-[#fffaf6] px-4 pb-8 pt-6 md:px-6 md:pb-24 md:pt-12 lg:px-10">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-2 md:gap-10 lg:grid-cols-4">

        <div>
          <p className="font-serif text-xl font-semibold text-[#55245f] md:text-2xl">
            Bio Florais
          </p>

          <p className="mt-2 max-w-[290px] text-xs leading-5 text-[#726571] md:mt-4 md:text-base md:leading-7">
            Equilíbrio, natureza e cuidado para diferentes momentos da vida.
          </p>

          <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a27731] md:mt-4 md:text-xs md:tracking-[0.18em]">
            Desde 1997
          </p>
        </div>


        <div>
          <p className="font-bold text-[#3d2840]">
            Descubra
          </p>

          <div className="mt-2 flex flex-col gap-1.5 text-xs text-[#746674] md:mt-4 md:gap-3 md:text-sm">
            <Link href="/linha/adulto" className="hover:text-[#63326d]">
              Adulto
            </Link>

            <Link href="/linha/pet" className="hover:text-[#63326d]">
              Pet
            </Link>

            <Link href="/linha/infantil" className="hover:text-[#63326d]">
              Infantil
            </Link>

            <Link href="/#linhas" className="hover:text-[#63326d]">
              Todas as linhas
            </Link>
          </div>
        </div>


        <div>
          <p className="font-bold text-[#3d2840]">
            Bio Florais
          </p>

          <div className="mt-2 flex flex-col gap-1.5 text-xs text-[#746674] md:mt-4 md:gap-3 md:text-sm">
            <Link href="/sobre" className="hover:text-[#63326d]">
              Conheça a marca
            </Link>

            <Link href="/terapia-floral" className="hover:text-[#63326d]">
              Terapia floral
            </Link>

            <Link href="/#quiz" className="hover:text-[#63326d]">
              Descubra seu floral
            </Link>

            <Link href="/atendimento" className="hover:text-[#63326d]">
              Atendimento
            </Link>
          </div>
        </div>


        <div>
          <p className="font-bold text-[#3d2840]">
            Atendimento
          </p>

          <div className="mt-2 flex flex-col gap-1.5 text-xs text-[#746674] md:mt-4 md:gap-3 md:text-sm">
            <Link href="/privacidade" className="hover:text-[#63326d]">
              Política de Privacidade
            </Link>

            <Link href="/cookies" className="hover:text-[#63326d]">
              Política de Cookies
            </Link>

            <Link href="/termos-de-compra" className="hover:text-[#63326d]">
              Termos de Compra
            </Link>

            <Link href="/trocas-e-devolucoes" className="hover:text-[#63326d]">
              Trocas e Devoluções
            </Link>

            <Link href="/frete-e-entrega" className="hover:text-[#63326d]">
              Frete e Entrega
            </Link>
          </div>
        </div>
      </div>


      <div className="mx-auto mt-6 max-w-[1440px] border-t border-[#eadfd9] pt-4 md:mt-10 md:pt-7">

        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8b687e] md:mb-4 md:text-xs md:tracking-[0.16em]">
          Siga Bio Florais
        </p>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">

          <a
            href="https://www.instagram.com/bioflorais"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#dfd1d9] bg-white px-3 py-2 text-[11px] font-bold text-[#63326d] transition hover:-translate-y-0.5 md:px-5 md:py-3 md:text-sm"
          >
            Instagram Bio Florais
          </a>

          <a
            href="https://www.instagram.com/insta.biofloraispet/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#dfd1d9] bg-white px-3 py-2 text-[11px] font-bold text-[#63326d] transition hover:-translate-y-0.5 md:px-5 md:py-3 md:text-sm"
          >
            Instagram Bio Florais Pet
          </a>

          <span
            title="Perfil oficial do TikTok ainda será informado"
            className="rounded-full border border-[#dfd1d9] bg-white px-3 py-2 text-[11px] font-bold text-[#a28b99] md:px-5 md:py-3 md:text-sm"
          >
            TikTok
          </span>

        </div>
      </div>


      <div className="mx-auto mt-5 flex max-w-[1440px] flex-col gap-2 border-t border-[#eadfd9] pt-4 text-[10px] text-[#8b7c89] sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-6 sm:text-xs">

        <span>
          © 2026 Bio Florais
        </span>

        <div className="flex flex-wrap items-center gap-2 sm:gap-5">
          <span>
            Flores frescas brasileiras · Sem álcool
          </span>

          <Link
            href="/admin/login"
            className="font-bold text-[#624067] hover:text-[#3f2144]"
          >
            Área Interna
          </Link>
        </div>

      </div>
    </footer>
  );
}
