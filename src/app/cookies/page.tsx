import Link from "next/link";

const COMPANY = "Pharma e Natural Distribuidora Ltda.";
const CNPJ = "27.707.550/0001-00";
const EMAIL = "sac@angelblanc.com";

export default function Page() {
  return (
    <main className="min-h-[70vh] bg-[#fffdf9] px-6 py-16 text-[#2f2231] lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <Link href="/" className="text-sm font-bold text-[#63326d]">
          ← Voltar para Bio Florais
        </Link>

        <h1 className="mt-10 font-serif text-4xl font-semibold text-[#422347] sm:text-5xl">
          Política de Cookies
        </h1>

        <div className="mt-6 h-px w-16 bg-[#c39745]" />

        <div className="mt-8 space-y-8 text-base leading-8 text-[#665765]">
          <p>Última atualização: 9 de setembro de 2026.</p>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              1. Responsável pelo site
            </h2>
            <p>
              O site Bio Florais é operado comercialmente por{" "}
              <strong>{COMPANY}</strong>, CNPJ <strong>{CNPJ}</strong>.
              Dúvidas podem ser encaminhadas para <strong>{EMAIL}</strong>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              2. O que são cookies e tecnologias semelhantes
            </h2>
            <p>
              Cookies são pequenos arquivos ou informações armazenadas pelo
              navegador durante a utilização de um site. Também podem ser
              utilizadas tecnologias semelhantes, como armazenamento local do
              navegador, para manter determinadas funcionalidades.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              3. Tecnologias necessárias ao funcionamento
            </h2>
            <p>
              O site pode utilizar cookies ou armazenamento local necessários
              para funcionalidades como manutenção do carrinho, navegação,
              preferências, segurança, prevenção de abuso, continuidade de
              sessões e funcionamento técnico do e-commerce.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              4. Serviços de terceiros
            </h2>
            <p>
              Funcionalidades relacionadas a pagamento, logística,
              infraestrutura e outros serviços integrados podem envolver
              tecnologias próprias dos respectivos prestadores, de acordo com
              suas políticas e com a função efetivamente utilizada no site.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              5. Tecnologias não essenciais
            </h2>
            <p>
              Caso sejam utilizados cookies ou tecnologias não estritamente
              necessários, como recursos de publicidade, medição ou
              personalização que dependam de consentimento, sua utilização
              deverá observar as escolhas apresentadas ao usuário e a legislação
              aplicável.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              6. Como controlar
            </h2>
            <p>
              O usuário pode utilizar as configurações do próprio navegador para
              consultar, limitar ou excluir cookies e dados armazenados
              localmente. A desativação de recursos tecnicamente necessários
              pode afetar funcionalidades do site, inclusive carrinho,
              autenticação ou continuidade da navegação.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              7. Privacidade
            </h2>
            <p>
              Para informações sobre tratamento de dados pessoais, consulte a{" "}
              <Link
                href="/privacidade"
                className="font-semibold text-[#63326d] underline"
              >
                Política de Privacidade
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              8. Atualizações
            </h2>
            <p>
              Esta política poderá ser atualizada quando houver alteração das
              tecnologias utilizadas pelo site ou das exigências legais
              aplicáveis. A versão vigente será mantida nesta página.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              9. Contato
            </h2>
            <p>
              {COMPANY} · CNPJ {CNPJ}
              <br />
              Operação comercial da marca Bio Florais
              <br />
              Atendimento: {EMAIL}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
