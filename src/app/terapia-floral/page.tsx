import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-[70vh] bg-[#fffdf9] px-6 py-16 text-[#2f2231] lg:px-10">
      <div className="mx-auto max-w-[900px]">

        <Link
          href="/"
          className="text-sm font-bold text-[#63326d]"
        >
          ← Voltar para Bio Florais
        </Link>

        <h1 className="mt-10 font-serif text-4xl font-semibold text-[#422347] sm:text-5xl">
          Terapia Floral
        </h1>

        <div className="mt-6 h-px w-16 bg-[#c39745]" />

        <p className="mt-8 max-w-[760px] text-lg leading-8 text-[#665765]">
          Conteúdo institucional sobre terapia floral em preparação. Esta página receberá o conteúdo oficial Bio Florais.
        </p>

      </div>
    </main>
  );
}
