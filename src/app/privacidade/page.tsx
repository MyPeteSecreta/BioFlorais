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
          Política de Privacidade
        </h1>

        <div className="mt-6 h-px w-16 bg-[#c39745]" />

        <div className="mt-8 space-y-8 text-base leading-8 text-[#665765]">
          <p>
            Última atualização: 18 de outubro de 2026.
          </p>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              1. Quem é responsável pelos dados
            </h2>
            <p>
              O site Bio Florais é operado comercialmente por{" "}
              <strong>{COMPANY}</strong>, inscrita no CNPJ sob nº{" "}
              <strong>{CNPJ}</strong>. Para assuntos relacionados à privacidade
              e ao tratamento de dados pessoais, entre em contato pelo e-mail{" "}
              <strong>{EMAIL}</strong>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              2. Dados que podemos tratar
            </h2>
            <p>
              Durante a navegação, cadastro, compra, pagamento, entrega,
              atendimento ou utilização de funcionalidades do site, podemos
              tratar dados fornecidos pelo próprio usuário, como nome, e-mail,
              telefone, CPF ou outros dados de identificação quando necessários,
              endereço, CEP e demais informações de entrega e faturamento.
            </p>
            <p className="mt-3">
              Também podem ser tratados dados relacionados ao pedido, produtos
              adquiridos, valores, descontos, forma e situação do pagamento,
              informações necessárias ao cálculo e acompanhamento do frete,
              histórico de atendimento e registros técnicos de acesso e
              utilização do site.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              3. Pagamentos
            </h2>
            <p>
              Os pagamentos podem ser processados por prestadores especializados.
              A Bio Florais e a {COMPANY} podem receber e armazenar dados
              transacionais necessários para identificar, confirmar, conciliar,
              cancelar ou reembolsar uma compra, mas dados sensíveis de
              instrumentos de pagamento podem ser tratados diretamente pelos
              respectivos provedores, conforme o meio de pagamento utilizado.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              4. Entrega e logística
            </h2>
            <p>
              Para calcular frete, emitir ou acompanhar entregas e viabilizar o
              envio dos pedidos, os dados necessários podem ser compartilhados
              com transportadoras, plataformas de logística e demais prestadores
              envolvidos no cumprimento da compra.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              5. Para que utilizamos os dados
            </h2>
            <p>
              Os dados pessoais podem ser utilizados para processar pedidos e
              pagamentos; entregar produtos; prestar atendimento; prevenir
              fraudes e abusos; cumprir obrigações legais, regulatórias, fiscais
              e contábeis; exercer direitos; manter a segurança e a estabilidade
              do site; e melhorar a experiência e a operação do e-commerce.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              6. Compartilhamento de dados
            </h2>
            <p>
              Podemos compartilhar apenas os dados necessários com empresas que
              participem da operação, como provedores de pagamento, instituições
              financeiras, serviços de prevenção a fraude, hospedagem e
              infraestrutura tecnológica, logística, transportadoras,
              atendimento, contabilidade e autoridades públicas quando houver
              obrigação legal ou ordem válida.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              7. Armazenamento e segurança
            </h2>
            <p>
              Adotamos medidas técnicas e organizacionais destinadas a proteger
              os dados pessoais contra acessos não autorizados, perda, alteração,
              divulgação ou tratamento inadequado. Os dados são mantidos pelo
              período necessário às finalidades informadas e aos prazos legais,
              regulatórios, fiscais, contábeis e de exercício regular de direitos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              8. Direitos do titular
            </h2>
            <p>
              Nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD), o
              titular poderá solicitar, quando aplicável, confirmação da
              existência de tratamento, acesso, correção, informação sobre
              compartilhamentos, anonimização, bloqueio ou eliminação de dados
              tratados em desconformidade, portabilidade nos termos da
              regulamentação, revogação do consentimento e demais direitos
              previstos em lei.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              9. Cookies e tecnologias semelhantes
            </h2>
            <p>
              O site pode utilizar cookies, armazenamento local do navegador e
              tecnologias semelhantes necessárias à navegação, funcionamento do
              carrinho, segurança, preferências e demais funcionalidades. Mais
              informações estão disponíveis em nossa{" "}
              <Link
                href="/cookies"
                className="font-semibold text-[#63326d] underline"
              >
                Política de Cookies
              </Link>.
            </p>
          </section>

          <section data-testid="pixel-politica">
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              9.1. Medição de anúncios (marketing)
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
              9.2. Origem da visita (análise)
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
              10. Alterações desta política
            </h2>
            <p>
              Esta política poderá ser atualizada para refletir alterações
              legais, técnicas ou operacionais. A versão vigente permanecerá
              publicada nesta página.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#422347]">
              11. Contato
            </h2>
            <p>
              Pharma e Natural Distribuidora Ltda. · CNPJ {CNPJ}
              <br />
              Operação comercial da marca Bio Florais
              <br />
              Atendimento e privacidade: {EMAIL}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
