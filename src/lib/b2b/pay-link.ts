/**
 * Item 42 (14/11): LINK DE PAGAMENTO do pedido B2B (/b2b/pagar), agora com Pix e cartão. Usado pelo botão do admin
 * ("Gerar / copiar link de pagamento") e pelo lembrete de não pago do B2B (item 41). Funções puras.
 *  - Só pedido de OFERTA (o link usa o token da oferta do cliente), pendente, em Pix ou cartão.
 *  - Boleto a prazo NÃO: tem os avisos próprios de vencimento. Mostruário: o vendedor paga na própria área (sessão dele).
 */

import { buildCardPayLinkPath } from "@/lib/b2b/launch-constants";
import { formatB2BCents } from "@/lib/b2b/format";

export type PayLinkOrder = { status: string; paymentMethod: string | null; b2bOfferId: string | null };

export function b2bPayLinkEligible(order: PayLinkOrder): boolean {
  return Boolean(order.b2bOfferId) && order.status === "pending" && (order.paymentMethod === "pix" || order.paymentMethod === "card");
}

export function b2bPayLinkUrl(siteUrl: string, orderId: string, offerToken: string): string {
  return `${siteUrl.replace(/\/$/, "")}${buildCardPayLinkPath(orderId, offerToken)}`;
}

/** Texto pronto para o WhatsApp (tom B2B, sem desconto, preço do pedido). */
export function b2bPayLinkMessage(input: {
  clientName: string;
  responsibleName: string;
  orderNumber: string;
  totalCents: number;
  paymentMethod: string | null;
  url: string;
}): string {
  const how = input.paymentMethod === "pix" ? "no Pix (QR Code ou copia e cola; se o Pix vencer, o link gera outro na hora)" : "no cartão";
  const name = input.clientName.trim() || "tudo bem";

  return `Olá, ${name}! Aqui é ${input.responsibleName}, da Bio Florais. Segue o link para pagar o pedido #${input.orderNumber} (${formatB2BCents(input.totalCents)}) ${how}: ${input.url}`;
}
