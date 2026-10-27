import Link from "next/link";

import { loadDemoState } from "@/lib/b2b/demo";
import { requireResponsiblePage } from "@/lib/b2b/current-responsible";
import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { SALES_MATERIALS, formatWhatsApp } from "@/lib/b2b/sales-materials";

export const dynamic = "force-dynamic";

const GROUPS = ["Preços e condições", "Florais", "Cosméticos e Home Care"] as const;

export default async function MaterialsPage() {
  const responsible = await requireResponsiblePage();
  const [seller] = await getAppSqlRunner()(`SELECT phone FROM b2b_responsibles WHERE id = $1::uuid`, [responsible.id]);
  const demo = await loadDemoState(getAppSqlRunner(), responsible.id);
  const whatsapp = formatWhatsApp(seller?.phone);

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-10 lg:px-10" data-testid="materiais-venda">
      <h1 className="font-serif text-3xl font-semibold text-[#55245f] sm:text-4xl">Materiais de venda</h1>
      <p className="mt-2 max-w-[760px] text-sm leading-6 text-[#746471]">
        O PDF de <strong>preços e promoções</strong> é só para você (uso interno). Para cada linha há um PDF em duas versões. A <strong>versão para o lojista</strong> pode ser encaminhada: ao baixar, ela sai com o seu nome, o seu
        WhatsApp e o QR do seu link pessoal na página &quot;Como pedir&quot;. A <strong>versão para o representante</strong> é de uso interno (traz as
        respostas às objeções do lojista) e não deve ser encaminhada.
      </p>

      {demo.isDemo ? (
        <p role="status" className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950" data-testid="materiais-demo">
          Na demonstração, a versão para o lojista (com o seu nome e QR) fica disponível depois do cadastro. Você já pode baixar a versão de uso interno.
        </p>
      ) : (
        <div className="mt-4 rounded-2xl border border-[#eadfd9] bg-white p-4 text-sm text-[#422347]" data-testid="materiais-carimbo">
          <p className="font-extrabold">O que vai carimbado no PDF do lojista</p>
          <p className="mt-1">
            {responsible.name} · {whatsapp ? `WhatsApp ${whatsapp}` : "sem WhatsApp"} · QR do seu link pessoal de captação.
          </p>
          {!whatsapp && (
            <p className="mt-2 font-bold text-[#8a5a12]" role="status" data-testid="materiais-sem-whatsapp">
              Você ainda não tem WhatsApp no cadastro: o PDF sai só com o seu nome e o QR.{" "}
              <Link href="/b2b/painel/cadastro" className="underline">
                Completar o cadastro
              </Link>
            </p>
          )}
        </div>
      )}

      {GROUPS.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="text-xl font-extrabold text-[#422347]">{group}</h2>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {SALES_MATERIALS.filter((material) => material.group === group).map((material) => (
              <li key={material.id} className="rounded-[22px] border border-[#eadfd9] bg-white p-5 shadow-sm" data-testid="material-item">
                <p className="text-lg font-extrabold text-[#55245f]">{material.title}</p>
                <p className="mt-0.5 text-sm text-[#746471]">{material.description}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {material.internalOnly ? null : demo.isDemo ? (
                    <span className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border-2 border-[#d9c7dc] px-4 text-center text-sm font-extrabold text-[#8a7886]">Versão lojista (após o cadastro)</span>
                  ) : (
                    <a
                      href={`/api/b2b/materiais/${material.id}?versao=lojista`}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[#55245f] px-4 text-center text-sm font-extrabold text-white"
                      data-testid="baixar-lojista"
                    >
                      Baixar versão LOJISTA (para encaminhar)
                    </a>
                  )}
                  <a
                    href={`/api/b2b/materiais/${material.id}?versao=representante`}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border-2 border-[#9b1c1c] px-4 text-center text-sm font-extrabold text-[#9b1c1c]"
                    data-testid="baixar-representante"
                  >
                    {material.internalOnly ? "Baixar PDF · uso interno" : "Baixar versão REPRESENTANTE · uso interno"}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-8 text-xs text-[#746471]">Preços válidos em outubro/2026. Não encaminhe a versão de uso interno.</p>
    </main>
  );
}
