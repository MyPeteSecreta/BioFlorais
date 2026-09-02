import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#eadfd9] bg-[#fffaf6] px-6 pb-24 pt-12 lg:px-10">
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-2 lg:grid-cols-4">

        <div>
          <p className="font-serif text-2xl font-semibold text-[#55245f]">
            Bio Florais
          </p>

          <p className="mt-4 max-w-[290px] leading-7 text-[#726571]">
            Equilíbrio, natureza e cuidado para diferentes momentos da vida.
          </p>

          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#a27731]">
            Desde 1997
          </p>
        </div>


        <div>
          <p className="font-bold text-[#3d2840]">
            Descubra
          </p>

          <div className="mt-4 flex flex-col gap-3 text-sm text-[#746674]">
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

          <div className="mt-4 flex flex-col gap-3 text-sm text-[#746674]">
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

          <div className="mt-4 flex flex-col gap-3 text-sm text-[#746674]">
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


      <div className="mx-auto mt-10 max-w-[1440px] border-t border-[#eadfd9] pt-7">

        <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[#8b687e]">
          Siga Bio Florais
        </p>

        <div className="flex flex-wrap items-center gap-3">

          <a
            href="https://www.instagram.com/bioflorais"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#dfd1d9] bg-white px-5 py-3 text-sm font-bold text-[#63326d] transition hover:-translate-y-0.5"
          >
            Instagram Bio Florais
          </a>

          <a
            href="https://www.instagram.com/insta.biofloraispet/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#dfd1d9] bg-white px-5 py-3 text-sm font-bold text-[#63326d] transition hover:-translate-y-0.5"
          >
            Instagram Bio Florais Pet
          </a>

          <span
            title="Perfil oficial do TikTok ainda será informado"
            className="rounded-full border border-[#dfd1d9] bg-white px-5 py-3 text-sm font-bold text-[#a28b99]"
          >
            TikTok
          </span>

        </div>
      </div>


      <div className="mx-auto mt-8 flex max-w-[1440px] flex-col gap-4 border-t border-[#eadfd9] pt-6 text-xs text-[#8b7c89] sm:flex-row sm:items-center sm:justify-between">

        <span>
          © 2026 Bio Florais
        </span>

        <div className="flex flex-wrap items-center gap-5">
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
