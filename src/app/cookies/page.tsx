import CookieSettingsLink from "@/components/consent/CookieSettingsLink";
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
          <p>Última atualização: 18 de outubro de 2026.</p>

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

          <section data-testid="pixel-politica">
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              9. Medição de anúncios (marketing)
            </h2>
            <p>
              Com o seu consentimento para cookies de marketing, medimos se os nossos anúncios no ChatGPT (Plataforma de Anúncios da
              OpenAI) geram compras. Para isso, guardamos por até 30 dias, no cookie <code>bio_oppref</code>, um código de atribuição
              fornecido pelo anúncio, e informamos à plataforma apenas que houve uma compra, com o valor e um identificador aleatório.
              Não enviamos nome, e-mail, telefone, documentos nem o número do seu pedido. Você pode retirar o consentimento a qualquer
              momento em &quot;Configurar cookies&quot;.
            </p>
            <p className="mt-3">
              <CookieSettingsLink className="rounded-full border-2 border-[#55245f] px-5 py-2 text-sm font-extrabold text-[#55245f]" />
            </p>
          </section>


          <section data-testid="origem-politica">
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              10. Origem da visita (análise)
            </h2>
            <p>
              Para entender de onde vêm as visitas e as compras, guardamos por até 30 dias, no cookie <code>bio_origem</code>, apenas o
              nome da campanha do link que trouxe você (<code>utm_source</code>, <code>utm_medium</code> e <code>utm_campaign</code>) e o
              domínio do site de onde você veio (por exemplo, google.com ou instagram.com). Esse cookie é nosso, não é compartilhado com
              terceiros e não contém nome, e-mail, telefone, documentos nem qualquer identificador seu. Na compra, essas informações são
              gravadas no pedido para sabermos qual canal gerou a venda. Por não identificarem você, não dependem do consentimento de
              marketing; você pode apagar o cookie a qualquer momento nas configurações do navegador.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              11. Contato
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
