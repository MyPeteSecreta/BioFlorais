/**
 * BIO FLORAIS B2B — tokens opacos (link público de oferta).
 * 32 bytes aleatórios em base64url; só o SHA-256 (hex) vai para o banco.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Token cifrado (AES-256-GCM, chave derivada de ADMIN_SESSION_SECRET) para o
 * vendedor poder COPIAR de novo o link da oferta. Formato: iv.tag.dados
 * (base64url). Sem o segredo configurado, devolve null (sem cópia guardada).
 */
function offerLinkKey(): Buffer | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret ? scryptSync(secret, "bio-b2b-offer-link-v1", 32) : null;
}

export function encryptOfferToken(token: string): string | null {
  const key = offerLinkKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decryptOfferToken(payload: string | null | undefined): string | null {
  const key = offerLinkKey();
  if (!key || !payload) return null;
  try {
    const [iv, tag, data] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
