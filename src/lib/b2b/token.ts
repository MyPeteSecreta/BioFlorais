/**
 * BIO FLORAIS B2B — tokens opacos (link público de oferta).
 * 32 bytes aleatórios em base64url; só o SHA-256 (hex) vai para o banco.
 */

import { createHash, randomBytes } from "node:crypto";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
