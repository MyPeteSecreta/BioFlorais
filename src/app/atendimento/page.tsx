import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-[70vh] bg-[#fffdf9] px-6 py-16 text-[#2f2231] lg:px-10">
      <div className="mx-auto max-w-[900px]">

        <Link
          href="/"
          className="text-sm font-bold text-[#63326d]"
        >
          {"\u2190 Voltar para Bio Florais"}
        </Link>

        <h1 className="mt-10 font-serif text-4xl font-semibold text-[#422347] sm:text-5xl">
          Atendimento
        </h1>

        <div className="mt-6 h-px w-16 bg-[#c39745]" />

        <div className="mt-8 max-w-[760px]">
          <p className="text-lg leading-8 text-[#665765]">
            {"Fale com a Bio Florais. Nossa equipe est\u00e1 \u00e0 disposi\u00e7\u00e3o para ajudar voc\u00ea."}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <a
              href="https://wa.me/552139553713"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-[#e5d8cf] bg-white p-5 transition hover:border-[#63326d] hover:shadow-md"
            >
              <span className="block text-sm font-semibold uppercase tracking-[0.12em] text-[#9b6c24]">
                WhatsApp
              </span>
              <span className="mt-2 block text-lg font-semibold text-[#422347]">
                (21) 3955-3713
              </span>
              <span className="mt-1 block text-sm text-[#766775]">
                Clique para conversar
              </span>
            </a>

            <a
              href="mailto:sac@bioflorais.com.br"
              className="rounded-2xl border border-[#e5d8cf] bg-white p-5 transition hover:border-[#63326d] hover:shadow-md"
            >
              <span className="block text-sm font-semibold uppercase tracking-[0.12em] text-[#9b6c24]">
                E-mail
              </span>
              <span className="mt-2 block text-lg font-semibold text-[#422347]">
                sac@bioflorais.com.br
              </span>
              <span className="mt-1 block text-sm text-[#766775]">
                Clique para enviar um e-mail
              </span>
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
