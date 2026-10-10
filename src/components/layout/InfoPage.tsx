import Link from "next/link";

export type InfoSection = { heading: string; paragraphs: string[]; bullets?: string[] };

/** Página institucional/legal simples (mesmo visual das outras páginas de texto da Bio Florais). */
export default function InfoPage({
  title,
  intro,
  sections,
  contact = true,
}: {
  title: string;
  intro: string;
  sections: InfoSection[];
  contact?: boolean;
}) {
  return (
    <main className="min-h-[70vh] bg-[#fffdf9] px-6 py-16 text-[#2f2231] lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <Link href="/" className="text-sm font-bold text-[#63326d]">
          ← Voltar para Bio Florais
        </Link>

        <h1 className="mt-10 font-serif text-4xl font-semibold text-[#422347] sm:text-5xl">{title}</h1>

        <div className="mt-6 h-px w-16 bg-[#c39745]" />

        <p className="mt-8 max-w-[760px] text-lg leading-8 text-[#665765]">{intro}</p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-serif text-2xl font-semibold text-[#422347]">{section.heading}</h2>
              <div className="mt-3 max-w-[760px] space-y-3 leading-7 text-[#4f4150]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-1.5 pl-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        {contact && (
          <section className="mt-12 rounded-[24px] border border-[#eadfd9] bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-[#422347]">Precisa de ajuda?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4f4150]">
              Fale com a nossa equipe pelo{" "}
              <a href="https://wa.me/552139553713" className="font-bold text-[#63326d] underline">
                WhatsApp
              </a>{" "}
              ou por e-mail em{" "}
              <a href="mailto:sac@angelblanc.com" className="font-bold text-[#63326d] underline">
                sac@angelblanc.com
              </a>
              . Veja também a página de{" "}
              <Link href="/atendimento" className="font-bold text-[#63326d] underline">
                Atendimento
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
