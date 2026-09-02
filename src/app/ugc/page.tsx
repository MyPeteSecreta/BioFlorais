import Link from "next/link";

export default function UgcPage() {
  return (
    <main className="min-h-screen bg-[#fffdf9] text-[#2f2231]">

      <section
        className="
          bg-gradient-to-br
          from-[#f7edf6]
          via-[#fffaf7]
          to-[#f5eadf]
          px-6
          py-20
          lg:px-10
          lg:py-28
        "
      >
        <div className="mx-auto max-w-[1000px]">

          <Link
            href="/"
            className="text-sm font-bold text-[#63326d]"
          >
            ← Voltar para Bio Florais
          </Link>

          <p
            className="
              mt-12
              text-xs
              font-extrabold
              uppercase
              tracking-[0.24em]
              text-[#a27731]
            "
          >
            Programa de Criadoras
          </p>

          <h1
            className="
              mt-4
              max-w-[760px]
              font-serif
              text-5xl
              font-semibold
              leading-[0.98]
              tracking-[-0.04em]
              text-[#422347]
              sm:text-6xl
            "
          >
            Crie conteúdo.
            Compartilhe experiências.
            Ganhe com suas indicações.
          </h1>

          <p
            className="
              mt-7
              max-w-[720px]
              text-lg
              leading-8
              text-[#675866]
            "
          >
            O programa de criadoras conecta pessoas que gostam
            de produzir conteúdo às marcas do nosso ecossistema.
            As vendas geradas pelas indicações podem ser
            acompanhadas pelo programa de parceiros.
          </p>

        </div>
      </section>


      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-[1000px]">

          <div
            className="
              grid
              gap-6
              md:grid-cols-3
            "
          >

            <div
              className="
                rounded-[26px]
                border
                border-[#eadfd9]
                bg-white
                p-7
              "
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a27731]">
                01
              </p>

              <h2 className="mt-3 font-serif text-2xl font-semibold text-[#422347]">
                Crie
              </h2>

              <p className="mt-3 leading-7 text-[#70616e]">
                Produza conteúdos autênticos mostrando sua
                experiência com os produtos.
              </p>
            </div>


            <div
              className="
                rounded-[26px]
                border
                border-[#eadfd9]
                bg-white
                p-7
              "
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a27731]">
                02
              </p>

              <h2 className="mt-3 font-serif text-2xl font-semibold text-[#422347]">
                Indique
              </h2>

              <p className="mt-3 leading-7 text-[#70616e]">
                Compartilhe seu cupom de indicação com sua
                audiência e comunidade.
              </p>
            </div>


            <div
              className="
                rounded-[26px]
                border
                border-[#eadfd9]
                bg-white
                p-7
              "
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a27731]">
                03
              </p>

              <h2 className="mt-3 font-serif text-2xl font-semibold text-[#422347]">
                Ganhe
              </h2>

              <p className="mt-3 leading-7 text-[#70616e]">
                As vendas atribuídas à sua indicação geram
                benefícios conforme as regras vigentes do programa.
              </p>
            </div>

          </div>


          <div
            className="
              mt-10
              rounded-[30px]
              bg-[#4c2854]
              px-7
              py-10
              text-white
              sm:px-10
            "
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.20em] text-[#e4be73]">
              Quero participar
            </p>

            <h2 className="mt-3 font-serif text-4xl font-semibold">
              Faça parte da comunidade de criadoras.
            </h2>

            <p className="mt-4 max-w-[650px] leading-7 text-white/80">
              O cadastro e a gestão do programa serão realizados
              pelo portal oficial de parceiros. O acesso será
              conectado aqui.
            </p>

            <div
              className="
                mt-7
                inline-flex
                rounded-full
                border
                border-white/30
                bg-white/10
                px-6
                py-3
                text-sm
                font-extrabold
                text-white/80
              "
            >
              Acesso ao portal em preparação
            </div>
          </div>

        </div>
      </section>

    </main>
  );
}
