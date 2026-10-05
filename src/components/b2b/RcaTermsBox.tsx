"use client";

/** Quadro rolável com o texto do Termo de Adesão do RCA (seções 1 a 10), acima da caixa de aceite. */

import { Fragment } from "react";

import { RCA_TERMS_SECTIONS, RCA_TERMS_VERSION } from "@/lib/b2b/rca-terms";

/** Negrito com a marcação ** **. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>
      )}
    </>
  );
}

export default function RcaTermsBox() {
  return (
    <div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Termo de adesão do Representante Comercial Autônomo"
        className="max-h-72 overflow-y-auto rounded-xl border border-[#eadfd9] bg-[#fbf5f1] p-4 text-sm leading-6"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#9b6c24]">
          Termo de adesão do RCA · versão {RCA_TERMS_VERSION}
        </p>

        {RCA_TERMS_SECTIONS.map((section) => {
          let counter = 0;

          return (
            <section key={section.title} className="mt-4">
              <h3 className="font-extrabold text-[#55245f]">{section.title}</h3>

              {section.blocks.map((block, index) => {
                if (block.kind === "item") {
                  counter += 1;
                  return (
                    <p key={index} className="mt-1.5">
                      <span className="font-bold">{counter}.</span> <Rich text={block.text} />
                    </p>
                  );
                }

                if (block.kind === "paragraph") {
                  return (
                    <p key={index} className="mt-1.5">
                      <Rich text={block.text} />
                    </p>
                  );
                }

                return (
                  <div key={index} className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                      <thead>
                        <tr>
                          {block.head.map((cell) => (
                            <th key={cell} className="border border-[#d9ccc4] bg-white px-2 py-1.5">
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row) => (
                          <tr key={row[0]}>
                            <td className="border border-[#d9ccc4] px-2 py-1.5 font-bold">{row[0]}</td>
                            <td className="border border-[#d9ccc4] px-2 py-1.5">{row[1]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-[#8a7886]">Role o quadro até o fim para ler todo o termo.</p>
    </div>
  );
}
