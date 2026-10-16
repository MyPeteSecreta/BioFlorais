/**
 * BIO FLORAIS B2B — constantes do "Lançar pedido" sem dependências de servidor (usadas também no navegador).
 */

/** Valor de orders.origin (SQL 37b) dos pedidos lançados pelo vendedor. */
export const LAUNCH_ORIGIN = "vendedor";

/** Aviso LGPD exibido no cadastro do cliente. */
export const LAUNCH_LGPD_NOTICE = "Dados informados pelo representante com autorização do cliente.";

export const LAUNCH_OTHER_REP_MESSAGE = "Cliente atendido por outro representante.";

/** Parâmetro que abre a loja do link em modo lançamento. */
export const LAUNCH_QUERY = "lancar";

/** O modo lançamento fica gravado na aba (sessionStorage) por token de oferta; o SERVIDOR revalida pela sessão. */
export const launchStorageKey = (token: string) => `b2b-launch:${token}`;

/** Link de pagamento do pedido no cartão (o cliente paga no próprio celular). */
export function buildCardPayLinkPath(orderId: string, offerToken: string): string {
  return `/b2b/pagar?pedido=${encodeURIComponent(orderId)}&b2b=${encodeURIComponent(offerToken)}`;
}
