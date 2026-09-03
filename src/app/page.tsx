import Image from "next/image";
import Link from "next/link";

const rowTwo = [
  {
    name: "Infantil",
    image: "/assets/home/linhas/Infantil.png",
  },
  {
    name: "Baby",
    image: "/assets/home/linhas/Baby.png",
  },
  {
    name: "Kids",
    image: "/assets/home/linhas/Kids.png",
  },
];

const rowThree = [
  {
    name: "Teen",
    image: "/assets/home/linhas/Teen.png",
  },
  {
    name: "Dose Única",
    image: "/assets/home/linhas/DoseUnica.png",
  },
  {
    name: "Virtudes Divinas",
    image: "/assets/home/linhas/VirtudesDivinas.png",
  },
];

const lineHref: Record<string, string> = {
  "Adulto": "/linha/adulto",
  "Pet": "/linha/pet",
  "Infantil": "/linha/infantil",
  "Baby": "/linha/baby",
  "Kids": "/linha/kids",
  "Teen": "/linha/teen",
  "Dose Única": "/linha/dose-unica",
  "Virtudes Divinas": "/linha/virtudes-divinas",
  "Cosméticos": "/linha/cosmeticos",
  "Cosméticos Pet": "/linha/cosmeticos-pet",
  "Home Care": "/linha/home-care",
};

function VisualLineCard({
  name,
  image,
  large = false,
}: {
  name: string;
  image: string;
  large?: boolean;
}) {
  return (
    <Link
      href={lineHref[name] ?? "#linhas"}
      aria-label={`Conhecer linha ${name}`}
      className={`group relative block overflow-hidden rounded-[26px] border border-[#eadfda] bg-white shadow-sm transition duration-300 ease-out hover:-translate-y-2 hover:scale-[1.018] hover:shadow-[0_22px_50px_rgba(61,35,65,0.15)] ${
        large ? "min-h-0" : ""
      }`}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-[#fffaf6]">
        <Image
          src={image}
          alt={`Bio Florais ${name}`}
          fill
          sizes={
            large
              ? "(max-width: 900px) 100vw, 50vw"
              : "(max-width: 900px) 100vw, 33vw"
          }
          className="object-contain bg-[#fffaf6] transition duration-500 ease-out group-hover:scale-[1.012]"
        />
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#fffdf9] text-[#2f2231]">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#ece2df]/80 bg-[#fffdf9]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 lg:px-10">

          <Link href="#topo">
            <div className="font-serif text-[25px] font-semibold tracking-[-0.03em] text-[#55245f]">
              Bio Florais
            </div>
            <div className="mt-[-2px] text-[9px] font-bold uppercase tracking-[0.28em] text-[#b17d22]">
              Desde 1997
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex">
            <Link href="#linhas" className="transition hover:text-[#7f4189]">
              Adulto
            </Link>

            <Link href="#linhas" className="transition hover:text-[#7f4189]">
              Pet
            </Link>

            <Link href="#linhas" className="transition hover:text-[#7f4189]">
              Infantil
            </Link>

            <Link href="/quiz" className="transition hover:text-[#7f4189]">
              Descubra seu Bio
            </Link>

            <Link href="#linhas" className="transition hover:text-[#7f4189]">
              Nossas linhas
            </Link>
          </nav>

          <Link
            href="#linhas"
            className="rounded-full bg-[#63326d] px-6 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#53285d]"
          >
            Ver produtos
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section
        id="topo"
        className="relative min-h-[610px] overflow-hidden lg:min-h-[650px]"
      >
        <Image
          src="/assets/home/hero/Hero.png"
          alt="Bio Florais"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#fffdf9]/96 via-[#fffdf9]/55 to-transparent" />

        <div className="relative mx-auto flex min-h-[610px] max-w-[1440px] items-center px-6 py-14 lg:min-h-[650px] lg:px-10">
          <div className="max-w-[610px]">

            <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.28em] text-[#9b6c24]">
              Bio Florais · Desde 1997
            </p>

            <h1 className="font-serif text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] text-[#422347] sm:text-[62px] lg:text-[74px]">
              Equilíbrio para viver melhor cada dia.
            </h1>

            <p className="mt-6 max-w-[520px] text-lg leading-8 text-[#594b58]">
              Flores frescas brasileiras, fórmulas sem álcool e um universo
              criado para acompanhar diferentes momentos da vida.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/quiz"
                className="rounded-full bg-[#63326d] px-7 py-4 text-sm font-extrabold text-white shadow-lg shadow-[#63326d]/10 transition hover:-translate-y-0.5"
              >
                Encontrar meu floral
              </Link>

              <Link
                href="#linhas"
                className="rounded-full border border-[#7a567f]/30 bg-white/85 px-7 py-4 text-sm font-extrabold text-[#4a2a50] backdrop-blur transition hover:bg-white"
              >
                Conhecer Bio Florais
              </Link>
            </div>

            <div className="mt-8 hidden flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold uppercase tracking-[0.13em] text-[#6e596b] sm:flex">
              <span>Sem álcool</span>
              <span className="text-[#c39745]">•</span>
              <span>Flores frescas brasileiras</span>
              <span className="text-[#c39745]">•</span>
              <span>Desde 1997</span>
            </div>
          </div>
        </div>
      </section>

      {/* TRIO */}
      <section
        id="destaques"
        className="relative bg-white px-5 py-14 lg:px-10 lg:py-16"
      >
        <div className="mx-auto grid max-w-[1440px] gap-7 lg:grid-cols-[0.8fr_1.35fr] lg:items-center">

          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#a0742b]">
              Para diferentes momentos
            </p>

            <h2 className="mt-3 max-w-[470px] font-serif text-5xl font-semibold leading-[1.03] tracking-[-0.04em] text-[#422347] lg:text-6xl">
              Tem um Bio Florais para o seu momento.
            </h2>

            <p className="mt-5 max-w-[470px] text-lg leading-8 text-[#6c5b69]">
              Para você, para quem você ama e para quem também faz parte da
              família.
            </p>
          </div>

          <div className="relative mx-auto h-[480px] w-full max-w-[780px] sm:h-[565px]">

            <div className="trio-card trio-card-a absolute left-[2%] top-[3%] w-[61%] overflow-hidden rounded-[28px]">
              <Image
                src="/assets/home/trio/TrioAdultoAnsiedade.png"
                alt="Bio Florais Adulto Ansiedade"
                width={900}
                height={506}
                className="h-auto w-full"
              />
            </div>

            <div className="trio-card trio-card-b absolute right-[1%] top-[24%] w-[59%] overflow-hidden rounded-[28px]">
              <Image
                src="/assets/home/trio/TrioPetRescue.png"
                alt="Bio Florais Pet Rescue"
                width={900}
                height={506}
                className="h-auto w-full"
              />
            </div>

            <div className="trio-card trio-card-c absolute bottom-[1%] left-[22%] w-[60%] overflow-hidden rounded-[28px]">
              <Image
                src="/assets/home/trio/TrioInfantioSono.png"
                alt="Bio Florais Infantil Sono"
                width={900}
                height={506}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* INSTITUCIONAL COMPACTO */}
      <section className="bg-[#4c2854] px-6 py-16 text-white lg:px-10 lg:py-20">
        <div className="mx-auto max-w-[1120px] text-center">

          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#e2be72]">
            Bio Florais · Desde 1997
          </p>

          <h2 className="mx-auto mt-4 max-w-[950px] font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
            Você não está conhecendo Bio Florais.
            <br />
            Está reencontrando.
          </h2>

          <p className="mx-auto mt-5 max-w-[760px] text-base leading-7 text-[#eadfea] sm:text-lg">
            Um nome que volta ao centro da conversa com a mesma essência de
            cuidado e um novo jeito de ocupar o seu dia.
          </p>

          <div className="mx-auto mt-7 hidden items-center justify-center gap-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#e9c97f] sm:flex">
            <span>Sem álcool</span>
            <span>•</span>
            <span>Flores frescas brasileiras</span>
            <span>•</span>
            <span>Desde 1997</span>
          </div>

        </div>
      </section>

      {/* QUIZ */}
      <section
        id="quiz"
        className="bg-white px-5 py-16 lg:px-10 lg:py-20"
      >
        <div className="mx-auto grid max-w-[1440px] gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">

          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#a0742b]">
              Descubra seu Bio Floral
            </p>

            <h2 className="mt-4 max-w-[530px] font-serif text-5xl font-semibold leading-[1.03] tracking-[-0.04em] text-[#422347] lg:text-6xl">
              Qual Bio Floral combina com o seu momento?
            </h2>

            <p className="mt-5 max-w-[500px] text-lg leading-8 text-[#6c5b69]">
              Responda algumas perguntas e descubra por onde começar.
            </p>

            

            <Link
              href="/quiz"
              className="mt-7 inline-block rounded-full bg-[#63326d] px-7 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5"
            >
              Descobrir meu Bio Floral
            </Link>
          </div>

          <Link
            href="/quiz"
            aria-label="Abrir Quiz Bio Florais"
            className="block overflow-hidden rounded-[30px] shadow-xl shadow-black/10 transition hover:-translate-y-0.5"
          >
            <Image
              src="/assets/home/quiz/Quiz.png"
              alt="Descubra seu Bio Floral"
              width={1600}
              height={900}
              className="h-auto w-full"
            />
          </Link>
        </div>
      </section>

      {/* LINHAS */}
      <section
        id="linhas"
        className="bg-[#faf5ef] px-3 py-16 sm:px-5 lg:px-7 lg:py-20 xl:px-8"
      >
        <div className="mx-auto max-w-[1440px]">

          <div className="mx-auto mb-10 max-w-[760px] text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#a0742b]">
              Universo Bio Florais
            </p>

            <h2 className="mt-3 font-serif text-5xl font-semibold tracking-[-0.04em] text-[#422347] sm:text-6xl">
              Encontre a sua linha.
            </h2>

            <p className="mt-4 text-lg leading-8 text-[#6c5b69]">
              Diferentes universos para diferentes fases, pessoas e momentos.
            </p>
          </div>

          {/* 1ª LINHA: DOIS GRANDES */}
          <div className="grid gap-6 md:grid-cols-2">
            <VisualLineCard
              name="Adulto"
              image="/assets/home/linhas/Adulto.png"
              large
            />

            <VisualLineCard
              name="Pet"
              image="/assets/home/linhas/Pet.png"
              large
            />
          </div>

          {/* 2ª LINHA */}
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {rowTwo.map((line) => (
              <VisualLineCard
                key={line.name}
                name={line.name}
                image={line.image}
              />
            ))}
          </div>

          {/* 3ª LINHA */}
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {rowThree.map((line) => (
              <VisualLineCard
                key={line.name}
                name={line.name}
                image={line.image}
              />
            ))}
          </div>

          {/* 4a LINHA: EXPANSAO BIO FLORAIS */}
          <div className="mt-6 grid gap-5 md:grid-cols-3 lg:gap-6">
            <VisualLineCard
              name="Cosméticos"
              image="/assets/home/linhas/Cosmetico.png"
            />

            <VisualLineCard
              name="Cosméticos Pet"
              image="/assets/home/linhas/CosmeticoPet.png"
            />

            <VisualLineCard
              name="Home Care"
              image="/assets/home/linhas/HomeCare.png"
            />
          </div>

        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-[#352238] px-6 py-16 text-center text-white lg:px-10 lg:py-20">
        <div className="mx-auto max-w-[900px]">

          <p className="text-xs font-extrabold uppercase tracking-[0.26em] text-[#e0bd76]">
            Bio Florais
          </p>

          <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            Equilíbrio para viver melhor.
          </h2>

          <p className="mx-auto mt-5 max-w-[620px] text-lg leading-8 text-[#e4d7e5]">
            Descubra o universo Bio Florais e encontre o cuidado que combina
            com o seu momento.
          </p>

          <Link
            href="#linhas"
            className="mt-7 inline-flex rounded-full bg-[#f4dfc5] px-8 py-4 text-sm font-extrabold text-[#3d2840] transition hover:-translate-y-0.5"
          >
            Explorar Bio Florais
          </Link>

        </div>
      </section>

    </main>
  );
}



