import type { Metadata } from "next";

import Link from "next/link";

import { getSiteUrl } from "@/lib/seo/site-url";

// Página legal/compliance (Metadata SEO V2.1, Seção 2/8): mesma classificação
// de /cookies e /privacidade — noindex, sem intenção de busca de aquisição.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Termos de Compra | Bio Florais",
  description:
    "Termos e condições de compra da Bio Florais: fornecedor, produtos, preços, pagamento, entrega e demais regras da venda.",
  alternates: {
    canonical: "/termos-de-compra",
  },
  robots: {
    index: false,
    follow: true,
  },
};

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
          Termos de Compra
        </h1>

        <div className="mt-6 h-px w-16 bg-[#c39745]" />

        <p className="mt-8 text-sm text-[#766775]">
          Última atualização: 9 de setembro de 2026.
        </p>

        <div className="mt-10 space-y-10 text-base leading-8 text-[#5f515e]">

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              1. Identificação do fornecedor
            </h2>

            <p className="mt-3">
              As vendas realizadas neste site são efetuadas por{" "}
              <strong>Pharma e Natural Distribuidora Ltda.</strong>, inscrita no
              CNPJ sob nº <strong>27.707.550/0001-00</strong>, responsável pela
              operação comercial da marca <strong>Bio Florais</strong>.
            </p>

            <p className="mt-3">
              Atendimento:{" "}
              <a
                href="mailto:sac@angelblanc.com"
                className="font-semibold text-[#63326d] hover:underline"
              >
                sac@angelblanc.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              2. Produtos, preços e disponibilidade
            </h2>

            <p className="mt-3">
              As características essenciais, quantidades, preços e demais
              informações de cada produto são apresentadas nas respectivas
              páginas e no carrinho.
            </p>

            <p className="mt-3">
              Preços, promoções e condições comerciais podem ser alterados para
              compras futuras, sem afetar pedidos já concluídos. A conclusão da
              venda depende da disponibilidade dos produtos e da confirmação do
              pagamento.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              3. Cadastro e dados da compra
            </h2>

            <p className="mt-3">
              O cliente deve fornecer informações verdadeiras, completas e
              atualizadas para cadastro, faturamento e entrega. Dados incorretos
              ou incompletos podem impedir o processamento do pedido ou causar
              atrasos.
            </p>

            <p className="mt-3">
              O tratamento de dados pessoais segue a nossa{" "}
              <Link
                href="/privacidade"
                className="font-semibold text-[#63326d] hover:underline"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              4. Pagamento
            </h2>

            <p className="mt-3">
              As formas de pagamento disponíveis são apresentadas no checkout.
              A aprovação, recusa, análise ou processamento da transação pode
              depender do provedor de pagamento, da bandeira do cartão, da
              instituição emissora e das demais instituições envolvidas no
              processamento.
            </p>

            <p className="mt-3">
              A disponibilização de determinada forma de pagamento pode variar
              conforme o pedido, o valor da compra e as regras dos provedores
              utilizados.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              5. Entrega e frete
            </h2>

            <p className="mt-3">
              O valor do frete e a estimativa de entrega são apresentados antes
              da finalização da compra, conforme o endereço informado, os
              produtos do pedido e as modalidades de entrega disponíveis.
            </p>

            <p className="mt-3">
              Os prazos apresentados são estimativas e podem sofrer alterações
              em razão de eventos logísticos, restrições de acesso, força maior
              ou outras ocorrências fora do controle razoável da loja.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              6. Direito de arrependimento
            </h2>

            <p className="mt-3">
              Nas compras realizadas pela internet, o consumidor pode exercer o
              direito de arrependimento no prazo legal de{" "}
              <strong>7 (sete) dias</strong>, contado do recebimento do produto,
              conforme a legislação brasileira aplicável.
            </p>

            <p className="mt-3">
              Para solicitar o cancelamento, entre em contato pelo e-mail{" "}
              <a
                href="mailto:sac@angelblanc.com"
                className="font-semibold text-[#63326d] hover:underline"
              >
                sac@angelblanc.com
              </a>
              , informando os dados necessários para identificação do pedido. A
              equipe orientará o procedimento de devolução e restituição
              aplicável.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              7. Produto com vício, defeito, avaria ou divergência
            </h2>

            <p className="mt-3">
              Se o produto recebido apresentar vício, defeito, avaria decorrente
              do transporte ou divergência em relação ao pedido realizado, entre
              em contato pelo e-mail{" "}
              <a
                href="mailto:sac@angelblanc.com"
                className="font-semibold text-[#63326d] hover:underline"
              >
                sac@angelblanc.com
              </a>
              .
            </p>

            <p className="mt-3">
              A solicitação será analisada e tratada conforme a legislação
              brasileira de proteção e defesa do consumidor.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              8. Cancelamentos, restituições e estornos
            </h2>

            <p className="mt-3">
              Quando houver cancelamento ou restituição de valores, o
              processamento financeiro seguirá o meio de pagamento utilizado e
              os procedimentos das instituições envolvidas.
            </p>

            <p className="mt-3">
              O prazo para visualização do crédito ou estorno pode variar
              conforme a forma de pagamento, bandeira, banco emissor ou
              instituição financeira responsável.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              9. Atendimento
            </h2>

            <p className="mt-3">
              Dúvidas e solicitações relacionadas a pedidos, pagamentos,
              entregas, arrependimento, devoluções ou demais assuntos
              relacionados à compra podem ser encaminhadas para{" "}
              <a
                href="mailto:sac@angelblanc.com"
                className="font-semibold text-[#63326d] hover:underline"
              >
                sac@angelblanc.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              10. Privacidade e proteção de dados
            </h2>

            <p className="mt-3">
              Os dados pessoais fornecidos pelo cliente são tratados conforme
              nossa{" "}
              <Link
                href="/privacidade"
                className="font-semibold text-[#63326d] hover:underline"
              >
                Política de Privacidade
              </Link>
              , observando a legislação aplicável, incluindo a Lei Geral de
              Proteção de Dados Pessoais — LGPD.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#422347]">
              11. Legislação aplicável
            </h2>

            <p className="mt-3">
              Estes Termos de Compra são regidos pela legislação brasileira,
              especialmente pelas normas aplicáveis às relações de consumo e ao
              comércio eletrônico.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}