import type { Metadata } from "next";

import InfoPage from "@/components/layout/InfoPage";

export const metadata: Metadata = {
  title: "Frete e Entrega | Bio Florais",
  description: "Como calculamos o frete, prazos de entrega, frete grátis e acompanhamento do pedido na Bio Florais.",
};

/* TEXTO PADRÃO — o Luis/operação deve revisar prazos, valores e transportadoras antes de divulgar. */
export default function Page() {
  return (
    <InfoPage
      title="Frete e Entrega"
      intro="Entregamos em todo o Brasil. O valor e o prazo do frete aparecem antes de você finalizar a compra, e você acompanha o pedido pelo nosso site."
      sections={[
        {
          heading: "1. Como o frete é calculado",
          paragraphs: [
            "O frete é calculado no carrinho e no checkout, pelo CEP de entrega, com base no peso e nas dimensões dos produtos. Você escolhe a modalidade (preço e prazo) que preferir entre as opções exibidas.",
          ],
        },
        {
          heading: "2. Frete grátis",
          paragraphs: ["Compras a partir de R$ 100,00 em produtos têm frete grátis na modalidade indicada no checkout (condição sujeita à região e à promoção vigente)."],
        },
        {
          heading: "3. Prazos",
          paragraphs: [
            "O prazo de entrega informado no checkout começa a contar depois da confirmação do pagamento e do envio do pedido. Pedidos pagos por Pix são confirmados em minutos; no cartão, após a aprovação da operadora.",
            "Preparamos e despachamos os pedidos em dias úteis. Datas especiais, greves e condições climáticas podem alterar os prazos das transportadoras.",
          ],
        },
        {
          heading: "4. Acompanhe o seu pedido",
          paragraphs: [
            "Quando o pedido é enviado, você recebe o código de rastreio. Acompanhe a qualquer momento em “Acompanhe seu pedido”, no menu do site, usando o número do pedido e o e-mail da compra.",
          ],
        },
        {
          heading: "5. Recebimento",
          paragraphs: [
            "Confira a embalagem no ato da entrega. Se houver avaria ou violação, recuse o recebimento ou registre a ocorrência com o entregador e fale com a gente em seguida.",
            "Se ninguém estiver no endereço, a transportadora costuma tentar novamente ou deixar o aviso de retirada. Endereço incorreto ou incompleto pode gerar atraso ou devolução ao remetente.",
          ],
        },
      ]}
    />
  );
}
