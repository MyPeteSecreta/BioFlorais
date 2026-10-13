/**
 * BIO FLORAIS B2B — autorização das rotas de pagamento (Pix e cartão).
 *
 *  - Pedido de oferta (b2b_offer_id): exige o token da oferta (verifyB2BOrderOfferToken, sem mudança).
 *  - Pedido de MOSTRUÁRIO (orders.origin = 'mostruario', sem oferta): quem paga é o próprio vendedor,
 *    autorizado pela sessão dele (showcase-order-access.ts).
 */

import type { NextRequest } from "next/server";

import { getAppSqlRunner } from "@/lib/b2b/ownership";
import { verifyB2BOrderOfferToken } from "@/lib/b2b/public-offer-context";
import { B2B_SESSION_COOKIE } from "@/lib/b2b/responsible-session";
import { verifyShowcaseOrderAccess } from "@/lib/b2b/showcase-order-access";

export async function verifyB2BOrderPaymentAccess(
  request: NextRequest,
  order: { id: string; b2bOfferId: string | null | undefined },
  rawToken: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (order.b2bOfferId) {
    return verifyB2BOrderOfferToken(order.b2bOfferId, rawToken);
  }

  return verifyShowcaseOrderAccess(getAppSqlRunner(), order.id, request.cookies.get(B2B_SESSION_COOKIE)?.value);
}
