import type { Metadata } from "next";

import InfoPage from "@/components/layout/InfoPage";

export const metadata: Metadata = {
  title: "Trocas e Devoluções | Bio Florais",
  description: "Direito de arrependimento em 7 dias, troca por defeito e como pedir troca ou devolução na Bio Florais.",
};

/* TEXTO PADRÃO COM BASE NO CDC (Lei 8.078/1990) — o Luis/jurídico deve revisar antes de divulgar. */
export default function Page() {
  return (
    <InfoPage
      title="Trocas e Devoluções"
      intro="Queremos que você fique satisfeito com a sua compra. Veja abaixo como funcionam o arrependimento, a troca por defeito e a devolução, conforme o Código de Defesa do Consumidor."
      sections={[
        {
          heading: "1. Direito de arrependimento (7 dias)",
          paragraphs: [
            "Nas compras feitas pelo site, você pode desistir da compra em até 7 (sete) dias corridos, contados da data em que receber o produto (art. 49 do CDC), sem precisar explicar o motivo.",
            "Para que a devolução seja aceita, o produto deve estar lacrado, sem sinais de uso, na embalagem original e acompanhado da nota fiscal. Por questões de higiene e segurança, produtos de uso pessoal que já foram abertos ou usados não podem ser devolvidos por arrependimento.",
            "Feita a desistência, devolvemos o valor pago, incluindo o frete da compra, pela mesma forma de pagamento utilizada.",
          ],
        },
        {
          heading: "2. Produto com defeito, avaria ou diferente do pedido",
          paragraphs: [
            "Se o produto chegar danificado, com defeito ou diferente do que você pediu, avise-nos o quanto antes. Os prazos legais para reclamar de vício (art. 26 do CDC) são:",
          ],
          bullets: [
            "30 dias para produtos não duráveis (como cosméticos e florais de consumo);",
            "90 dias para produtos duráveis.",
          ],
        },
        {
          heading: "3. Como pedir troca ou devolução",
          paragraphs: [
            "Entre em contato com o nosso atendimento informando o número do pedido, o nome do produto e o motivo. Se possível, envie fotos do produto e da embalagem. Vamos orientar você sobre o envio e confirmar o prazo da solução.",
          ],
        },
        {
          heading: "4. Custos de envio e reembolso",
          paragraphs: [
            "Nos casos de arrependimento dentro do prazo e de defeito ou erro de envio, o custo do frete de devolução é por nossa conta.",
            "O reembolso é feito pela mesma forma de pagamento da compra: Pix em até 7 dias úteis após o recebimento do produto devolvido; cartão de crédito conforme o ciclo de fatura da operadora.",
          ],
        },
        {
          heading: "5. Compras para lojistas (B2B)",
          paragraphs: ["Pedidos feitos pela área B2B seguem as condições combinadas com o seu representante e o que consta nos Termos de Compra."],
        },
      ]}
    />
  );
}
