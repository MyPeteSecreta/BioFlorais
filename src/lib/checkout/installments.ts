/**
 * Parcelamento no cartão do B2C (a regra REAL do checkout: src/components/payments/MercadoPagoCardPayment.tsx e a rota
 * /api/payments/mercadopago/card): no máximo 3 parcelas e parcela mínima de R$ 50,00, sobre o TOTAL do pedido.
 * Usado só para mostrar a dica na página do produto e na sacola; quem cobra é o checkout (valida de novo no servidor).
 * Não promete "sem juros": só diz até quantas vezes.
 */

export const MAX_INSTALLMENTS = 3;
export const MIN_INSTALLMENT_CENTS = 5000;

/** Parcelas possíveis para um valor total (1 a 3). */
export function allowedInstallments(totalCents: number): number {
  return Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(Math.max(0, totalCents) / MIN_INSTALLMENT_CENTS)));
}

/** Dica: "até Nx" quando o valor já parcela; senão, a partir de quanto parcela. */
export function installmentsHint(amountCents: number): string {
  const n = allowedInstallments(amountCents);

  if (n > 1) return `No cartão: em até ${n}x (parcela mínima de R$ 50).`;

  return `No cartão: parcele em até ${MAX_INSTALLMENTS}x em compras a partir de R$ ${(MIN_INSTALLMENT_CENTS * 2) / 100} (parcela mínima de R$ 50).`;
}
