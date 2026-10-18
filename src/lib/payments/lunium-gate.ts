/**
 * Quando o status do pedido pode consultar a Lunium.
 *
 * Antes, TODO pedido ainda não pago chamava a Lunium a cada consulta de status, mesmo sendo Pix Mercado Pago (ou sem
 * Pix gerado). Com a chave da Lunium inválida/desativada, isso virava ~130 erros/dia "401 chave_incorreta" por aba
 * aberta (aba em segundo plano consulta 1x/min). Toda cobrança Lunium grava uma linha em \`payments\` com
 * provider = "lunium" ao ser criada; então só há o que conciliar se o pedido TEM pagamento Lunium. Pedido com Pix
 * Mercado Pago, cartão ou sem pagamento gerado nunca consulta a Lunium.
 */
export function shouldConsultLunium(orderPayments: ReadonlyArray<{ provider: string | null | undefined }>): boolean {
  return orderPayments.some((payment) => payment.provider === "lunium");
}
