/**
 * BIO FLORAIS B2B — senha do responsável/RCA.
 *
 * Formato já gravado em b2b_responsibles.password_hash no banco da Bio
 * (login B2B anterior): scrypt$<salt base64url>$<hash base64url>.
 * Mantido idêntico para não invalidar senhas existentes.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plainPassword, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function verifyPassword(plainPassword: string, stored: string): boolean {
  const parts = stored.split("$");

  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  try {
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");

    if (expected.length === 0) {
      return false;
    }

    const derived = scryptSync(plainPassword, salt, expected.length);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
