"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { getProduct, formatBRL } from "@/lib/catalog/bio-products";

import {
  createBioQuizState,
  type BioQuizState,
  type BioQuizUniverse,
} from "@/lib/quiz/bio-florais";

import {
  BIO_QUIZ_START_QUESTION,
  getBioQuizQuestion,
  type BioQuizQuestion,
} from "@/lib/quiz/bio-florais-questions";

import {
  applyBioQuizAge,
  applyBioQuizAnswer,
  beginBioQuizUniverse,
} from "@/lib/quiz/bio-florais-flow";

import { buildBioQuizResult } from "@/lib/quiz/bio-florais-result";

type Screen =
  | { type: "start" }
  | { type: "question"; questionId: string }
  | { type: "result" }
  | { type: "neutral" };

function ProductCard({
  slug,
  label,
}: {
  slug: string;
  label: string;
}) {
  const product = getProduct(slug);

  if (!product) return null;

  return (
    <article className="rounded-[28px] border border-[#eadfec] bg-white p-5 shadow-[0_18px_55px_rgba(66,35,71,0.08)]">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6c24]">
        {label}
      </div>

      <div className="grid gap-5 sm:grid-cols-[140px_1fr] sm:items-center">
        <div className="flex min-h-[150px] items-center justify-center rounded-[22px] bg-[#fffaf4] p-3">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-[150px] w-auto object-contain"
            />
          ) : (
            <div className="flex min-h-[120px] items-center justify-center text-center text-xs text-[#8a7a8c]">
              Imagem do produto
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold leading-tight text-[#422347]">
            {product.name}
          </h2>

          <p className="mt-2 text-lg font-semibold text-[#63326d]">
            {formatBRL(product.priceCents)}
          </p>

          <Link
            href={"/produto/" + product.slug}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#63326d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#422347]"
          >
            Ver produto
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function BioQuizPage() {
  const [state, setState] = useState<BioQuizState>(
    () => createBioQuizState(),
  );

  const [screen, setScreen] = useState<Screen>({
    type: "start",
  });

  const [age, setAge] = useState("");

  const question: BioQuizQuestion | null = useMemo(() => {
    if (screen.type === "start") {
      return BIO_QUIZ_START_QUESTION;
    }

    if (screen.type === "question") {
      return getBioQuizQuestion(screen.questionId);
    }

    return null;
  }, [screen]);

  function restart() {
    setState(createBioQuizState());
    setScreen({ type: "start" });
    setAge("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function consumeFlow(
    flow:
      | ReturnType<typeof beginBioQuizUniverse>
      | ReturnType<typeof applyBioQuizAnswer>
      | ReturnType<typeof applyBioQuizAge>,
  ) {
    setState(flow.state);

    if (flow.type === "question") {
      setScreen({
        type: "question",
        questionId: flow.questionId,
      });
    } else if (flow.type === "result") {
      setScreen({ type: "result" });
    } else {
      setScreen({ type: "neutral" });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectStart(optionId: string) {
    consumeFlow(
      beginBioQuizUniverse(
        state,
        optionId as BioQuizUniverse,
      ),
    );
  }

  function selectAnswer(optionId: string) {
    if (screen.type !== "question") return;

    consumeFlow(
      applyBioQuizAnswer(
        state,
        screen.questionId,
        optionId,
      ),
    );
  }

  function submitAge() {
    const parsed = Number(age);

    if (
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      parsed > 120
    ) {
      return;
    }

    consumeFlow(applyBioQuizAge(state, parsed));
  }

  const result =
    screen.type === "result"
      ? buildBioQuizResult(state)
      : null;

  return (
    <main className="min-h-screen bg-[#fffdf9] text-[#2f2231]">
      <header className="border-b border-[#eee4ef] bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-[#422347]"
          >
            Bio Florais
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-[#63326d]"
          >
            Voltar ao site
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        {screen.type !== "result" &&
          screen.type !== "neutral" &&
          question && (
            <>
              <div className="mx-auto max-w-2xl text-center">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#9b6c24]">
                  Descubra seu Bio
                </div>

                <h1 className="text-3xl font-semibold leading-tight text-[#422347] sm:text-4xl">
                  {question.title}
                </h1>

                {question.subtitle && (
                  <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#6c5c6e]">
                    {question.subtitle}
                  </p>
                )}
              </div>

              {question.kind === "number" ? (
                <div className="mx-auto mt-9 max-w-md rounded-[28px] border border-[#eadfec] bg-white p-6 shadow-[0_18px_55px_rgba(66,35,71,0.08)]">
                  <label
                    htmlFor="quiz-age"
                    className="mb-2 block text-sm font-medium text-[#422347]"
                  >
                    Idade em anos
                  </label>

                  <input
                    id="quiz-age"
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(event) =>
                      setAge(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        submitAge();
                      }
                    }}
                    className="h-14 w-full rounded-2xl border border-[#d9c8dc] bg-[#fffdf9] px-4 text-lg outline-none transition focus:border-[#63326d]"
                    placeholder="Ex.: 7"
                  />

                  <button
                    type="button"
                    onClick={submitAge}
                    disabled={!age}
                    className="mt-4 min-h-12 w-full rounded-full bg-[#63326d] px-6 py-3 font-semibold text-white transition hover:bg-[#422347] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuar
                  </button>
                </div>
              ) : (
                <div className="mx-auto mt-9 grid max-w-2xl gap-3">
                  {question.options?.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        screen.type === "start"
                          ? selectStart(option.id)
                          : selectAnswer(option.id)
                      }
                      className="group w-full rounded-[22px] border border-[#e4d5e6] bg-white px-5 py-4 text-left shadow-[0_10px_30px_rgba(66,35,71,0.05)] transition hover:-translate-y-0.5 hover:border-[#b895be] hover:shadow-[0_15px_35px_rgba(66,35,71,0.09)]"
                    >
                      <span className="block font-medium leading-6 text-[#422347]">
                        {option.label}
                      </span>

                      {option.supportLabel && (
                        <span className="mt-1 block text-sm text-[#9b6c24]">
                          {option.supportLabel}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {screen.type !== "start" && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={restart}
                    className="text-sm font-medium text-[#766578] underline decoration-[#cab8cd] underline-offset-4"
                  >
                    Recomeçar o quiz
                  </button>
                </div>
              )}
            </>
          )}

        {screen.type === "neutral" && (
          <div className="mx-auto max-w-2xl rounded-[30px] border border-[#eadfec] bg-white p-7 text-center shadow-[0_18px_55px_rgba(66,35,71,0.08)] sm:p-10">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6c24]">
              Seu momento importa
            </div>

            <h1 className="mt-3 text-3xl font-semibold text-[#422347]">
              Não encontramos uma indicação segura com essas respostas.
            </h1>

            <p className="mt-4 leading-7 text-[#6c5c6e]">
              Prefiro não forçar uma recomendação sem um sinal claro.
              Você pode refazer o quiz ou conhecer os florais disponíveis.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={restart}
                className="rounded-full bg-[#63326d] px-6 py-3 font-semibold text-white"
              >
                Refazer quiz
              </button>

              <Link
                href="/produtos"
                className="rounded-full border border-[#63326d] px-6 py-3 font-semibold text-[#63326d]"
              >
                Ver produtos
              </Link>
            </div>
          </div>
        )}

        {screen.type === "result" && result && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9b6c24]">
                Seu resultado
              </div>

              <h1 className="mt-3 text-3xl font-semibold text-[#422347] sm:text-4xl">
                Encontramos o floral que mais combina com este momento
              </h1>

              <p className="mx-auto mt-4 max-w-xl leading-7 text-[#6c5c6e]">
                A recomendação considera as respostas que você acabou de dar.
              </p>
            </div>

            {result.principal ? (
              <div className="space-y-5">
                <ProductCard
                  slug={result.principal}
                  label="Principal"
                />

                {result.associated.map(
                  (slug, index) => (
                    <ProductCard
                      key={slug}
                      slug={slug}
                      label={
                        index === 0
                          ? "Também pode fazer sentido"
                          : "Outra possibilidade associada"
                      }
                    />
                  ),
                )}

                {result.structuralDose && (
                  <div className="rounded-[28px] border border-[#e5d5b8] bg-[#fffaf0] p-5">
                    <div className="mb-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6c24]">
                        Para iniciar ou potencializar o cuidado
                      </div>

                      <p className="mt-2 text-sm leading-6 text-[#6c5c6e]">
                        Este resultado também possui uma opção em Dose Única.
                      </p>
                    </div>

                    <ProductCard
                      slug={result.structuralDose}
                      label="Dose Única"
                    />
                  </div>
                )}

                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={restart}
                    className="rounded-full border border-[#63326d] px-6 py-3 font-semibold text-[#63326d]"
                  >
                    Refazer o quiz
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-[#eadfec] bg-white p-8 text-center">
                <p className="text-[#6c5c6e]">
                  Não foi possível fechar uma recomendação com essas respostas.
                </p>

                <button
                  type="button"
                  onClick={restart}
                  className="mt-5 rounded-full bg-[#63326d] px-6 py-3 font-semibold text-white"
                >
                  Refazer quiz
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
