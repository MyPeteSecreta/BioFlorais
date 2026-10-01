/**
 * OAuth do Melhor Envio — proteção contra CSRF / troca de conta.
 *
 * Antes, o "state" era fixo ("bioflorais-shipping") e as rotas não
 * exigiam sessão: qualquer pessoa podia iniciar o fluxo com a PRÓPRIA
 * conta do Melhor Envio e o callback gravava essas credenciais como as da
 * loja. Agora (autorizado pelo Luis, 01/10):
 * - /authorize e /callback exigem a sessão do admin;
 * - /authorize gera um state aleatório (256 bits) e o guarda em cookie
 *   httpOnly; o /callback só aceita se o state devolvido for igual ao do
 *   cookie (comparação em tempo constante). Cookie de uso único.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";

export const MELHORENVIO_STATE_COOKIE = "bioflorais_me_oauth_state";
export const MELHORENVIO_STATE_MAX_AGE = 10 * 60; // 10 minutos
export const MELHORENVIO_CALLBACK_PATH = "/api/shipping/melhorenvio/callback";

export function createMelhorEnvioOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function isValidMelhorEnvioOAuthState(
  cookieValue: string | undefined | null,
  returnedState: string | undefined | null
) {
  if (!cookieValue || !returnedState) return false;

  const expected = Buffer.from(cookieValue);
  const received = Buffer.from(returnedState);

  return expected.length >= 32 && expected.length === received.length && timingSafeEqual(expected, received);
}

/** Opções do cookie: enviado na volta do Melhor Envio (navegação GET de topo). */
export function melhorEnvioStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: MELHORENVIO_CALLBACK_PATH,
    maxAge: MELHORENVIO_STATE_MAX_AGE,
  };
}
