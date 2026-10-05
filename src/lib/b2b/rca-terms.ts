/**
 * BIO FLORAIS B2B — Termo de Adesão do RCA (minuta de 01/10/2026).
 *
 * ÚNICO arquivo do termo: a VERSÃO (`RCA_TERMS_VERSION`, gravada no aceite junto com a
 * data/hora e o IP) e o TEXTO (seções 1 a 10) ficam aqui. Ao publicar o texto final
 * revisado pelo jurídico, edite SÓ este arquivo e troque a versão.
 *
 * É uma MINUTA: os campos entre [colchetes] são da empresa e ainda precisam ser
 * preenchidos. Texto em **negrito** usa a marcação ** **.
 */

export const RCA_TERMS_VERSION = "rca-2026-10";

export type TermsBlock =
  | { kind: "item"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; head: [string, string]; rows: Array<[string, string]> };

export type TermsSection = { title: string; blocks: TermsBlock[] };

const item = (text: string): TermsBlock => ({ kind: "item", text });

export const RCA_TERMS_SECTIONS: TermsSection[] = [
  {
    title: "1. Partes e objeto",
    blocks: [
      item('**Empresa:** Pharma e Natural Distribuidora Ltda., CNPJ 27.707.550/0001-00, titular das marcas Bio Florais, Secreta Essência e My Pet & Me ("Empresa").'),
      item('**Representante:** a pessoa física ou jurídica identificada no cadastro do portal B2B ("Representante" ou "RCA").'),
      item("**Objeto:** o Representante intermedeia vendas dos produtos da Empresa a clientes pessoa jurídica e pessoa física revendedora, usando o portal B2B. Ele cadastra clientes, gera links de oferta com as linhas e promoções habilitadas e acompanha os pedidos."),
      item("**Marcas abrangidas:** [todas as marcas / somente: ___]."),
    ],
  },
  {
    title: "2. Natureza da relação",
    blocks: [
      item("A relação é de representação comercial autônoma, regida pela Lei nº 4.886/1965. **Não há vínculo empregatício**, subordinação, horário ou meta obrigatória."),
      item("O Representante organiza o próprio trabalho e arca com seus custos (deslocamento, telefone, impostos)."),
      item("O Representante declara estar regularmente registrado no Conselho Regional dos Representantes Comerciais (CORE) de seu estado, quando exigido, e informa o número no cadastro: [CORE nº ___]."),
      item("Vendedores contratados pela Empresa em regime CLT que usem o portal seguem o contrato de trabalho; este termo não se aplica a eles, salvo as regras de uso do portal (seções 3, 4, 6, 7 e 8)."),
    ],
  },
  {
    title: "3. Acesso ao portal",
    blocks: [
      item("O login e a senha são pessoais e intransferíveis. O Representante responde por tudo que for feito com eles."),
      item("Os links de oferta são gerados por cliente. O Representante envia cada link somente ao cliente a que se destina e não o publica em redes sociais, grupos ou sites."),
      item("Suspeita de uso indevido da conta ou de um link deve ser comunicada à Empresa em até 24 horas, em [canal: e-mail / WhatsApp]."),
      item("A Empresa pode revogar links e suspender o acesso a qualquer momento, por segurança ou por descumprimento deste termo."),
    ],
  },
  {
    title: "4. Condições comerciais",
    blocks: [
      {
        kind: "paragraph",
        text: "Preços, promoções, pedido mínimo, frete, formas de pagamento e parcelamento são definidos exclusivamente pela Empresa e calculados pelo portal. O Representante não pode alterá-los, prometer condições diferentes nem receber valores dos clientes.",
      },
      {
        kind: "table",
        head: ["Regra", "Condição vigente nesta minuta"],
        rows: [
          ["Pedido mínimo", "R$ 250,00"],
          ["Promoções", "Somente as habilitadas pela Empresa para cada linha e escolhidas no link de oferta"],
          ["Cartão", "Até 3x, parcela mínima de R$ 500,00"],
          ["Boleto", "Somente cliente pessoa jurídica; até 3x, parcela mínima R$ 500,00, vencimentos em 28/42/56 dias"],
          ["Pagamento", "Feito pelo cliente direto à Empresa, pelo portal"],
          ["Frete", "Calculado pelo portal; condição especial a partir de R$ 450,00"],
        ],
      },
      {
        kind: "paragraph",
        text: "A Empresa pode mudar essas condições a qualquer tempo. A mudança vale para os links gerados depois dela; pedidos já criados mantêm a condição em que foram feitos.",
      },
    ],
  },
  {
    title: "5. Comissão",
    blocks: [
      item("**Percentual:** [___ %] sobre a base abaixo, ou o percentual da tabela de comissões exibida no portal para a linha, o cliente ou a promoção, quando houver."),
      item("**Base de cálculo:** valor dos produtos efetivamente pago pelo cliente, já com descontos de promoção, cupom e forma de pagamento. Não entram frete, impostos destacados nem unidades bonificadas."),
      item("**Quando é devida:** somente após o recebimento integral pela Empresa. No boleto parcelado, a comissão acompanha cada parcela paga."),
      item("**Pagamento:** mensal, até o dia [__] do mês seguinte ao recebimento, por Pix na chave cadastrada, mediante nota fiscal ou RPA do Representante."),
      item("**Estorno:** pedido cancelado, devolvido, contestado (chargeback) ou não pago não gera comissão; a já paga é descontada dos pagamentos seguintes."),
      item("**Atribuição:** o pedido pertence ao Representante dono do link de oferta usado pelo cliente."),
    ],
  },
  {
    title: "6. Obrigações do Representante",
    blocks: [
      item("Informar o cliente com verdade sobre produtos, preços, prazos e formas de pagamento, conforme mostrados no portal."),
      item("Cadastrar clientes com dados corretos e com autorização deles."),
      item("Não prometer prazos de entrega, brindes, descontos ou benefícios que não estejam no portal."),
      item("Não receber pagamentos, sinais ou valores em nome da Empresa."),
      item("Não fazer afirmações terapêuticas, medicinais ou de resultado garantido sobre os produtos além das que constam nos materiais oficiais."),
      item("Repassar à Empresa reclamações e pedidos de troca dos clientes em até [2] dias úteis."),
      item("Manter os próprios dados cadastrais e bancários atualizados no portal."),
    ],
  },
  {
    title: "7. Dados pessoais (LGPD) e confidencialidade",
    blocks: [
      item("Os dados dos clientes cadastrados no portal são tratados pela Empresa como controladora, nos termos da Lei nº 13.709/2018 (LGPD). O Representante os usa apenas para atender esses clientes nas vendas da Empresa."),
      item("É proibido copiar, exportar, vender, compartilhar ou usar os dados de clientes para outras empresas ou marcas."),
      item("O Representante autoriza a Empresa a tratar os dados dele (cadastro, bancários, acessos e vendas) para operar o portal, pagar comissões e cumprir obrigações legais."),
      item("Preços, condições, promoções, listas de clientes e informações do portal são confidenciais, durante o termo e por [2] anos após o fim dele."),
    ],
  },
  {
    title: "8. Marcas e materiais",
    blocks: [
      item("O Representante pode usar nomes, logotipos, fotos e materiais das marcas somente na forma fornecida pela Empresa e para vender os produtos dela."),
      item("Não pode criar perfis, sites, anúncios pagos ou páginas com o nome das marcas sem autorização por escrito."),
      item("Ao fim do termo, para de usar as marcas e os materiais."),
    ],
  },
  {
    title: "9. Vigência, suspensão e rescisão",
    blocks: [
      item("O termo vale por prazo indeterminado a partir do aceite e da aprovação do cadastro pela Empresa."),
      item('Qualquer parte pode encerrá-lo sem justa causa, com o aviso prévio e as verbas previstas na Lei nº 4.886/1965 quando aplicáveis (aviso prévio, art. 34, e indenização, art. 27, "j").'),
      item("Configuram justa causa, entre outros: receber valores de clientes, oferecer condições não autorizadas, usar indevidamente dados de clientes ou marcas, ou repassar a terceiros as credenciais ou os links de oferta."),
      item("A Empresa pode suspender o acesso durante a apuração de uma irregularidade, por até [15] dias."),
      item("Com o fim do termo, os links de oferta são desativados. As comissões de pedidos já pagos até a data do encerramento continuam devidas."),
    ],
  },
  {
    title: "10. Disposições gerais, foro e aceite",
    blocks: [
      item("**Exclusividade e território:** [sem exclusividade de zona / zona exclusiva: ___]. O Representante pode representar outras empresas que não vendam produtos concorrentes [definir quais]."),
      item("**Alterações:** a Empresa pode atualizar este termo; a nova versão é apresentada no portal e o uso continuado depende de novo aceite."),
      item("**Comunicações:** pelo e-mail e WhatsApp cadastrados e por avisos no portal."),
      item("**Foro:** [comarca de ___], salvo foro do domicílio do Representante quando a lei assim exigir."),
      item('**Aceite eletrônico:** ao marcar "Li e aceito os termos de representação" no cadastro, o Representante aceita este termo. O portal registra data, hora, IP e a versão aceita.'),
    ],
  },
];

export const RCA_TERMS_ACCEPT_LABEL = "Li e aceito os termos de representação";
