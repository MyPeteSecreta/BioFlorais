/**
 * BIO FLORAIS B2B — parte PURA dos links com promoção (sem banco): código curto, situação (ativo/vencido/revogado) e caminhos.
 * Separada de promo-links.ts para o contexto público da oferta poder usar sem importação circular.
 */

import { randomInt } from "node:crypto";

export const MAX_LINKS_PER_SELLER = 50;
export const MAX_VALIDITY_DAYS = 365;
export const PROMO_ENDED_NOTICE = "promo-encerrada";

export type PromoLinkStatus = "active" | "expired" | "revoked";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-Z0-9]{4,12}$/;

export function generatePromoCode(random: (max: number) => number = randomInt) {
  let code = "";

  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];

  return code;
}

export function normalizePromoCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();

  return CODE_RE.test(code) ? code : null;
}

export function promoLinkStatus(link: { expiresAt: Date | null; revokedAt: Date | null }, now = new Date()): PromoLinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired";

  return "active";
}

/** /parceiros?v=<código do vendedor>&promo=<código curto> */
export function promoLinkPath(sellerCode: string, promoCode: string) {
  return `/parceiros?v=${encodeURIComponent(sellerCode)}&promo=${encodeURIComponent(promoCode)}`;
}

/** Acrescenta ?chave=valor (ou &) a um caminho que pode já ter query. */
export function withQueryParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
