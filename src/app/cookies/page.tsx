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
          <p>Última atualização: 3 de novembro de 2026.</p>

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
              À OpenAI não enviamos nome, e-mail, telefone, documentos nem o número do seu pedido. Você pode retirar o consentimento a qualquer
              momento em &quot;Configurar cookies&quot;.
            </p>
            <p className="mt-3">
              <CookieSettingsLink className="rounded-full border-2 border-[#55245f] px-5 py-2 text-sm font-extrabold text-[#55245f]" />
            </p>
          </section>


          <section data-testid="google-meta-politica">
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              9.1. Google e Meta (medição e anúncios)
            </h2>
            <p>
              Com o seu consentimento, usamos o <strong>Google</strong> (Google tag, com o Consent Mode v2) e a <strong>Meta</strong> (Pixel
              da Meta) para medir visitas, visualização de produtos, itens colocados na sacola, início de compra e compras, e para medir e
              melhorar nossos anúncios. O Google e a Meta podem gravar cookies e identificadores próprios no seu navegador e tratar esses
              dados conforme as suas políticas (<a href="https://policies.google.com/technologies/cookies" className="font-semibold text-[#63326d] underline" rel="noopener noreferrer" target="_blank">Google</a>{" "}
              e <a href="https://www.facebook.com/privacy/policy/" className="font-semibold text-[#63326d] underline" rel="noopener noreferrer" target="_blank">Meta</a>).
            </p>
            <p className="mt-3">
              Antes da sua escolha, a Google tag fica com todos os consentimentos <strong>negados</strong> (sem cookies de análise nem de
              anúncios) e o Pixel da Meta <strong>nem é carregado</strong>. Ao aceitar, o Google passa a receber o consentimento de análise e
              de anúncios e a Meta passa a receber os eventos. Ao recusar ou retirar o consentimento, nada é enviado à Meta e o Google
              segue com os consentimentos negados.
            </p>
            <p className="mt-3">
              <strong>O que enviamos, e só se você aceitar os cookies de marketing.</strong> Quando você aceita os cookies de marketing e faz
              uma compra, podemos enviar ao Google e à Meta, junto com o aviso da compra (tipo de ação, valor em reais, produtos e um código
              interno do pedido), o <strong>e-mail e o telefone informados no pedido</strong>. Antes de serem enviados, esses dados passam por
              uma criptografia de mão única (<strong>hash SHA-256</strong>): o Google e a Meta recebem um código, e não o seu e-mail ou telefone
              em texto. Eles usam esse código apenas para verificar se a compra veio de alguém que viu ou clicou em um anúncio. Para nós,
              devolvem somente números agregados, sem identificar ninguém. Mesmo em forma de código, a informação continua sendo um dado pessoal
              protegido pela LGPD. <strong>Não enviamos</strong> nome, CPF ou CNPJ, endereço nem dados de pagamento, e os endereços das páginas
              vão sem códigos pessoais.
            </p>
            <p className="mt-3">
              <strong>Se você não aceitar ou retirar o consentimento</strong>, nada disso é enviado: a Meta não recebe nenhum evento, e o Google
              recebe apenas o aviso de compra sem e-mail, telefone ou cookies de anúncios, conforme o Consent Mode.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Finalidade:</strong> medir e melhorar o desempenho dos nossos anúncios (saber quais anúncios geraram compras), sem usar
                esses dados para outra finalidade.
              </li>
              <li>
                <strong>Base legal:</strong> o seu <strong>consentimento</strong> (art. 7º, I, da LGPD), dado no aviso de cookies ao escolher
                &quot;Aceitar&quot; ou ao ligar &quot;Marketing&quot; em &quot;Configurar cookies&quot;.
              </li>
              <li>
                <strong>Com quem compartilhamos:</strong> Google LLC e Meta Platforms, Inc. (e suas afiliadas), que atuam conforme os termos de
                dados dos seus serviços de anúncios. Essas empresas podem tratar os dados fora do Brasil; a transferência internacional segue o
                art. 33 da LGPD, com as garantias previstas nesses termos.
              </li>
              <li>
                <strong>Por quanto tempo:</strong> pelo prazo necessário à medição, conforme as políticas do Google e da Meta. Do nosso lado, o
                e-mail e o telefone ficam apenas no seu pedido, pelo prazo exigido pela lei fiscal e de consumo.
              </li>
              <li>
                <strong>Como recusar ou revogar:</strong> escolha &quot;Recusar&quot; no aviso de cookies ou, a qualquer momento, abra
                &quot;Configurar cookies&quot; (no rodapé do site) e desligue &quot;Marketing&quot;. A revogação vale para as compras seguintes.
                Para pedir providências sobre dados já enviados, escreva para <strong>sac@angelblanc.com</strong>.
              </li>
              <li>
                <strong>Seus direitos (art. 18 da LGPD):</strong> confirmação de que tratamos seus dados, acesso, correção, anonimização,
                bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre com quem compartilhamos, informação sobre a
                possibilidade de não consentir e as consequências, e revogação do consentimento. Para exercer, escreva para{" "}
                <strong>sac@angelblanc.com</strong>. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
              </li>
            </ul>
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
